/**
 * Turn a ViewerSource into the one recording the viewer shows — or into the
 * honest refusal/gone/failed facts the screen renders instead. Validation
 * reuses the lens doors (`readAgentRecording`, `describeReceived`): one
 * refusal voice across the ecosystem.
 */

import {
  observeRecording,
  readAgentRecording,
  describeReceived,
  type Recording,
} from 'agentfootprint-lens/why';
import type { LensRecorder } from 'agentfootprint-lens/core';

import type { RunnerLike, StoryTrace, ViewerSource } from '../config/types.js';
import {
  ENVELOPE_SOURCE_READS,
  URL_GO_TO,
  VIEWER_READS,
  describeHttpReceived,
  goToSentence,
} from './refusals.js';

/** The three-sentence facts a teaching card renders. */
export interface RefusalFacts {
  readonly reads: string;
  readonly receivedPrefix: string;
  readonly received: string;
  readonly goTo: string;
}

export type LoadedSource =
  | {
      readonly state: 'ready';
      readonly recording: Recording;
      readonly recorder: LensRecorder;
      readonly runner: RunnerLike | undefined;
      readonly story: StoryTrace | undefined;
      readonly live: boolean;
    }
  | { readonly state: 'refused'; readonly refusal: RefusalFacts }
  /** The app said the recording is gone — its own sentence, shown verbatim. */
  | { readonly state: 'gone'; readonly message: string }
  | { readonly state: 'failed'; readonly message: string };

function ready(
  recording: Recording,
  story: StoryTrace | undefined,
): LoadedSource {
  const observed = observeRecording(recording);
  return {
    state: 'ready',
    recording,
    recorder: observed.recorder,
    runner: observed.runner as unknown as RunnerLike | undefined,
    story,
    live: false,
  };
}

function refuseInline(value: unknown): LoadedSource {
  const verdict = readAgentRecording(value);
  if (verdict.ok) throw new Error('refuseInline called on a readable recording');
  return {
    state: 'refused',
    refusal: {
      reads: VIEWER_READS,
      receivedPrefix: 'What you passed looks like',
      received: verdict.received,
      goTo: goToSentence(verdict),
    },
  };
}

/** Resolve one source. Never throws for a wrong INPUT — wrong inputs come
 *  back as `refused`/`gone`/`failed` facts for the screen to say. (Config
 *  mistakes throw earlier, in validate.ts — a typo should never ship.) */
export async function loadViewerSource(source: ViewerSource): Promise<LoadedSource> {
  if (source.kind === 'recording') {
    const verdict = readAgentRecording(source.data);
    if (!verdict.ok) return refuseInline(source.data);
    return ready(verdict.recording, undefined);
  }

  if (source.kind === 'live') {
    // v1 renders the run recorded so far; self-driving at the live edge is
    // v1.1. The recorder is the truth here — there is no frozen recording,
    // so panes receive an empty one and read through the recorder.
    return {
      state: 'ready',
      recording: { snapshot: null, events: null } as Recording,
      recorder: source.recorder,
      runner: source.runner,
      story: undefined,
      live: true,
    };
  }

  if (source.kind === 'fetch') {
    let parcel: { recording: unknown; story?: StoryTrace };
    try {
      parcel = await source.get();
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e && e.name === 'RecordingUnavailable') {
        return { state: 'gone', message: e.message ?? 'This recording is no longer available.' };
      }
      return {
        state: 'failed',
        message: e?.message ? String(e.message) : String(err),
      };
    }
    const verdict = readAgentRecording(parcel.recording);
    if (!verdict.ok) return refuseInline(parcel.recording);
    return ready(verdict.recording, parcel.story);
  }

  // kind === 'recording-envelope' — the viewer fetches.
  let response: Response;
  try {
    response = await fetch(source.url);
  } catch (err) {
    const e = err as { message?: string };
    return {
      state: 'failed',
      message: `Fetching ${source.url} failed: ${e?.message ? String(e.message) : String(err)}`,
    };
  }
  const contentType = response.headers.get('content-type');
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return {
      state: 'refused',
      refusal: {
        reads: ENVELOPE_SOURCE_READS,
        receivedPrefix: `What ${source.url} returned looks like`,
        received: describeHttpReceived(response.status, contentType),
        goTo: URL_GO_TO,
      },
    };
  }
  const verdict = readAgentRecording(parsed);
  if (!verdict.ok) {
    return {
      state: 'refused',
      refusal: {
        reads: ENVELOPE_SOURCE_READS,
        receivedPrefix: `What ${source.url} returned looks like`,
        received: describeReceived(parsed),
        goTo: URL_GO_TO,
      },
    };
  }
  return ready(verdict.recording, undefined);
}
