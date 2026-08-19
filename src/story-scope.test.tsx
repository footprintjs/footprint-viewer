/**
 * THE STORY TAB'S SCOPE — the bug that looks exactly like a missing stylesheet.
 *
 * These hold the `story: { view: 'notepad' }` reading: the beats written out on
 * their own, with no scene. The tab's DEFAULT is the whole player, which
 * renders atui's own root and needs no scope from us (see story-player.test).
 *
 * agentthinkingui writes every rule as `:where(.atui, .atui-swarm) …`, and its
 * own player renders that root element itself. `<Notepad>` is a sub-component
 * of that player: mounted on its own it has no `.atui` ancestor, so all ~750
 * rules address nothing and the story renders as raw text. Observed on the
 * incident dashboard, where the stylesheet was demonstrably loaded — 748 rules
 * in the document — and matching none of the notepad's markup.
 *
 * So the viewer supplies the scope, with the theme variables that root would
 * have carried. These tests hold both halves, plus the honest report when the
 * stylesheet genuinely is not there.
 */

import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FootprintViewer } from './FootprintViewer.js';
import type { ViewerWarning } from './config/types.js';
import { __setStoryModuleLoaderForTests, type LoadedStory } from './story/loadStoryModule.js';
import { skillRun } from './test/fixtures.js';

const source = { kind: 'recording', data: skillRun() } as const;

/** A stand-in for the optional peer: the two mounts, and the theme namespace
 *  whose `toVars` the real package exports. */
function stubStory(over: Partial<LoadedStory> = {}): LoadedStory {
  return {
    mod: {
      AgentThinkingUI: () => <div data-testid="stub-player" />,
      Notepad: () => <div data-testid="stub-notepad" className="note-list" />,
      AgentTheme: {
        normalize: (input: unknown) => input,
        toVars: (theme: unknown) => ({
          '--paper': (theme as { mode?: string }).mode === 'dark' ? '#16110B' : '#FBF6EC',
          '--ink': '#F3E7D4',
        }),
      },
      ...over.mod,
    },
    styles: over.styles ?? 'loaded',
    ...(over.stylesDetail !== undefined ? { stylesDetail: over.stylesDetail } : {}),
  };
}

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
  __setStoryModuleLoaderForTests(undefined);
  cleanup();
});

describe('the notepad is mounted inside the scope its stylesheet is written against', () => {
  it('RED — the notepad has an .atui ancestor, or every atui rule misses it', async () => {
    __setStoryModuleLoaderForTests(() => Promise.resolve(stubStory()));
    render(
      <FootprintViewer source={source} config={{ landing: 'story', story: { view: 'notepad' } }} />,
    );

    const notepad = await screen.findByTestId('stub-notepad');
    const scope = notepad.closest('.atui');
    expect(scope).not.toBeNull();
    // The scope is the viewer's own wrapper — not something further up the
    // page that a host happened to provide.
    expect(scope).toHaveAttribute('data-testid', 'viewer-story-notepad');
  });

  it('carries the theme variables that root would have stamped', async () => {
    __setStoryModuleLoaderForTests(() => Promise.resolve(stubStory()));
    render(
      <FootprintViewer
        source={source}
        config={{ landing: 'story', story: { view: 'notepad' }, theme: { mode: 'dark' } }}
      />,
    );
    const scope = await screen.findByTestId('viewer-story-notepad');
    // In dark mode the colours live on the atui root, never on :root — a
    // scope without them is a light notepad in a dark page.
    expect(scope.style.getPropertyValue('--paper')).toBe('#16110B');
  });

  it('still scopes correctly when the package has no theme namespace', async () => {
    __setStoryModuleLoaderForTests(() =>
      Promise.resolve({
        mod: {
          AgentThinkingUI: () => <div />,
          Notepad: () => <div data-testid="stub-notepad" />,
        },
        styles: 'loaded',
      }),
    );
    render(
      <FootprintViewer
        source={source}
        config={{ landing: 'story', story: { view: 'notepad' }, theme: { mode: 'dark' } }}
      />,
    );
    const notepad = await screen.findByTestId('stub-notepad');
    expect(notepad.closest('.atui')).not.toBeNull();
  });
});

describe('a stylesheet that did not load is SAID, not swallowed', () => {
  // On the DEFAULT view — the player — because that is the mount every reader
  // gets, and an unstyled player is the failure this viewer exists to end.
  it('reports it, and still renders the story', async () => {
    const warnings: ViewerWarning[] = [];
    __setStoryModuleLoaderForTests(() =>
      Promise.resolve(stubStory({ styles: 'unavailable', stylesDetail: 'Failed to fetch' })),
    );
    render(
      <FootprintViewer
        source={source}
        config={{ landing: 'story', onWarning: (w) => warnings.push(w) }}
      />,
    );

    await screen.findByTestId('stub-player');
    await waitFor(() =>
      expect(warnings.map((w) => w.message).join('\n')).toMatch(/stylesheet did not/),
    );
    expect(warnings.find((w) => w.message.includes('stylesheet did not'))?.message).toMatch(
      /Failed to fetch/,
    );
  });
});
