/**
 * Derive the story beats from a recording — the offline half of the Story
 * tab, and the "story derivable?" fact inference reads.
 *
 * The narration engine is agentfootprint's own `agentThinkingTrace` (the same
 * recorder a live run attaches), fed the recording's typed events replayed in
 * order. One engine, one voice — the viewer never invents its own beats. A
 * story that travels as its own parcel (the fetch source's `story` field)
 * always wins over this derivation.
 */

import { agentThinkingTrace } from 'agentfootprint/observe';
import type { Recording } from 'agentfootprint-lens/why';

import type { StoryTrace } from '../config/types.js';

interface RecordedEventLike {
  readonly type?: unknown;
  readonly payload?: unknown;
  readonly meta?: { readonly subflowPath?: unknown; readonly runId?: unknown };
}

/**
 * The recording's events, replayed through the story recorder. Returns
 * `undefined` when no beats derive (no events, or none the narration reads) —
 * which is exactly the Story tab's "empty" fact.
 */
export function storyFromRecording(
  recording: Recording,
  options: { readonly agent?: string } = {},
): StoryTrace | undefined {
  const events = recording.events;
  if (!Array.isArray(events) || events.length === 0) return undefined;
  try {
    const handle = agentThinkingTrace(options.agent ? { agent: options.agent } : {});
    for (const raw of events) {
      if (raw === null || typeof raw !== 'object') continue;
      const e = raw as RecordedEventLike;
      if (typeof e.type !== 'string') continue;
      // A recorded typed event ({ type, payload, meta }) worn as the emit
      // shape the recorder listens to ({ name, payload, pipelineId, … }).
      handle.onEmit?.({
        name: e.type,
        payload: e.payload,
        pipelineId: typeof e.meta?.runId === 'string' ? e.meta.runId : 'replay',
        subflowPath: e.meta?.subflowPath,
      } as never);
    }
    const trace = handle.getTrace();
    return trace.steps.length > 0 ? trace : undefined;
  } catch {
    // A malformed event log never crashes the viewer — the story is simply
    // not derivable, and the tab says so.
    return undefined;
  }
}
