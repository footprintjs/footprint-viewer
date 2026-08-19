/**
 * Wrong inputs are refused in the doors' voice — the three-sentence card
 * facts, pinned VERBATIM to the design page. The wrong shapes are cut from a
 * real run (demo/generate-plain-run.ts), never hand-authored.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadViewerSource } from './loadSource.js';
import {
  bareCommitLog,
  skillRun as loadSkill,
  skillRunEnvelope,
  snapshotOnly as loadSnapshotOnly,
} from '../test/fixtures.js';

const commitLog = bareCommitLog();
const snapshotOnly = loadSnapshotOnly();
const skillRun = loadSkill() as unknown as Record<string, unknown>;
const envelope = skillRunEnvelope();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('wrong source shapes — the teaching refusal, verbatim', () => {
  it('a bare commit log handed to source: { kind: "recording" }', async () => {
    const result = await loadViewerSource({ kind: 'recording', data: commitLog as never });
    expect(result.state).toBe('refused');
    if (result.state !== 'refused') return;
    expect(result.refusal.reads).toBe(
      'This viewer reads a recording — { snapshot, events, structure } — or the envelope persistRecording writes around one.',
    );
    expect(result.refusal.receivedPrefix).toBe('What you passed looks like');
    expect(result.refusal.received).toBe('a bare commit log (an array of commit bundles)');
    expect(result.refusal.goTo).toBe(
      'The commit-trace lens is footprint-explainable-ui — mount its ExplainableShell over the run’s snapshot for that reading. ' +
        'To get a recording, record the run: recordRun(agent) from agentfootprint/observe captures exactly what this viewer replays.',
    );
  });

  it('a footprintjs run snapshot (commit log, no agent events around it)', async () => {
    const result = await loadViewerSource({ kind: 'recording', data: snapshotOnly as never });
    expect(result.state).toBe('refused');
    if (result.state !== 'refused') return;
    expect(result.refusal.received).toBe(
      'a footprintjs run snapshot (a commit log, with no agent events around it)',
    );
    expect(result.refusal.goTo).toContain('footprint-explainable-ui');
  });

  it('a real recording is accepted, and the envelope unwraps', async () => {
    const direct = await loadViewerSource({ kind: 'recording', data: skillRun as never });
    expect(direct.state).toBe('ready');
    const wrapped = await loadViewerSource({ kind: 'recording', data: envelope as never });
    expect(wrapped.state).toBe('ready');
  });
});

describe('the URL answered with something else — verbatim', () => {
  it('an HTML page instead of the envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      })),
    );
    const result = await loadViewerSource({ kind: 'recording-envelope', url: '/api/runs/42' });
    expect(result.state).toBe('refused');
    if (result.state !== 'refused') return;
    expect(result.refusal.reads).toBe(
      'This source fetches a recording envelope — JSON whose format begins agentfootprint.recording.',
    );
    expect(result.refusal.receivedPrefix).toBe('What /api/runs/42 returned looks like');
    expect(result.refusal.received).toBe('an HTML page (HTTP 200, content-type text/html)');
    expect(result.refusal.goTo).toBe(
      'If the server keeps the envelope at another path, point source.url there. persistRecording(...) writes exactly the file this source expects.',
    );
  });

  it('a good envelope at the URL is read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => envelope,
      })),
    );
    const result = await loadViewerSource({ kind: 'recording-envelope', url: '/api/runs/1' });
    expect(result.state).toBe('ready');
  });
});

describe('the fetch-function source', () => {
  it('carries the recording and the story parcel', async () => {
    const story = { task: 't', agent: 'a', model: 'm', asker: 'you', steps: [] };
    const result = await loadViewerSource({
      kind: 'fetch',
      get: async () => ({ recording: skillRun as never, story: story as never }),
    });
    expect(result.state).toBe('ready');
    if (result.state !== 'ready') return;
    expect(result.story).toEqual(story);
  });

  it('RecordingUnavailable renders the app\'s own sentence, verbatim, as the gone-state', async () => {
    const result = await loadViewerSource({
      kind: 'fetch',
      get: async () => {
        const err = new Error('Turn evidence is kept for 24 hours; this one has aged out.');
        err.name = 'RecordingUnavailable';
        throw err;
      },
    });
    expect(result).toEqual({
      state: 'gone',
      message: 'Turn evidence is kept for 24 hours; this one has aged out.',
    });
  });

  it('any other rejection is the failed state, with the error named', async () => {
    const result = await loadViewerSource({
      kind: 'fetch',
      get: async () => {
        throw new Error('network down');
      },
    });
    expect(result).toEqual({ state: 'failed', message: 'network down' });
  });
});
