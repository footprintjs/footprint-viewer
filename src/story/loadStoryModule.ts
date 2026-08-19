/**
 * The Story tab's package, imported LAZILY — `agentthinkingui` is the
 * viewer's one OPTIONAL peer. Declaring 'story' without it renders the
 * teaching card in the Story tab; the other tabs work untouched, and no
 * build crashes: the import happens at runtime, only when the Story tab
 * actually mounts, and a rejection is an answer, not an error.
 */

import type * as React from 'react';

/** The two mounts the Story tab uses, duck-typed (atui ships .jsx). */
export interface StoryModule {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly AgentThinkingUI: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly Notepad: React.ComponentType<any>;
}

type Loader = () => Promise<StoryModule | null>;

const defaultLoader: Loader = async () => {
  try {
    const mod = (await import('agentthinkingui')) as unknown as StoryModule;
    try {
      // The player's stylesheet rides the same optional install.
      await import('agentthinkingui/styles.css');
    } catch {
      // A style-less mount still works; never block on CSS.
    }
    return mod;
  } catch {
    return null;
  }
};

let loader: Loader = defaultLoader;
let cached: Promise<StoryModule | null> | undefined;

/** `null` means: not installed. The Story tab renders its teaching card. */
export function loadStoryModule(): Promise<StoryModule | null> {
  cached ??= loader();
  return cached;
}

/** Test seam: stand in for the optional install (absent, or a stub). */
export function __setStoryModuleLoaderForTests(next: Loader | undefined): void {
  loader = next ?? defaultLoader;
  cached = undefined;
}
