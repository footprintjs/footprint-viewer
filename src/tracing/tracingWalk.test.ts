/**
 * The value-click walk over a REAL run's commit log: writer stops, entry at
 * the nearest writer at-or-before the cursor, and the rail's prev/next/done.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { commitLogOf, keysWrittenAt, useTracingWalk, writerStops } from './tracingWalk.js';
import { skillRun } from '../test/fixtures.js';

const recording = skillRun();
const commitLog = commitLogOf(recording);

// A key the real run wrote more than once — the walk needs a rail.
const walkableKey = (() => {
  const counts = new Map<string, number>();
  for (let i = 0; i < commitLog.length; i += 1) {
    for (const key of keysWrittenAt(commitLog, i)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const found = [...counts.entries()].find(([, n]) => n >= 2);
  if (!found) throw new Error('fixture regression: no key written twice');
  return found[0];
})();

describe('the commit log, read', () => {
  it('the fixture has a commit log and written keys (generated, not hand-authored)', () => {
    expect(commitLog.length).toBeGreaterThan(10);
    const anyKeys = commitLog.some((_, i) => keysWrittenAt(commitLog, i).length > 0);
    expect(anyKeys).toBe(true);
  });

  it('writerStops are ascending commit indexes that really wrote the key', () => {
    const stops = writerStops(commitLog, walkableKey);
    expect(stops.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < stops.length; i += 1) expect(stops[i]!).toBeGreaterThan(stops[i - 1]!);
    for (const stop of stops) expect(keysWrittenAt(commitLog, stop)).toContain(walkableKey);
  });
});

describe('useTracingWalk', () => {
  it('start lands on the nearest writer at-or-before the cursor; prev/next ride the rail; done steps off', () => {
    const stops = writerStops(commitLog, walkableKey);
    const cursorCommit = stops[stops.length - 1]!; // stand at the last writer
    const moves: number[] = [];
    const moveToCommit = vi.fn((c: number) => moves.push(c));

    const { result } = renderHook(() =>
      useTracingWalk({ commitLog, commitIdx: cursorCommit, moveToCommit }),
    );

    act(() => result.current.start(walkableKey));
    expect(moves).toEqual([cursorCommit]);
    expect(result.current.active).toEqual({
      key: walkableKey,
      stop: stops.length,
      of: stops.length,
    });

    act(() => result.current.prev());
    expect(moves).toEqual([cursorCommit, stops[stops.length - 2]]);
    expect(result.current.active?.stop).toBe(stops.length - 1);

    act(() => result.current.next());
    expect(moves[moves.length - 1]).toBe(cursorCommit);

    // At the last stop, next() stays put and does not move the cursor again.
    const movesSoFar = moves.length;
    act(() => result.current.next());
    expect(moves.length).toBe(movesSoFar);

    act(() => result.current.done());
    expect(result.current.active).toBeUndefined();
  });

  it('a never-written key is a no-op — nothing moves, no walk begins', () => {
    const moveToCommit = vi.fn();
    const { result } = renderHook(() =>
      useTracingWalk({ commitLog, commitIdx: 3, moveToCommit }),
    );
    act(() => result.current.start('no-such-key-anywhere'));
    expect(moveToCommit).not.toHaveBeenCalled();
    expect(result.current.active).toBeUndefined();
  });

  it('keys are what the cursor commit wrote', () => {
    const withKeys = commitLog.findIndex((_, i) => keysWrittenAt(commitLog, i).length > 0);
    const { result } = renderHook(() =>
      useTracingWalk({ commitLog, commitIdx: withKeys, moveToCommit: () => {} }),
    );
    expect(result.current.keys.length).toBeGreaterThan(0);
  });
});
