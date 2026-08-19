/**
 * The Skill Graph tab — the routing stops, on the lens's own debugger. Its
 * honest empty state ("No skill graph ran here") is the debugger's own card,
 * so the viewer mounts it whether or not the recording routed: absence is the
 * lens's rendered fact, spoken once, in one voice.
 *
 * The transport rides the viewer's commit axis (`<Lens step onStepChange>`'s
 * grammar, the same numbers as Flow), and a node jump comes back as an
 * address the cursor resolves — one cursor, everywhere.
 */

import React, { useCallback } from 'react';
import { SkillGraphDebugger } from 'agentfootprint-lens/skillgraph';
import type { LensRecorder } from 'agentfootprint-lens/core';

import type { ViewerCursorHandle } from '../cursor/useViewerCursor.js';

export interface SkillGraphTabProps {
  readonly recorder: LensRecorder;
  readonly cursor: ViewerCursorHandle;
}

export function SkillGraphTab(props: SkillGraphTabProps): React.ReactElement {
  const { cursor } = props;
  const onJumpTo = useCallback(
    (runtimeStageId: string) => cursor.moveToRuntimeStageId('skillgraph', runtimeStageId),
    [cursor],
  );
  const onStepChange = useCallback(
    (step: number) => cursor.moveToCommitAxisStep('skillgraph', step),
    [cursor],
  );

  return (
    <SkillGraphDebugger
      recorder={props.recorder}
      cursorRuntimeStageId={cursor.cursor?.runtimeStageId ?? ''}
      {...(cursor.cursor?.kind !== undefined ? { cursorKind: cursor.cursor.kind } : {})}
      onJumpTo={onJumpTo}
      step={cursor.stepFor('step') ?? 0}
      totalSteps={cursor.commitAxisTotal}
      onStepChange={onStepChange}
      transportKeyboard={false}
    />
  );
}
