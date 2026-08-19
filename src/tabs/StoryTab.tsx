/**
 * The Story tab — narrated beats on agentthinkingui's player or notepad.
 * The package is the viewer's one OPTIONAL peer, imported lazily when this
 * tab first mounts: not installed → the teaching card, and nothing else
 * changes. The player keeps its own transport by design — its beats are a
 * narration, not a step count; forcing the one cursor onto them would invent
 * a correspondence the data doesn't carry.
 */

import React, { useEffect, useState } from 'react';

import type { StoryTrace, ViewerConfig, ViewerWarning } from '../config/types.js';
import { STORY_NOT_INSTALLED } from '../source/refusals.js';
import { loadStoryModule, type LoadedStory } from '../story/loadStoryModule.js';
import { EmptyState } from './EmptyState.js';
import { TeachingCard } from './TeachingCard.js';

export interface StoryTabProps {
  readonly story: StoryTrace | undefined;
  readonly view: 'notepad' | 'player';
  readonly theme: ViewerConfig['theme'];
  readonly appName: string | undefined;
  readonly onWarning: ((w: ViewerWarning) => void) | undefined;
}

type ModuleState =
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly loaded: LoadedStory }
  | { readonly state: 'missing' };

/**
 * The atui SCOPE, supplied by the viewer.
 *
 * Every rule in agentthinkingui's stylesheet is written
 * `:where(.atui, .atui-swarm) …`, and the package's own player renders that
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
  const trace = props.story;

  if (props.view === 'player') {
    return (
      <AgentThinkingUI
        trace={trace}
        {...(props.theme?.mode !== undefined ? { theme: { mode: props.theme.mode } } : {})}
        {...(props.appName !== undefined ? { labels: { agent: props.appName } } : {})}
      />
    );
  }

  // 'notepad' (the default): the whole journal, written out — inside the
  // scope its stylesheet is written against (see `atuiScopeStyle`).
  return (
    <div
      data-testid="viewer-story-notepad"
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
