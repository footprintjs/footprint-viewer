/**
 * initialAt — an ADDRESS instead of a click, and an honest "no" when it misses.
 *
 * The seam exists so a link can carry a place: `#/runs/<ref>?tab=why&at=llm%233`
 * opens the Why tab with the cursor already on that stop. The dangerous half is
 * the other one — an address that does not exist on this run. A viewer that
 * jumped to something near enough would answer a question nobody asked, and
 * the reader would have no way to tell. So a miss moves NOTHING, and it is
 * reported twice: as data on `onNavigation` (for the host's own copy) and as a
 * sentence in the inference report.
 *
 * Every address below is read off the recording's OWN ruler, computed here
 * with the same lens function the viewer uses — never typed in by hand, which
 * would make this a test of a fixture rather than of the seam.
 */

import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observeRecording, scrubAxisFor } from 'agentfootprint-lens/why';

import { FootprintViewer } from './FootprintViewer.js';
import { ViewerConfigError } from './config/validate.js';
import type { ViewerNavigationReport, ViewerWarning } from './config/types.js';
import { skillRun } from './test/fixtures.js';

const skill = skillRun();

/** The run's own ruler — the same axis the viewer resolves against. */
const commitAxis = scrubAxisFor(observeRecording(skill).recorder, 'step');

/** ONE source object, held. A new source identity is a new recording as far
 *  as the viewer is concerned — it reloads and remounts — so a host that
 *  re-creates it inline re-seeds its own address. That is worth knowing, and
 *  it is why every re-render test below holds this constant. */
const source = { kind: 'recording', data: skill } as const;

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
  cleanup();
});

describe('an address that lands', () => {
  it('opens the addressed tab with the cursor already on that stop', async () => {
    const target = commitAxis[3]!;
    const reports: ViewerNavigationReport[] = [];

    render(
      <FootprintViewer
        source={source}
        config={{
          initialAt: { lens: 'why', runtimeStageId: target.runtimeStageId },
          onNavigation: (report) => reports.push(report),
        }}
      />,
    );

    const ready = await screen.findByTestId('viewer-ready');
    // The tab the address named — not the tab inference would have picked.
    expect(screen.getByTestId('viewer-tab-why')).toHaveAttribute('aria-selected', 'true');
    // The cursor, checkable from outside.
    await waitFor(() => expect(ready.getAttribute('data-cursor-stage')).toBe(target.runtimeStageId));
    expect(ready.getAttribute('data-cursor-commit')).toBe(String(target.commitIdx));

    expect(reports).toHaveLength(1);
    expect(reports[0]!.outcome).toBe('exact');
    expect(reports[0]!.requested).toBe(target.runtimeStageId);
    expect(reports[0]!.landedOn?.runtimeStageId).toBe(target.runtimeStageId);
  });

  it('says nothing in the report when it did exactly what was asked', async () => {
    const warnings: ViewerWarning[] = [];
    render(
      <FootprintViewer
        source={source}
        config={{
          initialAt: { runtimeStageId: commitAxis[1]!.runtimeStageId },
          onWarning: (w) => warnings.push(w),
        }}
      />,
    );
    await screen.findByTestId('viewer-ready');
    await waitFor(() => expect(warnings.length).toBeGreaterThan(0));
    // A landing is not a disclosure — nothing was substituted.
    expect(warnings.filter((w) => w.code === 'navigation')).toEqual([]);
  });

  it('an address without a lens keeps the viewer\'s own landing tab', async () => {
    render(
      <FootprintViewer
        source={source}
        config={{ landing: 'flow', initialAt: { runtimeStageId: commitAxis[2]!.runtimeStageId } }}
      />,
    );
    await screen.findByTestId('viewer-ready');
    expect(screen.getByTestId('viewer-tab-flow')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('RED — an address that misses moves nothing, and says so', () => {
  it('reports the miss with the nearest stop as an OFFER, and moves the cursor no differently than no address at all', async () => {
    const reports: ViewerNavigationReport[] = [];
    const warnings: ViewerWarning[] = [];
    // A real stage-id SHAPE with an execution index far past the end of this
    // run — "not on this ruler", which is the miss a stale deep link hits.
    const missing = 'call-llm#9999';

    render(
      <FootprintViewer
        source={source}
        config={{
          initialAt: { lens: 'flow', runtimeStageId: missing },
          onNavigation: (report) => reports.push(report),
          onWarning: (w) => warnings.push(w),
        }}
      />,
    );

    const ready = await screen.findByTestId('viewer-ready');
    await waitFor(() => expect(reports).toHaveLength(1));

    expect(reports[0]!.outcome).toBe('missed');
    expect(reports[0]!.requested).toBe(missing);
    // The type makes a silent jump unrepresentable: a miss carries no landing.
    expect(reports[0]!.landedOn).toBeUndefined();

    // "Nothing moved" is checked against the CONTROL — the same recording, the
    // same tab, no address — rather than against a hard-coded -1. The mounted
    // lens reports its own opening position either way; what must be true is
    // that the address changed none of it.
    const withAddress = {
      step: ready.getAttribute('data-cursor-step'),
      stage: ready.getAttribute('data-cursor-stage'),
      commit: ready.getAttribute('data-cursor-commit'),
    };
    cleanup();
    render(
      <FootprintViewer source={source} config={{ landing: 'flow' }} />,
    );
    const control = await screen.findByTestId('viewer-ready');
    expect(withAddress).toEqual({
      step: control.getAttribute('data-cursor-step'),
      stage: control.getAttribute('data-cursor-stage'),
      commit: control.getAttribute('data-cursor-commit'),
    });

    // The offer: named, never taken.
    expect(reports[0]!.nearest?.runtimeStageId).toBeTruthy();
    expect(reports[0]!.message).toMatch(/offered, not taken/);

    // And the inference report carries the same fact as a sentence.
    const line = warnings.find((w) => w.code === 'navigation');
    expect(line?.message).toMatch(/initialAt did not land/);
    expect(line?.message).toMatch(/Nothing moved\./);
    expect(warnSpy.mock.calls.flat()).toContain(line?.message);
  });
});

describe('an address SEEDS the cursor — it does not control it', () => {
  it('a host re-render with the same address does not re-seed', async () => {
    const target = commitAxis[2]!;
    const reports: ViewerNavigationReport[] = [];
    const config = (extra: string) => ({
      appName: extra, // a new object identity every time, as a host would pass
      initialAt: { lens: 'flow' as const, runtimeStageId: target.runtimeStageId },
      onNavigation: (report: ViewerNavigationReport) => reports.push(report),
    });

    const view = render(
      <FootprintViewer source={source} config={config('one')} />,
    );
    const ready = await screen.findByTestId('viewer-ready');
    await waitFor(() => expect(ready.getAttribute('data-cursor-stage')).toBe(target.runtimeStageId));

    view.rerender(
      <FootprintViewer source={source} config={config('two')} />,
    );
    await waitFor(() => expect(screen.getByTestId('viewer-ready')).toBeInTheDocument());
    // Applied per ADDRESS, not per render: dragging a reader who had scrubbed
    // away back to the host's address is a hijack, not a deep link.
    expect(reports).toHaveLength(1);
  });

  it('a LATER address is not applied — the viewer never fights a live cursor', async () => {
    const first = commitAxis[1]!;
    const second = commitAxis[4]!;
    const reports: ViewerNavigationReport[] = [];
    const at = (runtimeStageId: string) => ({
      initialAt: { lens: 'flow' as const, runtimeStageId },
      onNavigation: (report: ViewerNavigationReport) => reports.push(report),
    });

    const view = render(<FootprintViewer source={source} config={at(first.runtimeStageId)} />);
    const ready = await screen.findByTestId('viewer-ready');
    await waitFor(() => expect(ready.getAttribute('data-cursor-stage')).toBe(first.runtimeStageId));

    view.rerender(<FootprintViewer source={source} config={at(second.runtimeStageId)} />);
    await waitFor(() => expect(screen.getByTestId('viewer-ready')).toBeInTheDocument());

    // Nothing was re-seeded and nothing was reported: the seam is mount-scoped
    // and says so. A host that means to navigate a mounted viewer remounts it.
    expect(reports.map((report) => report.requested)).toEqual([first.runtimeStageId]);
    // NOT asserted here: where the cursor ends up. A re-render can make the
    // mounted lens report its own position (observed: it lands on the last
    // stop), which is agentfootprint-lens's behaviour and not this seam's —
    // asserting it would pin somebody else's quirk as our contract. What IS
    // this seam's contract is the line above: the address was read once.
    expect(screen.getByTestId('viewer-ready').getAttribute('data-cursor-stage')).not.toBe(
      second.runtimeStageId,
    );
  });

  it('a REMOUNT on the new address does land — the documented recipe', async () => {
    const second = commitAxis[4]!;
    const reports: ViewerNavigationReport[] = [];
    render(
      <FootprintViewer
        key={second.runtimeStageId}
        source={source}
        config={{
          initialAt: { lens: 'flow', runtimeStageId: second.runtimeStageId },
          onNavigation: (report) => reports.push(report),
        }}
      />,
    );
    const ready = await screen.findByTestId('viewer-ready');
    await waitFor(() => expect(ready.getAttribute('data-cursor-stage')).toBe(second.runtimeStageId));
    expect(reports[0]!.outcome).toBe('exact');
  });
});

describe('a mistyped address is loud at mount', () => {
  it('refuses an empty runtimeStageId by name', () => {
    expect(() =>
      render(
        <FootprintViewer
          source={source}
          config={{ initialAt: { runtimeStageId: '  ' } }}
        />,
      ),
    ).toThrow(ViewerConfigError);
  });

  it('refuses an address on a tab this viewer does not offer', () => {
    expect(() =>
      render(
        <FootprintViewer
          source={source}
          config={{ lenses: ['flow'], initialAt: { lens: 'why', runtimeStageId: 'llm#1' } }}
        />,
      ),
    ).toThrow(/initialAt\.lens is "why", but lenses does not include it/);
  });
});
