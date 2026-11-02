/** Deterministically separate wrapper readiness from the child Lens report. */
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeRecording, scrubAxisFor } from 'agentfootprint-lens/why';
import type { LensTabProps } from './tabs/LensTab.js';
import { FootprintViewer } from './FootprintViewer.js';
import { skillRun } from './test/fixtures.js';
import { readOpeningCursor, type CursorSnapshot } from './test/openingCursor.js';

const deferred = vi.hoisted(() => ({ report: undefined as (() => void) | undefined }));

// Only this file defers the child. navigation.test.tsx retains the real Lens.
// The actual Viewer and its cursor/navigation hook still run here.
vi.mock('./tabs/LensTab.js', async () => {
  const { useEffect } = await import('react');
  const { scrubAxisFor } = await import('agentfootprint-lens/why');
  return {
    LensTab(props: LensTabProps) {
      useEffect(() => {
        deferred.report = () => {
          const axis = scrubAxisFor(props.recorder, props.granularity);
          const step = props.cursor.stepFor(props.granularity) ?? axis.length - 1;
          const position = axis[step]!;
          props.cursor.reportFromLens(props.lens, props.granularity, {
            step,
            totalSteps: axis.length,
            runtimeStageId: position.runtimeStageId,
            commitIdx: position.commitIdx,
            label: position.label,
            kind: position.kind,
            clamped: false,
          });
        };
        return () => { deferred.report = undefined; };
      }, [props.cursor, props.granularity, props.lens, props.recorder]);
      return null;
    },
  };
});

const skill = skillRun();
const source = { kind: 'recording', data: skill } as const;
const axis = scrubAxisFor(observeRecording(skill).recorder, 'step');

afterEach(() => {
  cleanup();
  deferred.report = undefined;
  vi.restoreAllMocks();
});

async function readAfterDeferredOpening(): Promise<CursorSnapshot> {
  const ready = await screen.findByTestId('viewer-ready');
  // This is wrapper readiness, explicitly NOT a promise of a settled cursor.
  expect(ready.getAttribute('data-cursor-stage')).toBe('');
  const reading = readOpeningCursor(ready);
  let observed: CursorSnapshot | undefined;
  void reading.then((value) => { observed = value; });
  await act(async () => { await Promise.resolve(); });
  expect(observed).toBeUndefined();
  await waitFor(() => expect(deferred.report).toBeTypeOf('function'));
  act(() => { deferred.report!(); });
  return reading;
}

describe('opening cursor synchronization', () => {
  it('waits for BOTH delayed Lens openings before comparing a miss with no address', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<FootprintViewer source={source} config={{
      initialAt: { lens: 'flow', runtimeStageId: 'call-llm#9999' },
    }} />);
    const withMiss = await readAfterDeferredOpening();
    cleanup();
    render(<FootprintViewer source={source} config={{ landing: 'flow' }} />);
    const control = await readAfterDeferredOpening();
    expect(withMiss).toEqual(control);
    expect(control.stage).toBe(axis[axis.length - 1]!.runtimeStageId);
  });

  it('does not hide a genuinely different valid addressed cursor', async () => {
    const target = axis[0]!;
    expect(target.runtimeStageId).not.toBe(axis[axis.length - 1]!.runtimeStageId);
    render(<FootprintViewer source={source} config={{
      initialAt: { lens: 'flow', runtimeStageId: target.runtimeStageId },
    }} />);
    const addressed = await readOpeningCursor(await screen.findByTestId('viewer-ready'));
    expect(addressed.stage).toBe(target.runtimeStageId);
    cleanup();
    render(<FootprintViewer source={source} config={{ landing: 'flow' }} />);
    const control = await readAfterDeferredOpening();
    expect(addressed).not.toEqual(control);
  });
});
