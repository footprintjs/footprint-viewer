/**
 * The Flow and Why tabs — one component, two axes. Flow scrubs the commit
 * axis (every step; its name is its promise, it never hides anything); Why
 * scrubs the milestone axis (the agent's own moments, banded by iteration).
 * Both are the shipped `<Lens>` shell, controlled by the viewer's ONE cursor.
 */

import React, { useCallback, useMemo } from 'react';
import { Lens, type LensCursorAt, type Recording } from 'agentfootprint-lens/why';
import type { LensRecorder, Humanizer } from 'agentfootprint-lens/core';

import type { LensId, PaneSlot, RunnerLike, ViewerConfig, ViewerWarning } from '../config/types.js';
import type { ViewerCursorHandle } from '../cursor/useViewerCursor.js';
import { makeDetailSlotBridge } from '../slots/DetailSlotBridge.js';

export interface LensTabProps {
  readonly lens: Extract<LensId, 'flow' | 'why'>;
  readonly granularity: 'step' | 'group';
  readonly recording: Recording;
  readonly recorder: LensRecorder;
  readonly runner: RunnerLike | undefined;
  readonly cursor: ViewerCursorHandle;
  readonly detailSlot: PaneSlot | undefined;
  readonly tracingEnabled: boolean;
  readonly theme: ViewerConfig['theme'];
  readonly appName: string | undefined;
  readonly humanizer: Humanizer | undefined;
  readonly onWarning: ((w: ViewerWarning) => void) | undefined;
}

export function LensTab(props: LensTabProps): React.ReactElement {
  const { lens, granularity, cursor } = props;

  const onStepChange = useCallback(
    (_step: number, at: LensCursorAt) => cursor.reportFromLens(lens, granularity, at),
    [cursor, lens, granularity],
  );

  const detail = useMemo(
    () =>
      props.detailSlot
        ? makeDetailSlotBridge({
            slot: props.detailSlot,
            granularity,
            recording: props.recording,
            recorder: props.recorder,
            tracingEnabled: props.tracingEnabled,
            onWarning: props.onWarning,
          })
        : undefined,
    [props.detailSlot, granularity, props.recording, props.recorder, props.tracingEnabled, props.onWarning],
  );

  const step = cursor.stepFor(granularity);

  return (
    <Lens
      recorder={props.recorder}
      {...(props.runner !== undefined
        ? { runner: props.runner as unknown as NonNullable<Parameters<typeof Lens>[0]['runner']> }
        : {})}
      granularity={granularity}
      view="engineer"
      {...(props.theme
        ? {
            theme: {
              ...(props.theme.mode !== undefined ? { mode: props.theme.mode } : {}),
              ...(props.theme.visited !== undefined ? { visited: props.theme.visited } : {}),
              ...(props.theme.current !== undefined ? { current: props.theme.current } : {}),
            },
          }
        : {})}
      {...(props.appName !== undefined ? { appName: props.appName } : {})}
      {...(props.humanizer !== undefined ? { humanizer: props.humanizer } : {})}
      {...(step !== undefined ? { step } : {})}
      onStepChange={onStepChange}
      {...(detail !== undefined ? { slots: { detail } } : {})}
    />
  );
}
