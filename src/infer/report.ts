/**
 * Inference is REPORTED: one dev-mode console line per inferred choice, and
 * every sentence also travels as data through `onWarning`. Production builds
 * print nothing; the words never change between the two.
 */

import type { ViewerWarning } from '../config/types.js';

export function isDevMode(): boolean {
  try {
    // Bundlers (Vite, webpack, esbuild) statically replace the exact
    // expression `process.env.NODE_ENV` — so this must be the bare
    // expression, not guarded behind `typeof process` (the guard would
    // short-circuit before the replaced literal is ever read). The
    // try/catch covers a plain browser with no bundler, where `process`
    // does not exist: that is a production posture, so dev mode is off.
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}

/** Print (dev only) and report (always) each sentence, in order. */
export function deliverWarnings(
  warnings: readonly ViewerWarning[],
  onWarning: ((w: ViewerWarning) => void) | undefined,
): void {
  for (const w of warnings) {
    if (isDevMode()) {
      // eslint-disable-next-line no-console
      console.warn(w.message);
    }
    onWarning?.(w);
  }
}
