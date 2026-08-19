/**
 * Test-only fixture loading. Every fixture is GENERATED from a real run —
 * see demo/generate-skill-run.ts and demo/generate-plain-run.ts.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Recording } from 'agentfootprint-lens/why';

function load<T>(name: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), 'demo', name), 'utf8')) as T;
}

export const skillRun = (): Recording => load<Recording>('skill-run.json');
export const plainRun = (): Recording => load<Recording>('plain-run.json');
export const skillRunEnvelope = (): Record<string, unknown> =>
  load<Record<string, unknown>>('skill-run.envelope.json');
export const bareCommitLog = (): unknown[] => load<unknown[]>('commit-log.json');
export const snapshotOnly = (): Record<string, unknown> =>
  load<Record<string, unknown>>('snapshot-only.json');
