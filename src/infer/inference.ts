/**
 * Per-recording inference — the amendment's default. The envelope is
 * self-describing: skill events present → SkillGraph lights up; story beats
 * derive → Story lights up; a commit log → Flow (with tracing); agent events
 * → Why; the record itself → Data. Inference decides what LIGHTS UP;
 * app-level config decides what EXISTS. Explicit config always beats
 * inference, and a pinned tab whose events are absent renders the honest
 * empty state instead of vanishing.
 */

import { selectSkillRoute } from 'agentfootprint-lens/skillgraph';
import type { LensRecorder } from 'agentfootprint-lens/core';
import type { Recording } from 'agentfootprint-lens/why';

import type { LensId, StoryTrace } from '../config/types.js';

/** What the recording carries, per tab — measured, never guessed. */
export interface InferredCapabilities {
  readonly story: { readonly on: boolean; readonly beats: number };
  readonly why: { readonly on: boolean; readonly events: number };
  readonly flow: { readonly on: boolean; readonly commits: number };
  readonly skillgraph: { readonly on: boolean };
  readonly data: { readonly on: boolean; readonly events: number; readonly commits: number };
}

function commitCount(recording: Recording): number {
  const snapshot = recording.snapshot as { commitLog?: readonly unknown[] } | null | undefined;
  return Array.isArray(snapshot?.commitLog) ? snapshot.commitLog.length : 0;
}

export function inferCapabilities(args: {
  readonly recording: Recording;
  readonly recorder: LensRecorder;
  readonly story: StoryTrace | undefined;
  readonly live: boolean;
}): InferredCapabilities {
  const events = Array.isArray(args.recording.events) ? args.recording.events.length : 0;
  const commits = commitCount(args.recording);
  const beats = args.story?.steps.length ?? 0;

  let skillRouting = false;
  try {
    skillRouting = selectSkillRoute({ log: args.recorder.selectEventLog() }).hasRouting;
  } catch {
    skillRouting = false;
  }

  // A live source has no frozen recording yet — the recorder is the truth,
  // and the run recorded so far deserves its tabs.
  const liveEvents = args.live ? args.recorder.selectEventLog().length : 0;

  return {
    story: { on: beats > 0, beats },
    why: { on: events > 0 || liveEvents > 0, events: events || liveEvents },
    flow: { on: commits > 0 || args.live, commits },
    skillgraph: { on: skillRouting },
    data: {
      on: events > 0 || commits > 0 || liveEvents > 0,
      events: events || liveEvents,
      commits,
    },
  };
}

/** Is this tab lit for this recording? */
export function capabilityOn(caps: InferredCapabilities, lens: LensId): boolean {
  return caps[lens].on;
}
