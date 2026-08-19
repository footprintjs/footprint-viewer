/**
 * THE cursor — one position, held above all tabs, carried across axes by the
 * one unit both counts share: the commit index. Flow counts every step; Why
 * counts the agent's own moments; the Skill Graph rides the routing stops.
 * Switching tabs keeps your place, always, and there is no setting that
 * breaks this.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  scrubAxisFor,
  stepForCommitIdx,
  stepForRuntimeStageId,
  type LensCursorAt,
} from 'agentfootprint-lens/why';
import type { LensRecorder } from 'agentfootprint-lens/core';

import type { LensId, ViewerCursor } from '../config/types.js';

interface HeldCursor {
  readonly at: ViewerCursor;
  /** The axis the position is native to — carrying into the OTHER axis goes
   *  through the commit index. */
  readonly axis: 'step' | 'group';
}

export interface ViewerCursorHandle {
  readonly cursor: ViewerCursor | null;
  /** A tab reporting its own move (the Lens onStepChange grammar). */
  reportFromLens(lens: LensId, axis: 'step' | 'group', at: LensCursorAt): void;
  /** The carried position for a tab: its own step when native, else resolved
   *  by commit index. `undefined` until someone moves (uncontrolled start). */
  stepFor(axis: 'step' | 'group'): number | undefined;
  /** A skill-graph jump — an address, resolved onto the commit axis. */
  moveToRuntimeStageId(lens: LensId, runtimeStageId: string): void;
  /** A commit-axis move by step number (the skill-graph transport). */
  moveToCommitAxisStep(lens: LensId, step: number): void;
  /** How many stops the commit axis has (the skill-graph transport's total). */
  readonly commitAxisTotal: number;
}

export function useViewerCursor(args: {
  readonly recorder: LensRecorder;
  readonly onCursor?: ((at: ViewerCursor) => void) | undefined;
}): ViewerCursorHandle {
  const { recorder, onCursor } = args;
  const [held, setHeld] = useState<HeldCursor | null>(null);

  const commitAxis = useMemo(() => scrubAxisFor(recorder, 'step'), [recorder]);

  const hold = useCallback(
    (next: HeldCursor) => {
      setHeld(next);
      onCursor?.(next.at);
    },
    [onCursor],
  );

  const reportFromLens = useCallback(
    (lens: LensId, axis: 'step' | 'group', at: LensCursorAt) => {
      hold({
        at: {
          step: at.step,
          totalSteps: at.totalSteps,
          runtimeStageId: at.runtimeStageId,
          commitIdx: at.commitIdx,
          label: at.label,
          ...(at.kind !== undefined ? { kind: at.kind } : {}),
          lens,
        },
        axis,
      });
    },
    [hold],
  );

  const stepFor = useCallback(
    (axis: 'step' | 'group'): number | undefined => {
      if (held === null) return undefined;
      if (held.axis === axis) return held.at.step;
      const positions = scrubAxisFor(recorder, axis);
      const step = stepForCommitIdx(positions, held.at.commitIdx);
      return step >= 0 ? step : 0;
    },
    [held, recorder],
  );

  const holdFromCommitAxis = useCallback(
    (lens: LensId, step: number) => {
      const position = commitAxis[step];
      if (!position) return;
      hold({
        at: {
          step,
          totalSteps: commitAxis.length,
          runtimeStageId: position.runtimeStageId,
          commitIdx: position.commitIdx,
          label: position.label,
          kind: position.kind,
          lens,
        },
        axis: 'step',
      });
    },
    [commitAxis, hold],
  );

  const moveToRuntimeStageId = useCallback(
    (lens: LensId, runtimeStageId: string) => {
      const step = stepForRuntimeStageId(commitAxis, runtimeStageId);
      if (step >= 0) holdFromCommitAxis(lens, step);
    },
    [commitAxis, holdFromCommitAxis],
  );

  return {
    cursor: held?.at ?? null,
    reportFromLens,
    stepFor,
    moveToRuntimeStageId,
    moveToCommitAxisStep: holdFromCommitAxis,
    commitAxisTotal: commitAxis.length,
  };
}
