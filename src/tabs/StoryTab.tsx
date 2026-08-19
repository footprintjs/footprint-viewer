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
import { loadStoryModule, type StoryModule } from '../story/loadStoryModule.js';
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
  | { readonly state: 'ready'; readonly mod: StoryModule }
  | { readonly state: 'missing' };

export function StoryTab(props: StoryTabProps): React.ReactElement {
  const [loaded, setLoaded] = useState<ModuleState>({ state: 'loading' });
  const [notepadView, setNotepadView] = useState<'notepad' | 'inspector'>('notepad');

  useEffect(() => {
    let alive = true;
    void loadStoryModule().then((mod) => {
      if (!alive) return;
      if (mod === null) {
        setLoaded({ state: 'missing' });
        props.onWarning?.({
          code: 'story-package-missing',
          lens: 'story',
          message:
            'footprint-viewer: the Story tab is declared but agentthinkingui is not installed — the tab teaches instead of narrating. npm install agentthinkingui, or remove \'story\' from lenses.',
        });
      } else {
        setLoaded({ state: 'ready', mod });
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

  const { AgentThinkingUI, Notepad } = loaded.mod;
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

  // 'notepad' (the default): the whole journal, written out.
  return (
    <div data-testid="viewer-story-notepad" style={{ minHeight: 240 }}>
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
