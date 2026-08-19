/**
 * THE STORY TAB IS THE PLAYER.
 *
 * The tab once mounted `<Notepad>` on its own — the beats as a text list, and
 * nothing else. That is one panel of the Story Lens, not the Lens: the reading
 * is the whole shell — the scene (the agent, its thought bubbles, the rack of
 * every tool it could see with the picked one lit), the beat transport under
 * it, and the notepad / inspector beside it. Reported from a live dashboard,
 * where the Story tab was a wall of text.
 *
 * The first group mounts the REAL agentthinkingui over the generated skill-run
 * fixture, because "the scene is on screen" is not a claim a stub can make.
 * The rest hold WHO NARRATES, and the axis law: Story keeps its own beats, and
 * the viewer's shared cursor is not touched by a visit here.
 */

import React from 'react';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FootprintViewer } from './FootprintViewer.js';
import type { StoryTrace } from './config/types.js';
import { __setStoryModuleLoaderForTests, type LoadedStory } from './story/loadStoryModule.js';
import { skillRun } from './test/fixtures.js';

const source = { kind: 'recording', data: skillRun() } as const;

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
  __setStoryModuleLoaderForTests(undefined);
  cleanup();
});

/** The real package, mounted over the real fixture. */
async function mountRealPlayer(): Promise<HTMLElement> {
  render(<FootprintViewer source={source} config={{ landing: 'story' }} />);
  return screen.findByTestId('viewer-story-player');
}

describe('the whole player is what the Story tab mounts', () => {
  it('RED — the scene, the tool rack and the beat transport are all on screen', async () => {
    const player = await mountRealPlayer();

    // The scene: agentthinkingui's own root, and the arena the agent stands in.
    expect(player.querySelector('.atui')).not.toBeNull();
    expect(player.querySelector('.panel.stage')).not.toBeNull();
    expect(player.querySelector('.flowscene')).not.toBeNull();

    // The rack: every tool the model could see, in one column.
    expect(player.querySelector('.tr-list')).not.toBeNull();

    // The transport: the beat timeline, with its play control.
    expect(player.querySelector('.timeline')).not.toBeNull();
    expect(player.querySelector('.tl-btn.play')).not.toBeNull();

    // The panel: the notepad / inspector column beside the scene.
    expect(player.querySelector('.ws-insp')).not.toBeNull();
  });

  it('the rack names every tool the run could see, not a count', async () => {
    const player = await mountRealPlayer();
    const names = [...player.querySelectorAll('.tr-name')].map((n) => n.textContent);
    // The fixture's agent sees the skill door plus the two skill-gated tools.
    expect(names).toEqual(
      expect.arrayContaining(['read_skill', 'inspect_charge', 'issue_refund']),
    );
  });

  it('renders ONE notepad — the player already carries the panel', async () => {
    const player = await mountRealPlayer();
    // The viewer's own scoped notepad wrapper is the notepad-only reading; it
    // must not also be mounted under the player.
    expect(screen.queryByTestId('viewer-story-notepad')).toBeNull();
    // And exactly one `.atui` root: the player's own. A second would be the
    // viewer wrapping a scope around a component that renders its own.
    expect(player.querySelectorAll('.atui')).toHaveLength(1);
  });

  it('the beats come from agentthinkingui\'s own reader for an archived run', async () => {
    const player = await mountRealPlayer();
    expect(player.getAttribute('data-story-source')).toBe('library');
    // Which is the point of preferring it: the run's real task line reaches
    // the topbar, where the viewer's own replay left it blank.
    expect(player.querySelector('.task-pill')).not.toBeNull();
  });
});

/** A stand-in for the optional peer — the mounts, and whichever readers the
 *  case under test wants the installed version to have. */
function stubStory(over: Partial<LoadedStory['mod']> = {}): LoadedStory {
  return {
    mod: {
      AgentThinkingUI: (p: { trace: StoryTrace }) => (
        <div data-testid="stub-player" data-beats={p.trace.steps.length} />
      ),
      Notepad: () => <div data-testid="stub-notepad" />,
      ...over,
    },
    styles: 'loaded',
  };
}

describe('who narrates, and what happens when the reader is not there', () => {
  it('falls back to the viewer\'s own derivation under a package with no reader', async () => {
    // agentthinkingui 0.29 and earlier: the player is there, `fromRecording`
    // is not. The tab still narrates — from the viewer's own replay.
    __setStoryModuleLoaderForTests(() => Promise.resolve(stubStory()));
    render(<FootprintViewer source={source} config={{ landing: 'story' }} />);
    const player = await screen.findByTestId('viewer-story-player');
    expect(player.getAttribute('data-story-source')).toBe('viewer');
    expect(screen.getByTestId('stub-player').getAttribute('data-beats')).toBe('8');
  });

  it('a reader that refuses this recording is not an error — the viewer\'s beats stand', async () => {
    __setStoryModuleLoaderForTests(() =>
      Promise.resolve(
        stubStory({
          fromRecording: () => {
            throw new TypeError('fromRecording reads an agentfootprint recording');
          },
        }),
      ),
    );
    render(<FootprintViewer source={source} config={{ landing: 'story' }} />);
    const player = await screen.findByTestId('viewer-story-player');
    expect(player.getAttribute('data-story-source')).toBe('viewer');
    expect(screen.getByTestId('stub-player')).toBeTruthy();
  });

  it('a story that travelled as its own parcel is never overwritten', async () => {
    const parcel: StoryTrace = {
      task: 'the parcel',
      agent: 'shipped',
      model: 'shipped',
      asker: 'you',
      steps: [{ kind: 'answer', brain: 'the producer said so' }],
    } as unknown as StoryTrace;
    const reader = vi.fn();
    __setStoryModuleLoaderForTests(() =>
      Promise.resolve(stubStory({ fromRecording: reader as never })),
    );
    render(
      <FootprintViewer
        source={{
          kind: 'fetch',
          get: () => Promise.resolve({ recording: skillRun(), story: parcel }),
        }}
        config={{ landing: 'story' }}
      />,
    );
    const player = await screen.findByTestId('viewer-story-player');
    expect(player.getAttribute('data-story-source')).toBe('parcel');
    expect(screen.getByTestId('stub-player').getAttribute('data-beats')).toBe('1');
    // The producer's own voice: nothing re-reads the recording over it.
    expect(reader).not.toHaveBeenCalled();
  });

  it('not installed still teaches instead of narrating — and mounts no player', async () => {
    __setStoryModuleLoaderForTests(() => Promise.resolve(null));
    render(<FootprintViewer source={source} config={{ landing: 'story' }} />);
    await screen.findByTestId('viewer-refusal');
    expect(screen.queryByTestId('viewer-story-player')).toBeNull();
  });
});

describe('Story keeps its own axis', () => {
  it('a visit to Story leaves the shared cursor exactly where the other tabs left it', async () => {
    render(<FootprintViewer source={source} config={{ landing: 'flow' }} />);
    const root = await screen.findByTestId('viewer-ready');
    await waitFor(() => expect(root.getAttribute('data-cursor-commit')).not.toBe('-1'));
    const before = {
      step: root.getAttribute('data-cursor-step'),
      stage: root.getAttribute('data-cursor-stage'),
      commit: root.getAttribute('data-cursor-commit'),
    };

    await act(async () => {
      screen.getByTestId('viewer-tab-story').click();
    });
    await screen.findByTestId('viewer-story-player');

    await act(async () => {
      screen.getByTestId('viewer-tab-flow').click();
    });
    expect({
      step: root.getAttribute('data-cursor-step'),
      stage: root.getAttribute('data-cursor-stage'),
      commit: root.getAttribute('data-cursor-commit'),
    }).toEqual(before);
  });
});
