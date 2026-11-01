import { waitFor } from '@testing-library/react';
import { expect } from 'vitest';

export interface CursorSnapshot {
  readonly step: string | null;
  readonly stage: string | null;
  readonly commit: string | null;
}

/** For recording-backed Lens tests: wrapper readiness precedes its opening report. */
export function readOpeningCursor(ready: HTMLElement): Promise<CursorSnapshot> {
  return waitFor(() => {
    const at = {
      step: ready.getAttribute('data-cursor-step'),
      stage: ready.getAttribute('data-cursor-stage'),
      commit: ready.getAttribute('data-cursor-commit'),
    };
    expect(at.stage).toBeTruthy();
    expect(at.step).toMatch(/^\d+$/);
    expect(at.commit).toMatch(/^\d+$/);
    return at;
  });
}
