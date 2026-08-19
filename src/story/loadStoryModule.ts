/**
 * The Story tab's package, imported LAZILY — `agentthinkingui` is the
 * viewer's one OPTIONAL peer. Declaring 'story' without it renders the
 * teaching card in the Story tab; the other tabs work untouched, and no
 * build crashes: the import happens at runtime, only when the Story tab
 * actually mounts, and a rejection is an answer, not an error.
 */

import type * as React from 'react';

import type { StoryTrace } from '../config/types.js';

/**
 * The atui theme namespace, duck-typed — `AgentTheme.toVars(normalize({mode}))`
 * hands back the ~54 CSS custom properties the stylesheet reads.
 *
 * It matters for the NOTEPAD mount and only for that one: the player renders
 * atui's own root element and stamps these itself, while `<Notepad>` is a
 * sub-component that has always expected to be inside that root. Optional in
 * the type because this is an optional peer whose surface may differ by
 * version — absent, the notepad still scopes correctly and takes the
 * stylesheet's own `:root` colours.
 */
export interface StoryThemeNamespace {
  normalize(input: unknown): unknown;
  toVars(theme: unknown): Record<string, string>;
}

/**
 * The package's own reader for an ARCHIVED run (agentthinkingui 0.30+).
 *
 * OPTIONAL in the type because it is version-dependent: under 0.29 the Story
 * tab falls back to the viewer's own derivation. It throws — by design — on
 * anything that is not a recording it can read, which is why the Story tab
 * calls it inside a try (see `readNarration`).
 */
export type StoryRecordingReader = (
  recording: unknown,
  options?: { agent?: string },
) => StoryTrace;

/** The mounts and readers the Story tab uses, duck-typed (atui ships .jsx). */
export interface StoryModule {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly AgentThinkingUI: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly Notepad: React.ComponentType<any>;
  readonly AgentTheme?: StoryThemeNamespace;
  readonly fromRecording?: StoryRecordingReader;
}

/**
 * What came back — the module, and whether its STYLESHEET came with it.
 *
 * The two are separate facts because they fail separately: agentthinkingui
 * ships its styles as their own entry (`agentthinkingui/styles.css`), and a
 * bundler that pre-bundles the viewer can resolve the JS and drop the CSS.
 * The old code swallowed that into one silent `catch`, which is the shape of
 * bug this whole viewer is written against — a tab that renders, wrong, with
 * nobody told. Now the tab can say so.
 */
export interface LoadedStory {
  readonly mod: StoryModule;
  readonly styles: 'loaded' | 'unavailable';
  /** Why the stylesheet did not load, when it did not. */
  readonly stylesDetail?: string;
}

type Loader = () => Promise<LoadedStory | null>;

const defaultLoader: Loader = async () => {
  let mod: StoryModule;
  try {
    mod = (await import('agentthinkingui')) as unknown as StoryModule;
  } catch {
    return null;
  }
  try {
    // The stylesheet is its own entry, and its own failure.
    await import('agentthinkingui/styles.css');
    return { mod, styles: 'loaded' };
  } catch (error) {
    // A style-less mount still renders — never block the story on CSS — but
    // it renders as unstyled text, so the tab reports it.
    return { mod, styles: 'unavailable', stylesDetail: (error as Error).message };
  }
};

let loader: Loader = defaultLoader;
let cached: Promise<LoadedStory | null> | undefined;

/** `null` means: not installed. The Story tab renders its teaching card. */
export function loadStoryModule(): Promise<LoadedStory | null> {
  cached ??= loader();
  return cached;
}

/** Test seam: stand in for the optional install (absent, or a stub). */
export function __setStoryModuleLoaderForTests(next: Loader | undefined): void {
  loader = next ?? defaultLoader;
  cached = undefined;
}
