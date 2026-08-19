/**
 * The bridge between the lens shell's detail slot and the viewer's slot
 * contract: a replacement pane receives EVERY capability the shipped pane
 * had — the one cursor in its three units, the tracing walk, the axis it is
 * mounted on — so replacing a pane can never silently lose the wiring.
 *
 * In dev, the capability entries are access-tracked (slots/capability.ts);
 * a pane that never reads one gets a single named console line after its
 * first render, silenced only by declaring `drops`.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { scrubAxisFor, stepForCommitIdx } from 'agentfootprint-lens/why';
import type { LensDetailSlotProps, Recording } from 'agentfootprint-lens/why';
import type { LensRecorder } from 'agentfootprint-lens/core';

import type { PaneSlot, PaneTracing, ViewerPaneProps, ViewerWarning } from '../config/types.js';
import { isDevMode } from '../infer/report.js';
import { commitLogOf, useTracingWalk } from '../tracing/tracingWalk.js';
import {
  TRACKED_CAPABILITIES,
  capabilityAuditLine,
  componentNameOf,
  normalizePaneSlot,
  trackAccess,
} from './capability.js';

const DISABLED_TRACING: PaneTracing = {
  keys: [],
  start: () => {},
  prev: () => {},
  next: () => {},
  done: () => {},
};

export interface DetailSlotBridgeArgs {
  readonly slot: PaneSlot;
  /** Which tab this mount serves — 'step' (Flow) or 'group' (Why). */
  readonly granularity: 'step' | 'group';
  readonly recording: Recording;
  readonly recorder: LensRecorder;
  /** `flow.tracing` — false hands the pane a disabled walk (a written choice). */
  readonly tracingEnabled: boolean;
  readonly onWarning?: ((w: ViewerWarning) => void) | undefined;
}

/**
 * Build the component `<Lens slots={{ detail }}>` mounts. Call inside
 * `useMemo` keyed on the args that change a mount — the returned component
 * holds the walk state itself, so cursor moves and walk steps re-render
 * naturally without remounting the pane.
 */
export function makeDetailSlotBridge(
  args: DetailSlotBridgeArgs,
): React.ComponentType<LensDetailSlotProps> {
  const { component: Pane, drops } = normalizePaneSlot(args.slot);
  const commitLog = commitLogOf(args.recording);

  function ViewerDetailSlot(lensProps: LensDetailSlotProps): React.ReactElement {
    const positions = useMemo(
      () => scrubAxisFor(args.recorder, args.granularity),
      // The axis is a pure fold of the recording; for a frozen run it is
      // stable. totalSteps changing (live) re-derives it.
      [lensProps.totalSteps],
    );

    const walk = useTracingWalk({
      commitLog,
      commitIdx: lensProps.commitIdx,
      moveToCommit: (commitIdx) => {
        const step = stepForCommitIdx(positions, commitIdx);
        if (step >= 0) lensProps.onNavigate(step);
      },
    });
    const tracing = args.tracingEnabled ? walk : DISABLED_TRACING;

    // ── capability accounting (dev only) ──
    const accessed = useRef<Set<string>>(new Set());
    const trackedTracing = useMemo(() => {
      if (!isDevMode()) return tracing;
      return trackAccess(tracing, () => accessed.current.add('tracing'));
    }, [tracing]);

    const warnedRef = useRef(false);
    useEffect(() => {
      if (!isDevMode() || warnedRef.current) return;
      warnedRef.current = true;
      for (const entry of TRACKED_CAPABILITIES) {
        if (drops.includes(entry.capability)) continue;
        if (accessed.current.has(entry.capability)) continue;
        const message = capabilityAuditLine({
          slotName: 'detail',
          shippedPaneName: 'shipped inspector',
          capability: entry.capability,
          loss: entry.loss,
          componentName: componentNameOf(Pane),
        });
        // eslint-disable-next-line no-console
        console.warn(message);
        args.onWarning?.({ code: 'slot-capability-dropped', message });
      }
      // Audited once, after the replacement's first render.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const paneProps: ViewerPaneProps = {
      step: lensProps.step,
      totalSteps: lensProps.totalSteps,
      runtimeStageId: lensProps.cursorRuntimeStageId,
      commitIdx: lensProps.commitIdx,
      label: lensProps.label,
      ...(lensProps.kind !== undefined ? { kind: lensProps.kind } : {}),
      onNavigate: lensProps.onNavigate,
      tracing: trackedTracing,
      axis: {
        granularity: args.granularity,
        stepForCommit: (commitIdx) => stepForCommitIdx(positions, commitIdx),
      },
      recording: args.recording,
      recorder: lensProps.recorder,
    };

    return <Pane {...paneProps} />;
  }

  ViewerDetailSlot.displayName = 'ViewerDetailSlot';
  return ViewerDetailSlot;
}
