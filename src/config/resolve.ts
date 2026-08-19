/**
 * The arbiter's decision pass: explicit config beats inference, inference
 * fills every absence, and the outcome is written down — as tab states, as
 * dev-mode report lines, and as a fully-resolved, JSON-serializable config
 * (`exportInferredConfig`) so today's inference can become tomorrow's pinned
 * file.
 */

import { observeRecording, readAgentRecording } from 'agentfootprint-lens/why';
import type { Recording, RecordingEnvelopeLike } from 'agentfootprint-lens/why';

import {
  ALL_LENSES,
  type LensId,
  type ResolvedViewerConfig,
  type StoryTrace,
  type ViewerConfig,
  type ViewerStats,
  type ViewerWarning,
} from './types.js';
import { inferCapabilities, type InferredCapabilities } from '../infer/inference.js';
import { storyFromRecording } from '../story/storyFromRecording.js';

/** One tab, decided: lit (has something to show), empty (stays and says so),
 *  or hidden (`whenEmpty: 'hide'` — a choice the config wrote down). */
export interface ResolvedTab {
  readonly id: LensId;
  readonly status: 'lit' | 'empty' | 'hidden';
}

export interface ViewerResolution {
  /** Every declared tab, in declared order — including hidden ones, so the
   *  record is complete; the strip renders the non-hidden. */
  readonly tabs: readonly ResolvedTab[];
  readonly landing: LensId;
  readonly resolved: ResolvedViewerConfig;
  readonly warnings: readonly ViewerWarning[];
  readonly stats: ViewerStats;
}

const TAB_TITLES: Record<LensId, string> = {
  story: 'Story',
  why: 'Why',
  flow: 'Flow',
  skillgraph: 'SkillGraph',
  data: 'Data',
};

/** Why each tab is on / empty, in the report's words. */
function inferenceLine(lens: LensId, caps: InferredCapabilities): string {
  const title = TAB_TITLES[lens];
  switch (lens) {
    case 'story':
      return caps.story.on
        ? `footprint-viewer: ${title} tab: on — this recording narrates as ${caps.story.beats} story beats`
        : `footprint-viewer: ${title} tab: empty — no story beats derive from this recording`;
    case 'why':
      return caps.why.on
        ? `footprint-viewer: ${title} tab: on — this recording carries ${caps.why.events} agent events`
        : `footprint-viewer: ${title} tab: empty — this recording carries no agent events`;
    case 'flow':
      return caps.flow.on
        ? `footprint-viewer: ${title} tab: on — this recording carries a commit log (${caps.flow.commits} commits)`
        : `footprint-viewer: ${title} tab: empty — this recording carries no commit log`;
    case 'skillgraph':
      return caps.skillgraph.on
        ? `footprint-viewer: ${title} tab: on — this recording carries skill routing`
        : `footprint-viewer: ${title} tab: empty — this recording carries no skill routing`;
    case 'data':
      return caps.data.on
        ? `footprint-viewer: ${title} tab: on — the run's own record (${caps.data.events} events, ${caps.data.commits} commits)`
        : `footprint-viewer: ${title} tab: empty — this recording carries no record at all`;
  }
}

/** The named degradation for a PINNED lens with nothing to show — the tab
 *  stays and says so itself. The skillgraph sentence is the design page's,
 *  verbatim; the others follow its grammar. */
function declaredButEmptyLine(lens: LensId): string {
  const tail = `The tab stays and says so itself; drop "${lens}" from lenses if this app never records one.`;
  switch (lens) {
    case 'skillgraph':
      return (
        'footprint-viewer: "skillgraph" is declared, but this recording carries no skill-routing events — ' +
        'the run never walked a skill graph. The tab stays and says so itself; drop "skillgraph" from lenses ' +
        'if this app never records one.'
      );
    case 'story':
      return `footprint-viewer: "story" is declared, but no story beats derive from this recording — there is nothing to narrate. ${tail}`;
    case 'why':
      return `footprint-viewer: "why" is declared, but this recording carries no agent events — there are no moments to group. ${tail}`;
    case 'flow':
      return `footprint-viewer: "flow" is declared, but this recording carries no commit log — there are no steps to walk. ${tail}`;
    case 'data':
      return `footprint-viewer: "data" is declared, but this recording carries no record at all. ${tail}`;
  }
}

/**
 * Decide everything: which tabs exist (config, else all five), which light up
 * (the recording), where the viewer opens, and every default. Also builds the
 * report — one sentence per inferred choice, one named degradation per pinned
 * tab with nothing to show.
 */
export function resolveViewer(
  config: ViewerConfig | undefined,
  caps: InferredCapabilities,
): ViewerResolution {
  const pinnedLenses = config?.lenses !== undefined;
  const exists: readonly LensId[] = config?.lenses ?? ALL_LENSES;

  const whenEmptyOf = (lens: LensId): 'say-so' | 'hide' => {
    if (lens === 'data') return 'say-so'; // the record always says so
    return config?.[lens]?.whenEmpty ?? 'say-so';
  };

  const warnings: ViewerWarning[] = [];
  const tabs: ResolvedTab[] = exists.map((id) => {
    if (caps[id].on) return { id, status: 'lit' as const };
    const status = whenEmptyOf(id) === 'hide' ? ('hidden' as const) : ('empty' as const);
    if (pinnedLenses && status === 'empty') {
      warnings.push({ code: 'declared-but-empty', lens: id, message: declaredButEmptyLine(id) });
    }
    return { id, status };
  });

  if (!pinnedLenses) {
    for (const id of exists) {
      warnings.push({ code: 'inference', lens: id, message: inferenceLine(id, caps) });
    }
  }

  const visible = tabs.filter((t) => t.status !== 'hidden');
  const firstLit = visible.find((t) => t.status === 'lit') ?? visible[0];
  // An ADDRESS names its tab, and an address is more specific than a landing
  // preference: `landing` says "open here when nobody said otherwise", and a
  // deep link is somebody saying otherwise. `lens` (controlled) still wins
  // over both — that one is not a default at all, it is the host holding the
  // tab in its own hand.
  const addressed = config?.initialAt?.lens;
  const landing = addressed ?? config?.landing ?? firstLit?.id ?? exists[0]!;
  // Turning tracing off is allowed — and visible. This is the capability
  // that was once lost silently, so silence is never how it goes away.
  if (config?.flow?.tracing === false) {
    warnings.push({
      code: 'config-choice',
      lens: 'flow',
      message:
        'footprint-viewer: flow.tracing is off — value-click tracing will not be offered on the Flow tab or handed to the detail slot. On is the default; this line exists because losing tracing silently is the incident this viewer ends.',
    });
  }

  if (addressed !== undefined && config?.landing !== undefined && config.landing !== addressed) {
    warnings.push({
      code: 'config-choice',
      lens: addressed,
      message:
        `footprint-viewer: landing: "${addressed}" — initialAt addressed that tab, so it wins over ` +
        `landing: "${config.landing}". An address is somebody saying where to open; landing is where to ` +
        `open when nobody did.`,
    });
  } else if (addressed === undefined && config?.landing === undefined) {
    warnings.push({
      code: 'inference',
      message: `footprint-viewer: landing: "${landing}" — the first tab with something to show`,
    });
  }

  const resolved: ResolvedViewerConfig = {
    lenses: [...exists],
    landing,
    why: {
      hideFrameworkSteps: config?.why?.hideFrameworkSteps ?? true,
      whenEmpty: config?.why?.whenEmpty ?? 'say-so',
    },
    flow: {
      tracing: config?.flow?.tracing ?? true,
      whenEmpty: config?.flow?.whenEmpty ?? 'say-so',
    },
    story: {
      view: config?.story?.view ?? 'player',
      whenEmpty: config?.story?.whenEmpty ?? 'say-so',
    },
    skillgraph: { whenEmpty: config?.skillgraph?.whenEmpty ?? 'say-so' },
    showTabs: config?.showTabs ?? true,
  };

  const stats: ViewerStats = {
    events: caps.data.events,
    commits: caps.data.commits,
    storyBeats: caps.story.beats,
    skillRouting: caps.skillgraph.on,
  };

  return { tabs, landing, resolved, warnings, stats };
}

/**
 * Today's inference as tomorrow's pinned file: the fully-resolved
 * ViewerConfig for one recording, as a JSON-serializable object. Feed it back
 * as `config` and the resolution is identical — that is the contract, and a
 * test holds it. (`source`, `humanizer`, `slots` and the callbacks are the
 * app's own hands; they cannot travel as JSON and are not part of it.)
 *
 * Also available inside the viewer: in dev mode the built-in tab strip shows
 * a "pin config" affordance that prints this same JSON.
 */
export function exportInferredConfig(
  recording: Recording | RecordingEnvelopeLike,
  config?: ViewerConfig,
  extras?: { readonly story?: StoryTrace },
): ResolvedViewerConfig {
  const verdict = readAgentRecording(recording);
  if (!verdict.ok) {
    throw new Error(
      `footprint-viewer: exportInferredConfig needs a recording — what you passed looks like ${verdict.received}.`,
    );
  }
  const observed = observeRecording(verdict.recording);
  const story =
    extras?.story ?? storyFromRecording(verdict.recording, { agent: config?.appName });
  const caps = inferCapabilities({
    recording: verdict.recording,
    recorder: observed.recorder,
    story,
    live: false,
  });
  return resolveViewer(config, caps).resolved;
}
