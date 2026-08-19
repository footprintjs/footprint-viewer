/**
 * The inference matrix over REAL generated fixtures (never hand-authored),
 * pin-beats-inference, the declared-but-empty degradation (verbatim), and
 * the export-the-inferred-config round trip.
 */

import { describe, expect, it } from 'vitest';
import { observeRecording } from 'agentfootprint-lens/why';
import type { Recording } from 'agentfootprint-lens/why';

import { plainRun as loadPlain, skillRun as loadSkill } from '../test/fixtures.js';

import { exportInferredConfig, resolveViewer } from './resolve.js';
import { inferCapabilities } from '../infer/inference.js';
import { storyFromRecording } from '../story/storyFromRecording.js';

const skillRun = loadSkill();
const plainRun = loadPlain();

function capsOf(recording: Recording) {
  const observed = observeRecording(recording);
  return inferCapabilities({
    recording,
    recorder: observed.recorder,
    story: storyFromRecording(recording),
    live: false,
  });
}

describe('the inference matrix', () => {
  it('a skill-routed run lights all five tabs', () => {
    const caps = capsOf(skillRun);
    expect(caps.story.on).toBe(true);
    expect(caps.why.on).toBe(true);
    expect(caps.flow.on).toBe(true);
    expect(caps.skillgraph.on).toBe(true);
    expect(caps.data.on).toBe(true);

    const { tabs, warnings } = resolveViewer(undefined, caps);
    expect(tabs.map((t) => `${t.id}:${t.status}`)).toEqual([
      'story:lit',
      'why:lit',
      'flow:lit',
      'skillgraph:lit',
      'data:lit',
    ]);
    const messages = warnings.map((w) => w.message);
    expect(messages).toContain(
      'footprint-viewer: SkillGraph tab: on — this recording carries skill routing',
    );
    expect(messages.some((m) => m.startsWith('footprint-viewer: Flow tab: on — this recording carries a commit log ('))).toBe(true);
    expect(messages.some((m) => m.startsWith('footprint-viewer: Story tab: on — this recording narrates as '))).toBe(true);
  });

  it('a plain run keeps the SkillGraph tab, empty and reported', () => {
    const caps = capsOf(plainRun);
    expect(caps.skillgraph.on).toBe(false);
    expect(caps.flow.on).toBe(true);
    expect(caps.why.on).toBe(true);

    const { tabs, warnings } = resolveViewer(undefined, caps);
    expect(tabs.find((t) => t.id === 'skillgraph')?.status).toBe('empty');
    expect(warnings.map((w) => w.message)).toContain(
      'footprint-viewer: SkillGraph tab: empty — this recording carries no skill routing',
    );
  });

  it('an empty recording lights nothing, and every tab says so', () => {
    const empty = { snapshot: null, events: [] } as unknown as Recording;
    const caps = capsOf(empty);
    const { tabs } = resolveViewer(undefined, caps);
    expect(tabs.every((t) => t.status === 'empty')).toBe(true);
  });

  it('the landing is the first tab with something to show, and is reported', () => {
    const caps = capsOf(plainRun);
    const resolution = resolveViewer(undefined, caps);
    expect(resolution.landing).toBe('story');
    expect(resolution.warnings.map((w) => w.message)).toContain(
      'footprint-viewer: landing: "story" — the first tab with something to show',
    );
    // With story out of the offer, the landing moves to the next lit tab.
    const pinned = resolveViewer({ lenses: ['skillgraph', 'why', 'flow'] }, caps);
    expect(pinned.landing).toBe('why'); // skillgraph is empty on the plain run
  });
});

describe('pin beats inference', () => {
  it('a pinned lens list decides what EXISTS; the recording only decides what lights up', () => {
    const caps = capsOf(skillRun);
    const { tabs } = resolveViewer({ lenses: ['flow', 'data'] }, caps);
    expect(tabs.map((t) => t.id)).toEqual(['flow', 'data']);
  });

  it('a pinned landing wins over inference', () => {
    const caps = capsOf(skillRun);
    expect(resolveViewer({ landing: 'data' }, caps).landing).toBe('data');
  });

  it('a pinned tab whose events are absent stays, says so, and the dev line is the design sentence, verbatim', () => {
    const caps = capsOf(plainRun);
    const { tabs, warnings } = resolveViewer({ lenses: ['skillgraph', 'flow'] }, caps);
    expect(tabs.find((t) => t.id === 'skillgraph')?.status).toBe('empty');
    expect(warnings.map((w) => w.message)).toContain(
      'footprint-viewer: "skillgraph" is declared, but this recording carries no skill-routing events — ' +
        'the run never walked a skill graph. The tab stays and says so itself; drop "skillgraph" from lenses ' +
        'if this app never records one.',
    );
  });

  it("whenEmpty: 'hide' is the written-down way to shorten the strip", () => {
    const caps = capsOf(plainRun);
    const { tabs } = resolveViewer(
      { lenses: ['skillgraph', 'flow'], skillgraph: { whenEmpty: 'hide' } },
      caps,
    );
    expect(tabs.find((t) => t.id === 'skillgraph')?.status).toBe('hidden');
  });
});

describe('defaults encode the incidents', () => {
  it('flow.tracing defaults TRUE; turning it off is a visible line', () => {
    const caps = capsOf(skillRun);
    expect(resolveViewer(undefined, caps).resolved.flow.tracing).toBe(true);
    const off = resolveViewer({ flow: { tracing: false } }, caps);
    expect(off.resolved.flow.tracing).toBe(false);
    expect(off.warnings.some((w) => w.code === 'config-choice' && w.message.includes('flow.tracing is off'))).toBe(true);
  });

  it("whenEmpty defaults 'say-so' everywhere", () => {
    const caps = capsOf(skillRun);
    const { resolved } = resolveViewer(undefined, caps);
    expect(resolved.why.whenEmpty).toBe('say-so');
    expect(resolved.flow.whenEmpty).toBe('say-so');
    expect(resolved.story.whenEmpty).toBe('say-so');
    expect(resolved.skillgraph.whenEmpty).toBe('say-so');
    expect(resolved.why.hideFrameworkSteps).toBe(true);
    // The Story tab's default reading is the whole player — the scene, the
    // transport and the notepad panel. The notepad alone is one panel of it,
    // and stays reachable as `story: { view: 'notepad' }`.
    expect(resolved.story.view).toBe('player');
    expect(resolveViewer({ story: { view: 'notepad' } }, caps).resolved.story.view).toBe('notepad');
  });
});

describe('export the inferred config', () => {
  it('round-trips: the exported JSON fed back as config resolves identically', () => {
    const exported = exportInferredConfig(skillRun);
    const roundTripped = exportInferredConfig(skillRun, exported);
    expect(roundTripped).toEqual(exported);

    // And the tab states are identical too — pinning changes nothing but
    // the reporting.
    const caps = capsOf(skillRun);
    const inferred = resolveViewer(undefined, caps);
    const pinned = resolveViewer(exported, caps);
    expect(pinned.tabs).toEqual(inferred.tabs);
    expect(pinned.landing).toBe(inferred.landing);
    expect(pinned.resolved).toEqual(inferred.resolved);
  });

  it('the export is pure JSON (structuredClone-safe, no functions)', () => {
    const exported = exportInferredConfig(plainRun);
    expect(JSON.parse(JSON.stringify(exported))).toEqual(exported);
  });

  it('refuses a non-recording with the doors\' naming', () => {
    expect(() => exportInferredConfig([1, 2, 3] as never)).toThrowError(
      /exportInferredConfig needs a recording — what you passed looks like /,
    );
  });
});
