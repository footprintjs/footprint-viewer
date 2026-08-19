/**
 * The Story tab — the run replayed as its own story, on agentthinkingui's
 * PLAYER: the scene (the agent, its thought bubbles, the rack of every tool it
 * could see with the picked one lit), the beat transport, and the notepad /
 * inspector panel beside them. That whole shell is the Story Lens's shape;
 * the notepad alone is one panel of it, and is still available on its own
 * (`story: { view: 'notepad' }`) for a reading with no scene.
 *
 * The package is the viewer's one OPTIONAL peer, imported lazily when this tab
 * first mounts: not installed → the teaching card, and nothing else changes.
 *
 * The player keeps its OWN transport by design — its beats are a narration,
 * not a step count, so Story is its own axis. Nothing here reads or moves the
 * viewer's shared cursor; the other tabs keep their place across a visit here
 * because that cursor lives above this component, untouched.
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { Recording } from 'agentfootprint-lens/why';

import type { StoryTrace, ViewerConfig, ViewerWarning } from '../config/types.js';
import { STORY_NOT_INSTALLED } from '../source/refusals.js';
import { loadStoryModule, type LoadedStory, type StoryModule } from '../story/loadStoryModule.js';
import { EmptyState } from './EmptyState.js';
import { TeachingCard } from './TeachingCard.js';

export interface StoryTabProps {
  readonly story: StoryTrace | undefined;
  /** The run itself. agentthinkingui 0.30+ reads a recording directly
   *  (`fromRecording`), and that reader is the narration this tab prefers —
   *  see `readNarration`. */
  readonly recording: Recording;
  /** `true` when `story` is the viewer's own derivation (which the package's
   *  own reader may replace); `false` when it is the producer's own parcel,
   *  which nothing here overwrites. */
  readonly derived: boolean;
  readonly view: 'player' | 'notepad';
  readonly theme: ViewerConfig['theme'];
  readonly appName: string | undefined;
  readonly onWarning: ((w: ViewerWarning) => void) | undefined;
}

type ModuleState =
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly loaded: LoadedStory }
  | { readonly state: 'missing' };

/** Which narrator wrote the beats on screen. Reported as an attribute so the
 *  answer is checkable from outside, like `data-cursor-*` on the root. */
type NarrationSource = 'library' | 'parcel' | 'viewer';

interface Narration {
  readonly trace: StoryTrace;
  readonly source: NarrationSource;
}

/**
 * WHO NARRATES — in preference order, and why.
 *
 * 1. `parcel` — the story travelled with the recording (the fetch source's
 *    `story` field). That is the producer's own voice, shipped deliberately;
 *    nothing here overwrites it.
 * 2. `library` — agentthinkingui's own `fromRecording` (0.30+). It is the
 *    package's reader for an ARCHIVED run, and it carries facts the viewer's
 *    own replay cannot reach: the run's real task line and model on the trace
 *    (the topbar's task pill reads them), and an ABSENT cost where nothing was
 *    measured instead of a `0.0s · 0 tok` that was never true.
 * 3. `viewer` — `storyFromRecording`, the viewer's own replay through
 *    agentfootprint's `agentThinkingTrace`. It stays for two jobs the library
 *    reader cannot do: it is SYNCHRONOUS and needs no optional peer, so it is
 *    what answers "does this run narrate at all?" for the tab strip and the
 *    stats — and it is the fallback under an agentthinkingui older than 0.30.
 *
 * A reader that throws is not an error here: it means this recording is not
 * one it can read, and the viewer's own beats are already in hand.
 */
function readNarration(
  mod: StoryModule | undefined,
  recording: Recording,
  derived: boolean,
  fallback: StoryTrace | undefined,
  agent: string | undefined,
): Narration | undefined {
  if (!derived) return fallback === undefined ? undefined : { trace: fallback, source: 'parcel' };
  if (mod?.fromRecording !== undefined) {
    try {
      const trace = mod.fromRecording(recording, agent === undefined ? {} : { agent });
      if (trace.steps.length > 0) return { trace, source: 'library' };
    } catch {
      // Not a recording this reader takes, or one it reads as beatless. The
      // viewer's own derivation is already here; use it.
    }
  }
  return fallback === undefined ? undefined : { trace: fallback, source: 'viewer' };
}

/**
 * One scrub position per RUN.
 *
 * agentthinkingui persists the beat under a key derived from the trace's own
 * title / agent / task — which two runs of the SAME agent share, so opening
 * run B would land on run A's beat. The run's own id is the honest key. A
 * recording that carries none keeps the package's default (the prop is
 * omitted, never nulled: losing the place on every tab switch is worse than a
 * key that could collide).
 */
function storyStorageKey(recording: Recording): string | undefined {
  const runId = (recording as { snapshot?: { runId?: unknown } }).snapshot?.runId;
  return typeof runId === 'string' && runId.length > 0
    ? `footprint-viewer.story:${runId}`
    : undefined;
}

/**
 * The atui SCOPE, supplied by the viewer — for the NOTEPAD view only.
 *
 * Every rule in agentthinkingui's stylesheet is written
 * `:where(.atui, .atui-swarm) …`, and the package's own PLAYER renders that
 * root element itself — which is why the player has always looked right and
 * the notepad has not. `<Notepad>` is a sub-component: mounted on its own it
 * has no `.atui` ancestor, so all 748 rules miss and the story renders as
 * unstyled text. It looks like a missing stylesheet and is not one; the
 * stylesheet was there the whole time, addressing nothing.
 *
 * So the viewer supplies the scope, and with it the theme variables the root
 * would have carried (`AgentTheme.toVars`) — the colours live on that element,
 * not on `:root`, in dark mode especially.
 */
function atuiScopeStyle(
  loaded: LoadedStory,
  mode: 'light' | 'dark' | undefined,
): React.CSSProperties {
  const theme = loaded.mod.AgentTheme;
  const base: React.CSSProperties = { height: '100%', minHeight: 0 };
  if (theme === undefined || mode === undefined) return base;
  try {
    return { ...base, ...(theme.toVars(theme.normalize({ mode })) as React.CSSProperties) };
  } catch {
    // A version whose theme namespace does not answer that call still gets
    // the scope, which is the half that decides styled-or-not.
    return base;
  }
}

/**
 * The room the player needs. `.atui` is `height: 100%`, so it takes whatever
 * the tab pane gives it — and the drill-in gives it the full pane. The floor
 * is for the short window: under it the pane scrolls instead of crushing the
 * scene, the transport and the panel into a strip.
 */
const PLAYER_MIN_HEIGHT = 560;

export function StoryTab(props: StoryTabProps): React.ReactElement {
  const [loaded, setLoaded] = useState<ModuleState>({ state: 'loading' });
  const [notepadView, setNotepadView] = useState<'notepad' | 'inspector'>('notepad');

  useEffect(() => {
    let alive = true;
    void loadStoryModule().then((story) => {
      if (!alive) return;
      if (story === null) {
        setLoaded({ state: 'missing' });
        props.onWarning?.({
          code: 'story-package-missing',
          lens: 'story',
          message:
            'footprint-viewer: the Story tab is declared but agentthinkingui is not installed — the tab teaches instead of narrating. npm install agentthinkingui, or remove \'story\' from lenses.',
        });
      } else {
        setLoaded({ state: 'ready', loaded: story });
        if (story.styles === 'unavailable') {
          // Said out loud rather than swallowed: the story will render, and it
          // will render unstyled, and an unstyled tab that nobody was told
          // about is the failure this viewer exists to end.
          props.onWarning?.({
            code: 'story-package-missing',
            lens: 'story',
            message:
              'footprint-viewer: agentthinkingui loaded but its stylesheet did not — the Story tab will render unstyled. ' +
              `Import 'agentthinkingui/styles.css' once in your app. (${story.stylesDetail ?? 'no detail'})`,
          });
        }
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hooks before the early returns, always — the module arrives asynchronously,
  // so the narration is re-read when it does.
  const mod = loaded.state === 'ready' ? loaded.loaded.mod : undefined;
  const narration = useMemo(
    () => readNarration(mod, props.recording, props.derived, props.story, props.appName),
    [mod, props.recording, props.derived, props.story, props.appName],
  );

  if (loaded.state === 'missing') {
    return (
      <TeachingCard
        eyebrow={STORY_NOT_INSTALLED.eyebrow}
        reads={STORY_NOT_INSTALLED.reads}
        receivedPrefix={STORY_NOT_INSTALLED.receivedPrefix}
        received={STORY_NOT_INSTALLED.received}
        goTo={STORY_NOT_INSTALLED.goTo}
      />
    );
  }

  if (props.story === undefined) return <EmptyState lens="story" />;

  if (loaded.state === 'loading') {
    return (
      <div data-testid="viewer-story-loading" style={{ padding: 14, opacity: 0.7, fontSize: 13 }}>
        Opening the story…
      </div>
    );
  }

  const { AgentThinkingUI, Notepad } = loaded.loaded.mod;
  const trace = narration?.trace ?? props.story;
  const storageKey = storyStorageKey(props.recording);

  if (props.view === 'notepad') {
    // The beats written out, with no scene — inside the scope its stylesheet is
    // written against (see `atuiScopeStyle`).
    return (
      <div
        data-testid="viewer-story-notepad"
        data-story-source={narration?.source ?? 'viewer'}
        className="atui"
        style={{ ...atuiScopeStyle(loaded.loaded, props.theme?.mode), minHeight: 240 }}
      >
        <Notepad
          trace={trace}
          index={trace.steps.length - 1}
          onCollapse={() => {}}
          view={notepadView}
          setView={setNotepadView}
        />
      </div>
    );
  }

  // The default: the whole player. It renders its own `.atui` root and stamps
  // its own theme variables there, so the manual scope the notepad needs is not
  // wanted here — a second one would only nest.
  //
  // `toolMenu="rack"` is the Story Lens's answer to "out of WHAT did it
  // choose?": every tool the model could see, in one column, the picked one lit
  // and pinned. The card menu summarises that as a count.
  return (
    <div
      data-testid="viewer-story-player"
      data-story-source={narration?.source ?? 'viewer'}
      style={{ height: '100%', minHeight: PLAYER_MIN_HEIGHT }}
    >
      <AgentThinkingUI
        trace={trace}
        toolMenu="rack"
        {...(props.theme?.mode !== undefined ? { theme: { mode: props.theme.mode } } : {})}
        {...(props.appName !== undefined ? { labels: { agent: props.appName } } : {})}
        {...(storageKey !== undefined ? { storageKey } : {})}
      />
    </div>
  );
}
