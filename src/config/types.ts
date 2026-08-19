/**
 * The viewer's whole API is this one config object. Every field except
 * `source` has a default, and every field's absence means something stated —
 * never "undefined behavior". Since the inference amendment, even the config
 * itself is optional: `<FootprintViewer source={...} />` with no config works,
 * and the viewer reads the recording to decide what lights up.
 */

import type * as React from 'react';
import type { Humanizer, LensRecorder } from 'agentfootprint-lens/core';
import type { Recording, RecordingEnvelopeLike } from 'agentfootprint-lens/why';
import type { AttTrace } from 'agentfootprint/observe';

/** The five readings, by name. Also the tab order vocabulary. */
export type LensId = 'story' | 'why' | 'flow' | 'skillgraph' | 'data';

/** Every lens this viewer knows, in the canon's default order:
 *  the story first, why next, every step for when those aren't enough. */
export const ALL_LENSES: readonly LensId[] = ['story', 'why', 'flow', 'skillgraph', 'data'];

/** Story beats when they travel as their own parcel (agentthinkingui's
 *  trace shape — what `agentThinkingTrace().getTrace()` returns). */
export type StoryTrace = AttTrace;

/** A runner-like handle, when a live source has one (drives the chart). */
export interface RunnerLike {
  getSpec(): { buildTimeStructure?: unknown };
}

/**
 * Where the recording comes from. One origin — naming two is an error that
 * names both sides (the AgentRecipe rule, applied to viewing).
 */
export type ViewerSource =
  // fetched by the viewer; expects the persistRecording envelope
  // (format 'agentfootprint.recording.v1' — any .v*), or the bare
  // recording as JSON
  | { kind: 'recording-envelope'; url: string }
  // already in hand: { snapshot, events, structure }, or the envelope
  // object around one
  | { kind: 'recording'; data: Recording | RecordingEnvelopeLike }
  // a live recorder handle from observeRecording / recordRun
  | { kind: 'live'; recorder: LensRecorder; runner?: RunnerLike }
  // the app owns transport (tickets, auth, retries). May also carry story
  // beats when they travel as their own parcel. Reject with
  // { name:'RecordingUnavailable', message } and the viewer shows that
  // message verbatim in its gone-state.
  | {
      kind: 'fetch';
      get: () => Promise<{
        recording: Recording | RecordingEnvelopeLike;
        story?: StoryTrace;
      }>;
    };

/** A declared lens with nothing to show: say so on screen, or shorten the
 *  strip. `'say-so'` is the default — absence is a rendered fact. */
export type WhenEmpty = 'say-so' | 'hide';

/** What a replacement pane may deliberately leave out. Undeclared drops are
 *  named in dev mode after the pane's first render. */
export type PaneCapability = 'tracing' | 'whereFrom' | 'copyForLLM';

/** The value-click tracing walk (Same-Rail Rewind), as the slot receives it. */
export interface PaneTracing {
  /** What this stage wrote (the keys a value-click can start from). */
  readonly keys: readonly string[];
  /** Enter the walk on one key; the ruler moves to that key's last writer. */
  start(key: string): void;
  /** The walk under way, when there is one. `stop` counts from 1. */
  readonly active?: { key: string; stop: number; of: number };
  prev(): void;
  next(): void;
  done(): void;
}

/** Which axis this mount serves, and the carry into it. */
export interface PaneAxis {
  /** 'step' = the Flow tab (every step); 'group' = the Why tab (moments). */
  readonly granularity: 'step' | 'group';
  /** Resolve a commit-log index to this axis's step (-1 = before the axis). */
  stepForCommit(commitIdx: number): number;
}

/** The full prop contract a replacement pane receives — every capability the
 *  shipped pane had. Capabilities it never reads are named in dev mode,
 *  unless the replacement declares the drop. */
export interface ViewerPaneProps {
  // ── THE cursor, in the three units every built-in reads ──
  /** Position on this tab's axis. */
  readonly step: number;
  readonly totalSteps: number;
  /** The footprintjs address. */
  readonly runtimeStageId: string;
  /** The unit that carries across tabs. */
  readonly commitIdx: number;
  readonly label: string;
  readonly kind?: string;
  /** The ONE way to move the cursor. */
  onNavigate(step: number): void;

  // ── the capability entries the shipped pane mounts ──
  readonly tracing: PaneTracing;
  readonly axis: PaneAxis;

  // ── the run itself, for anything else the pane reads ──
  readonly recording: Recording;
  readonly recorder: LensRecorder;
}

/** A replacement pane: the component alone, or the component plus a written
 *  declaration of what it deliberately leaves out (which silences dev mode). */
export type PaneSlot =
  | React.ComponentType<ViewerPaneProps>
  | {
      component: React.ComponentType<ViewerPaneProps>;
      drops?: readonly PaneCapability[];
    };

export interface ViewerSlots {
  /** The inspector column inside Flow and Why (the lens shell's own detail
   *  slot, threaded through). It receives the axis it is mounted on, so one
   *  component can serve both tabs. */
  readonly detail?: PaneSlot;
}

/** The one cursor, as reported out — one position, three units, plus which
 *  tab reported it. */
export interface ViewerCursor {
  readonly step: number;
  readonly totalSteps: number;
  readonly runtimeStageId: string;
  readonly commitIdx: number;
  readonly label: string;
  readonly kind?: string;
  readonly lens: LensId;
}

/** Counts, named — what the recording carries, as the viewer measured it. */
export interface ViewerStats {
  readonly events: number;
  readonly commits: number;
  readonly storyBeats: number;
  readonly skillRouting: boolean;
}

/** Every dev sentence, as data — the same words the console gets. */
export interface ViewerWarning {
  readonly code:
    | 'inference'
    | 'declared-but-empty'
    | 'config-choice'
    | 'slot-capability-dropped'
    | 'story-package-missing';
  readonly lens?: LensId;
  readonly message: string;
}

export interface ViewerConfig {
  /**
   * Where the recording comes from. The only field with no default — but it
   * may arrive as the component's `source` prop instead of here. One origin;
   * naming two is an error.
   */
  source?: ViewerSource;

  /**
   * Which readings EXIST, in tab order. Absent: all five —
   * ['story','why','flow','skillgraph','data'] — and the recording decides
   * which light up. A declared (pinned) lens always keeps its tab; when the
   * recording has nothing for it, the tab renders the honest empty state
   * instead of vanishing.
   */
  lenses?: readonly LensId[];

  /** The tab that opens first. Absent: the first declared lens that has
   *  something to show. */
  landing?: LensId;

  /** Per-lens options. Each block absent = the defaults shown. */
  why?: {
    /** Hide the framework's own plumbing steps (cache, routing, bookkeeping)
     *  from the grouped reading. Absent: true — the Why reading is for
     *  people. Flow has no such switch: "every step" is its name. */
    hideFrameworkSteps?: boolean;
    whenEmpty?: WhenEmpty; // absent: 'say-so'
  };
  flow?: {
    /** Click-a-value tracing (Same-Rail Rewind). Absent: TRUE — this is the
     *  capability that was once lost silently, so its default is on, and
     *  turning it off is a visible line. */
    tracing?: boolean;
    whenEmpty?: WhenEmpty;
  };
  story?: {
    view?: 'notepad' | 'player'; // absent: 'notepad'
    whenEmpty?: WhenEmpty;
  };
  skillgraph?: { whenEmpty?: WhenEmpty };

  /** Light/dark plus the two chart colours (visited path, cursor). Absent:
   *  follows the reader's system setting, stock colours. One prop stamps all
   *  three libraries' token tiers. */
  theme?: { mode?: 'light' | 'dark'; visited?: string; current?: string };

  /** The app's own voice in commentary and in Copy-for-LLM text. Absent: the
   *  lens family's neutral voice. */
  appName?: string;
  humanizer?: Humanizer;

  /** Replace a pane without losing the wiring. */
  slots?: ViewerSlots;

  /** For hosts with their own tab chips: drive the strip from outside
   *  (controlled, like the cursor) and hide the built-in one. Absent: the
   *  viewer renders and drives its own strip. */
  lens?: LensId;
  onLensChange?: (next: LensId) => void;
  showTabs?: boolean; // absent: true

  /** Stay mounted but render nothing — keeps the fetched recording warm
   *  while the host shows something else. Absent: false. */
  hidden?: boolean;

  /** Reports out. All absent: nothing is reported, nothing changes. */
  onCursor?: (at: ViewerCursor) => void;
  onStats?: (s: ViewerStats | undefined) => void;
  onWarning?: (w: ViewerWarning) => void;
}

/**
 * The config with every choice made — what `exportInferredConfig` emits, and
 * what the resolver produces whether the choices were pinned or inferred.
 * JSON-serializable by construction: today's inference becomes tomorrow's
 * pinned file. (`source`, `humanizer`, `slots` and the callbacks are the
 * app's own hands — they cannot travel as JSON and are not part of it.)
 */
export interface ResolvedViewerConfig {
  lenses: LensId[];
  landing: LensId;
  why: { hideFrameworkSteps: boolean; whenEmpty: WhenEmpty };
  flow: { tracing: boolean; whenEmpty: WhenEmpty };
  story: { view: 'notepad' | 'player'; whenEmpty: WhenEmpty };
  skillgraph: { whenEmpty: WhenEmpty };
  showTabs: boolean;
}
