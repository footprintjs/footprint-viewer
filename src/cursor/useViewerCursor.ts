/**
 * THE cursor — one position, held above all tabs, carried across axes by the
 * one unit both counts share: the commit index. Flow counts every step; Why
 * counts the agent's own moments; the Skill Graph rides the routing stops.
 * Switching tabs keeps your place, always, and there is no setting that
 * breaks this.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  resolveNavigation,
  scrubAxisFor,
  stepForCommitIdx,
  stepForRuntimeStageId,
  type LensCursorAt,
} from 'agentfootprint-lens/why';
import type { LensRecorder } from 'agentfootprint-lens/core';

import type { LensId, ViewerCursor, ViewerNavigationReport } from '../config/types.js';

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
  /** What became of the `initialAt` address, or `null` when none was given.
   *  A MISS is a value here, not a silence — see `initialAt` in ViewerConfig. */
  readonly navigation: ViewerNavigationReport | null;
}

/** The sentence for an address that DID land. The lens supplies the words for
 *  a refusal; a landing is ours to say, in the same grammar. */
function arrivalSentence(
  requested: string,
  landedOn: { runtimeStageId: string; step: number; label: string },
  total: number,
  exact: boolean,
): string {
  if (exact) {
    return `"${requested}" is step ${String(landedOn.step + 1)} of ${String(total)} (${landedOn.label}).`;
  }
  return (
    `"${requested}" is inside a scope this ruler shows as one stop, so the cursor is on that scope — ` +
    `"${landedOn.runtimeStageId}", step ${String(landedOn.step + 1)} of ${String(total)} (${landedOn.label}). ` +
    `Near, and not the stop you named.`
  );
}

export function useViewerCursor(args: {
  readonly recorder: LensRecorder;
  readonly onCursor?: ((at: ViewerCursor) => void) | undefined;
  /** An address to open on, resolved ONCE against this run's own ruler. The
   *  lens is already decided by the time this is handed over (the resolver
   *  lets an address name its tab), so it arrives as a required field. */
  readonly initialAt?: { readonly lens: LensId; readonly runtimeStageId: string } | undefined;
}): ViewerCursorHandle {
  const { recorder, onCursor } = args;
  const addressLens = args.initialAt?.lens;
  const address = args.initialAt?.runtimeStageId;

  const commitAxis = useMemo(() => scrubAxisFor(recorder, 'step'), [recorder]);

  /**
   * The address, resolved against the run's own ruler.
   *
   * `resolveNavigation` is agentfootprint-lens 0.42's, and the reason it is
   * worth the dependency is the shape of its answer: a miss carries NO step,
   * so "jump to something near enough" is not a thing this code could do by
   * accident. It offers the nearest stop; taking the offer is the host's call
   * and the host's alone.
   */
  const navigation = useMemo<ViewerNavigationReport | null>(() => {
    if (address === undefined) return null;
    const result = resolveNavigation(commitAxis, address);
    if (!result.ok) {
      return {
        requested: address,
        outcome: 'missed',
        ...(result.nearest !== undefined ? { nearest: { ...result.nearest } } : {}),
        message: result.message,
      };
    }
    const landedOn = { runtimeStageId: result.runtimeStageId, step: result.step, label: result.label };
    return {
      requested: address,
      outcome: result.match === 'exact' ? 'exact' : 'enclosing',
      landedOn,
      message: arrivalSentence(address, landedOn, commitAxis.length, result.match === 'exact'),
    };
  }, [commitAxis, address]);

  /**
   * The held position — SEEDED from the address, synchronously, at the first
   * render.
   *
   * Not in an effect, and the difference is not style. A tab's lens reports
   * its own opening position as it mounts; a seed applied afterwards is a race
   * against that report, and a deep link that lands four times out of five is
   * worse than one that does not exist. Seeded here, every tab renders at the
   * addressed step from its very first frame and there is nothing to race.
   *
   * A seed is also, by construction, ONCE per mount: `useState`'s initializer
   * runs once. `initialAt` seeds the cursor, it does not control it — dragging
   * a reader who has scrubbed away back to the host's address would be a
   * hijack rather than a deep link, so a host that means to navigate a MOUNTED
   * viewer remounts it (`key={address}`).
   *
   * A MISS seeds nothing: the cursor starts exactly where it would have with
   * no address at all.
   */
  const [held, setHeld] = useState<HeldCursor | null>(() => {
    const landedOn = navigation?.landedOn;
    if (landedOn === undefined || addressLens === undefined) return null;
    const position = commitAxis[landedOn.step];
    if (position === undefined) return null;
    return {
      at: {
        step: landedOn.step,
        totalSteps: commitAxis.length,
        runtimeStageId: position.runtimeStageId,
        commitIdx: position.commitIdx,
        label: position.label,
        kind: position.kind,
        lens: addressLens,
      },
      axis: 'step',
    };
  });

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

  /** The host asked a question and is owed the answer — once, on mount. */
  const reportedRef = useRef(false);
  useEffect(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    if (held !== null) onCursor?.(held.at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    navigation,
  };
}
