/**
 * The viewer's refusal voice — one set of sentences, reused from the lens
 * doors wherever the doors export them, pinned verbatim in tests.
 *
 * The card grammar is the doors' three-sentence order:
 *   1. what this viewer reads
 *   2. what you passed looks like   (named, not guessed at — describeReceived)
 *   3. where to go                  (the teaching half)
 *
 * `readAgentRecording` and `describeReceived` are IMPORTED from
 * `agentfootprint-lens/why` (via loadSource.ts), never re-written, so a wrong
 * input gets the same naming at every door in the ecosystem.
 *
 * TODO(upstream ask, agentfootprint-lens): `REFUSAL_GO_TO` and
 * `DoorRefusalCard` live in src/doors/ but are not exported from the /why
 * door (only readAgentRecording / describeReceived / isAgentRecording are).
 * The two "where to go" sentences below are a local mirror of
 * `REFUSAL_GO_TO`, with one word changed ("this lens replays" → "this viewer
 * replays" — the design page's wording). When lens exports them (ideally with
 * the replayer noun as a parameter), delete this mirror and import.
 */

import type { RecordingVerdict } from 'agentfootprint-lens/why';

/** Sentence 1 — what the viewer reads (decision 4's card, verbatim). */
export const VIEWER_READS =
  'This viewer reads a recording — { snapshot, events, structure } — or the envelope persistRecording writes around one.';

/** Sentence 1 for the URL source (decision 4's second card, verbatim). */
export const ENVELOPE_SOURCE_READS =
  'This source fetches a recording envelope — JSON whose format begins agentfootprint.recording.';

/** The doors' two "where to go" sentences (local mirror — see module TODO). */
export const GO_TO = {
  'commit-trace-lens':
    'The commit-trace lens is footprint-explainable-ui — mount its ExplainableShell over the run’s snapshot for that reading.',
  'record-the-run':
    'To get a recording, record the run: recordRun(agent) from agentfootprint/observe captures exactly what this viewer replays.',
} as const;

/** Sentence 3 for a refused inline source: the doors' destination sentence,
 *  and for a commit log BOTH halves — where that reading lives, then how to
 *  get the reading this viewer gives (the design page's card shows both). */
export function goToSentence(verdict: Extract<RecordingVerdict, { ok: false }>): string {
  if (verdict.goTo === 'commit-trace-lens') {
    return `${GO_TO['commit-trace-lens']} ${GO_TO['record-the-run']}`;
  }
  return GO_TO['record-the-run'];
}

/** Sentence 3 for the URL source (verbatim). */
export const URL_GO_TO =
  'If the server keeps the envelope at another path, point source.url there. persistRecording(...) writes exactly the file this source expects.';

/** The Story tab's package-not-installed card, all three sentences (verbatim). */
export const STORY_NOT_INSTALLED = {
  eyebrow: 'Footprint Viewer · Story Lens · package not installed',
  reads: 'This tab is the Story Lens, which lives in agentthinkingui.',
  received: 'does not include agentthinkingui',
  receivedPrefix: 'What this app has installed',
  goTo: "npm install agentthinkingui — or remove 'story' from lenses. Nothing else changes.",
} as const;

/** The card's eyebrow for wrong inputs. */
export const REFUSAL_EYEBROW = 'Footprint Viewer · not an input this viewer reads';

/**
 * Name what a URL answered with, when it was not the envelope. Mirrors the
 * doors' describeReceived posture: named, not guessed at.
 */
export function describeHttpReceived(status: number, contentType: string | null): string {
  const type = (contentType ?? '').split(';')[0]!.trim();
  if (type === 'text/html') return `an HTML page (HTTP ${status}, content-type text/html)`;
  if (type && type !== 'application/json') {
    return `a ${type} response (HTTP ${status})`;
  }
  return `an HTTP ${status} response with no JSON body`;
}
