/**
 * Value-click tracing (Same-Rail Rewind), rebuilt ONCE, here — the capability
 * that was once lost silently, which is why `flow.tracing` defaults to true
 * and why the slot contract carries the same walk.
 *
 * The walk is pure commit-log reading: a key's WRITER STOPS are the commits
 * whose trace touched that key; entering the walk moves the ONE cursor to the
 * nearest writer at-or-before where you stand, and prev/next ride the same
 * rail — no second cursor, no state rollback, just the ruler moving.
 */

import { useCallback, useMemo, useState } from 'react';

import type { PaneTracing } from '../config/types.js';

/** A footprintjs commit bundle, duck-shaped for what tracing reads. */
export interface CommitBundleLike {
  readonly idx?: number;
  readonly runtimeStageId?: string;
  readonly stage?: string;
  readonly trace?: ReadonlyArray<{ readonly path?: string; readonly verb?: string }>;
}

/** The commit log inside a recording's snapshot, or `[]`. */
export function commitLogOf(recording: {
  readonly snapshot?: unknown;
}): readonly CommitBundleLike[] {
  const snapshot = recording.snapshot as { commitLog?: unknown } | null | undefined;
  return Array.isArray(snapshot?.commitLog) ? (snapshot.commitLog as CommitBundleLike[]) : [];
}

function topKey(path: string): string {
  const dot = path.indexOf('.');
  const bracket = path.indexOf('[');
  const cut = Math.min(dot === -1 ? path.length : dot, bracket === -1 ? path.length : bracket);
  return path.slice(0, cut);
}

/** The keys one commit wrote (top-level, deduped, in trace order). */
export function keysWrittenAt(
  commitLog: readonly CommitBundleLike[],
  commitIdx: number,
): readonly string[] {
  const bundle = commitLog[commitIdx];
  if (!bundle || !Array.isArray(bundle.trace)) return [];
  const keys: string[] = [];
  for (const entry of bundle.trace) {
    if (typeof entry?.path !== 'string' || entry.path.length === 0) continue;
    const key = topKey(entry.path);
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

/** Every commit index that wrote this key, in run order — the walk's stops. */
export function writerStops(
  commitLog: readonly CommitBundleLike[],
  key: string,
): readonly number[] {
  const stops: number[] = [];
  for (let i = 0; i < commitLog.length; i += 1) {
    const trace = commitLog[i]?.trace;
    if (!Array.isArray(trace)) continue;
    const wrote = trace.some((entry) => {
      if (typeof entry?.path !== 'string') return false;
      return topKey(entry.path) === key;
    });
    if (wrote) stops.push(i);
  }
  return stops;
}

export interface TracingWalkArgs {
  readonly commitLog: readonly CommitBundleLike[];
  /** Where the one cursor stands, as a commit index (-1 = unknown). */
  readonly commitIdx: number;
  /** Move the ONE cursor to a commit — the cursor owner's funnel. */
  readonly moveToCommit: (commitIdx: number) => void;
}

/**
 * The walk as React state + the `PaneTracing` entry both the shipped pane and
 * a slot replacement receive. One instance per tab mount; the active walk
 * survives cursor moves (the banner keeps counting while you ride the rail).
 */
export function useTracingWalk(args: TracingWalkArgs): PaneTracing {
  const { commitLog, commitIdx, moveToCommit } = args;
  const [walk, setWalk] = useState<
    { key: string; stops: readonly number[]; at: number } | undefined
  >(undefined);

  const keys = useMemo(() => keysWrittenAt(commitLog, commitIdx), [commitLog, commitIdx]);

  const start = useCallback(
    (key: string) => {
      const stops = writerStops(commitLog, key);
      if (stops.length === 0) return; // never written — nothing to walk
      // Enter at the nearest writer at-or-before the cursor; else the first.
      let at = 0;
      for (let i = stops.length - 1; i >= 0; i -= 1) {
        if (stops[i]! <= commitIdx) {
          at = i;
          break;
        }
      }
      setWalk({ key, stops, at });
      moveToCommit(stops[at]!);
    },
    [commitLog, commitIdx, moveToCommit],
  );

  const prev = useCallback(() => {
    setWalk((w) => {
      if (!w || w.at <= 0) return w;
      const at = w.at - 1;
      moveToCommit(w.stops[at]!);
      return { ...w, at };
    });
  }, [moveToCommit]);

  const next = useCallback(() => {
    setWalk((w) => {
      if (!w || w.at >= w.stops.length - 1) return w;
      const at = w.at + 1;
      moveToCommit(w.stops[at]!);
      return { ...w, at };
    });
  }, [moveToCommit]);

  const done = useCallback(() => setWalk(undefined), []);

  return useMemo<PaneTracing>(
    () => ({
      keys,
      start,
      ...(walk
        ? { active: { key: walk.key, stop: walk.at + 1, of: walk.stops.length } }
        : {}),
      prev,
      next,
      done,
    }),
    [keys, start, walk, prev, next, done],
  );
}
