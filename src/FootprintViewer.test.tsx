/**
 * The component, end to end over REAL generated fixtures: zero-config
 * inference, the refusal card in the DOM, the honest empty states, the lazy
 * Story peer, the capability audit, and the one cursor carried across tabs
 * by commit index — checked from OUTSIDE via the data-cursor-* attributes.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observeRecording, scrubAxisFor, stepForCommitIdx } from 'agentfootprint-lens/why';
import type { Recording } from 'agentfootprint-lens/why';

import { FootprintViewer } from './FootprintViewer.js';
import type { ViewerPaneProps, ViewerWarning } from './config/types.js';
import { __setStoryModuleLoaderForTests } from './story/loadStoryModule.js';
import { bareCommitLog, plainRun, skillRun } from './test/fixtures.js';

const skill = skillRun();
const plain = plainRun();

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
  __setStoryModuleLoaderForTests(undefined);
  cleanup();
});

function mountReady(recording: Recording, config?: Parameters<typeof FootprintViewer>[0]['config']) {
  const utils = render(
    <FootprintViewer source={{ kind: 'recording', data: recording }} config={config} />,
  );
  return utils;
}

describe('zero-config: the recording decides', () => {
  it('mounts all five tabs, lands on the first lit one, and reports each inference', async () => {
    const warnings: ViewerWarning[] = [];
    mountReady(skill, { onWarning: (w) => warnings.push(w) });

    await screen.findByTestId('viewer-ready');
    for (const id of ['story', 'why', 'flow', 'skillgraph', 'data']) {
      expect(screen.getByTestId(`viewer-tab-${id}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('viewer-tab-story')).toHaveAttribute('aria-selected', 'true');

    await waitFor(() =>
      expect(warnings.map((w) => w.message)).toContain(
        'footprint-viewer: SkillGraph tab: on — this recording carries skill routing',
      ),
    );
    // The same sentences reach the console in dev mode.
    expect(warnSpy.mock.calls.flat()).toContain(
      'footprint-viewer: SkillGraph tab: on — this recording carries skill routing',
    );
  });

  it('a plain run keeps the SkillGraph tab, marked empty — it never vanishes', async () => {
    mountReady(plain);
    await screen.findByTestId('viewer-ready');
    expect(screen.getByTestId('viewer-tab-skillgraph')).toHaveAttribute(
      'data-tab-status',
      'empty',
    );
  });

  it('an empty recording lands on the honest empty state, not a blank pane', async () => {
    mountReady({ snapshot: null, events: [] } as unknown as Recording);
    await screen.findByTestId('viewer-ready');
    expect(await screen.findByTestId('viewer-empty-story')).toHaveTextContent(
      'No story to tell here',
    );
  });
});

describe('wrong input: the teaching card, on screen', () => {
  it('renders the three sentences for a bare commit log', async () => {
    render(
      <FootprintViewer source={{ kind: 'recording', data: bareCommitLog() as never }} />,
    );
    const card = await screen.findByTestId('viewer-refusal');
    expect(card).toHaveTextContent(
      'This viewer reads a recording — { snapshot, events, structure } — or the envelope persistRecording writes around one.',
    );
    expect(screen.getByTestId('viewer-refusal-received')).toHaveTextContent(
      'a bare commit log (an array of commit bundles)',
    );
    expect(screen.getByTestId('viewer-refusal-go-to')).toHaveTextContent(
      'The commit-trace lens is footprint-explainable-ui — mount its ExplainableShell over the run’s snapshot for that reading. ' +
        'To get a recording, record the run: recordRun(agent) from agentfootprint/observe captures exactly what this viewer replays.',
    );
  });

  it('config mistakes throw at mount instead (a typo never ships)', () => {
    // React logs the thrown error; silence the noise for this assertion.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <FootprintViewer
          source={{ kind: 'recording', data: skill }}
          config={{ lenses: ['flowchart' as never] }}
        />,
      ),
    ).toThrowError(/"flowchart" is not a lens this viewer knows/);
    errSpy.mockRestore();
  });
});

describe("the Story peer, lazily: declared without install → the teaching card", () => {
  it('renders the package-not-installed card, verbatim, and only in that tab', async () => {
    __setStoryModuleLoaderForTests(() => Promise.resolve(null));
    mountReady(skill, { lenses: ['story', 'data'], landing: 'story' });
    const card = await screen.findByTestId('viewer-refusal');
    expect(card).toHaveTextContent('Footprint Viewer · Story Lens · package not installed');
    expect(card).toHaveTextContent('This tab is the Story Lens, which lives in agentthinkingui.');
    expect(card).toHaveTextContent('What this app has installed does not include agentthinkingui.');
    expect(card).toHaveTextContent(
      "npm install agentthinkingui — or remove 'story' from lenses. Nothing else changes.",
    );
    // The other tabs work untouched.
    fireEvent.click(screen.getByTestId('viewer-tab-data'));
    expect(await screen.findByTestId('viewer-data')).toBeInTheDocument();
  });
});

// The slot panes used by the capability audit tests. Named so the audit's
// suggestion reads exactly as the design page prints it.
function MyPane(props: ViewerPaneProps): React.ReactElement {
  return <div data-testid="my-pane">step {props.step}</div>;
}
function TracingPane(props: ViewerPaneProps): React.ReactElement {
  return <div data-testid="tracing-pane">{props.tracing.keys.length} keys here</div>;
}

const AUDIT_LINE =
  'footprint-viewer: the detail slot replaced the shipped inspector, and the replacement never used `tracing` — ' +
  'value-click tracing is now unreachable from this pane. The shipped pane offers it; if dropping it is intended, ' +
  "say so: slots: { detail: { component: MyPane, drops: ['tracing'] } }.";

describe('capability-accounted slots', () => {
  it('a pane that never reads `tracing` gets ONE named console line — the design sentence, verbatim', async () => {
    mountReady(skill, { landing: 'flow', slots: { detail: MyPane } });
    await screen.findByTestId('my-pane');
    await waitFor(() => {
      const lines = warnSpy.mock.calls.flat().filter((m: unknown) => m === AUDIT_LINE);
      expect(lines).toHaveLength(1);
    });
  });

  it("declaring drops: ['tracing'] silences the audit", async () => {
    mountReady(skill, {
      landing: 'flow',
      slots: { detail: { component: MyPane, drops: ['tracing'] } },
    });
    await screen.findByTestId('my-pane');
    expect(warnSpy.mock.calls.flat()).not.toContain(AUDIT_LINE);
  });

  it('a pane that USES tracing is never warned about', async () => {
    mountReady(skill, { landing: 'flow', slots: { detail: TracingPane } });
    await screen.findByTestId('tracing-pane');
    expect(
      warnSpy.mock.calls.flat().filter((m: unknown) => String(m).includes('never used `tracing`')),
    ).toHaveLength(0);
  });
});

// A pane that can move the cursor and show what it received — the carry probe.
function ProbePane(props: ViewerPaneProps): React.ReactElement {
  return (
    <div>
      <div data-testid="pane-step">{props.step}</div>
      <div data-testid="pane-commit">{props.commitIdx}</div>
      <div data-testid="pane-gran">{props.axis.granularity}</div>
      <div data-testid="pane-keys">{props.tracing.keys.length}</div>
      <button data-testid="pane-go" onClick={() => props.onNavigate(2)}>
        go to step 2
      </button>
    </div>
  );
}

describe('one cursor, carried across tabs by commit index', () => {
  it('a move on Flow lands the Why tab on the same moment, and data-cursor-* says so', async () => {
    mountReady(skill, { landing: 'flow', slots: { detail: ProbePane } });
    await screen.findByTestId('pane-step');

    fireEvent.click(screen.getByTestId('pane-go'));
    await waitFor(() =>
      expect(screen.getByTestId('pane-step')).toHaveTextContent(/^2$/),
    );

    const ready = screen.getByTestId('viewer-ready');
    expect(ready.getAttribute('data-cursor-step')).toBe('2');
    const heldCommit = Number(ready.getAttribute('data-cursor-commit'));

    // The independent truth: the same axes, computed outside the viewer.
    const observed = observeRecording(skill);
    const commitAxis = scrubAxisFor(observed.recorder, 'step');
    expect(heldCommit).toBe(commitAxis[2]!.commitIdx);
    const groupAxis = scrubAxisFor(observed.recorder, 'group');
    const expectedWhyStep = stepForCommitIdx(groupAxis, heldCommit);

    fireEvent.click(screen.getByTestId('viewer-tab-why'));
    await waitFor(() =>
      expect(screen.getByTestId('pane-gran')).toHaveTextContent('group'),
    );
    expect(screen.getByTestId('pane-step')).toHaveTextContent(String(expectedWhyStep));
    // The held position (and its commit anchor) survived the switch.
    expect(ready.getAttribute('data-cursor-commit')).toBe(String(heldCommit));
  });
});
