/**
 * Config mistakes are loud at mount — thrown, because a typo should never
 * ship. Every sentence names what was passed and what to do; a conflict names
 * BOTH sides (the AgentRecipe rule, applied to viewing).
 */

import { ALL_LENSES, type LensId, type ViewerConfig, type ViewerSource } from './types.js';

/** The error the viewer throws on a config mistake. */
export class ViewerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ViewerConfigError';
  }
}

/** Plain edit distance, for the "Closest name" suggestion. */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[] = new Array(rows * cols).fill(0);
  for (let i = 0; i < rows; i += 1) d[i * cols] = i;
  for (let j = 0; j < cols; j += 1) d[j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i * cols + j] = Math.min(
        d[(i - 1) * cols + j]! + 1,
        d[i * cols + (j - 1)]! + 1,
        d[(i - 1) * cols + (j - 1)]! + cost,
      );
    }
  }
  return d[rows * cols - 1]!;
}

function closestLens(name: string): LensId {
  let best: LensId = ALL_LENSES[0]!;
  let bestD = Number.POSITIVE_INFINITY;
  for (const lens of ALL_LENSES) {
    const dist = editDistance(name.toLowerCase(), lens);
    if (dist < bestD) {
      bestD = dist;
      best = lens;
    }
  }
  return best;
}

const LENS_LIST_SENTENCE = 'The lenses are "story", "why", "flow", "skillgraph" and "data".';

function assertKnownLens(name: string, where: string): asserts name is LensId {
  if ((ALL_LENSES as readonly string[]).includes(name)) return;
  throw new ViewerConfigError(
    `footprint-viewer: "${name}" is not a lens this viewer knows. ` +
      `${LENS_LIST_SENTENCE} Closest name: "${closestLens(name)}".` +
      (where === 'lenses' ? '' : ` (Passed as ${where}.)`),
  );
}

/** Human name for each origin field a source object can carry. */
const ORIGIN_NAMES: ReadonlyArray<readonly [key: string, name: string]> = [
  ['url', 'a url'],
  ['data', 'a data object'],
  ['recorder', 'a live recorder'],
  ['get', 'a fetch function'],
];

const CONFLICT_TAIL =
  'A viewer reads ONE recording; keep the one this page means. ' +
  '(The AgentRecipe rule, applied to viewing: a conflict is an error that names both sides.)';

function assertOneOrigin(source: ViewerSource): void {
  const record = source as unknown as Record<string, unknown>;
  const present = ORIGIN_NAMES.filter(([key]) => record[key] !== undefined);
  if (present.length > 1) {
    const [first, second] = present;
    throw new ViewerConfigError(
      `footprint-viewer: source names two origins — ${first![1]} and ${second![1]}. ${CONFLICT_TAIL}`,
    );
  }
  const KINDS = ['recording-envelope', 'recording', 'live', 'fetch'] as const;
  if (!KINDS.includes(source.kind)) {
    throw new ViewerConfigError(
      `footprint-viewer: source.kind is "${String((source as { kind?: unknown }).kind)}", which is not a source this viewer knows. ` +
        `The kinds are "recording-envelope" (a url), "recording" (the object in hand), "live" (a recorder handle) and "fetch" (your own transport).`,
    );
  }
  const expected: Record<(typeof KINDS)[number], string> = {
    'recording-envelope': 'url',
    recording: 'data',
    live: 'recorder',
    fetch: 'get',
  };
  const want = expected[source.kind];
  if (record[want] === undefined) {
    throw new ViewerConfigError(
      `footprint-viewer: source.kind is "${source.kind}" but it carries no ${want} — that kind means "${want}" holds the origin.`,
    );
  }
}

/**
 * Validate the whole mount: the source (from the prop, the config, or both —
 * both is a named conflict unless they are the same object), the lens list,
 * and the landing. Returns the ONE source. Throws `ViewerConfigError` with a
 * full sentence on any mistake.
 */
export function validateViewerConfig(
  sourceProp: ViewerSource | undefined,
  config: ViewerConfig | undefined,
): ViewerSource {
  if (
    sourceProp !== undefined &&
    config?.source !== undefined &&
    sourceProp !== config.source
  ) {
    throw new ViewerConfigError(
      `footprint-viewer: source is named twice — once as the component's source prop and once inside config.source, and they are not the same object. ${CONFLICT_TAIL}`,
    );
  }
  const source = sourceProp ?? config?.source;
  if (source === undefined) {
    throw new ViewerConfigError(
      `footprint-viewer: no source — the viewer needs to know where the recording comes from. ` +
        `Pass source={{ kind: 'recording', data }} for an object in hand, ` +
        `{ kind: 'recording-envelope', url } to fetch one, { kind: 'live', recorder } for a run under way, ` +
        `or { kind: 'fetch', get } when the app owns transport.`,
    );
  }
  assertOneOrigin(source);

  if (config?.lenses !== undefined) {
    if (config.lenses.length === 0) {
      throw new ViewerConfigError(
        `footprint-viewer: lenses is an empty list — a viewer with no tabs shows nothing. ` +
          `Leave lenses out to offer all five, or name at least one. ${LENS_LIST_SENTENCE}`,
      );
    }
    const seen = new Set<string>();
    for (const name of config.lenses) {
      assertKnownLens(name, 'lenses');
      if (seen.has(name)) {
        throw new ViewerConfigError(
          `footprint-viewer: "${name}" appears twice in lenses — each tab exists once. Keep the first.`,
        );
      }
      seen.add(name);
    }
  }

  if (config?.landing !== undefined) {
    assertKnownLens(config.landing, 'landing');
    const offered = config.lenses ?? ALL_LENSES;
    if (!offered.includes(config.landing)) {
      throw new ViewerConfigError(
        `footprint-viewer: landing is "${config.landing}", but lenses does not include it — ` +
          `a viewer cannot open on a tab that does not exist. Add "${config.landing}" to lenses, ` +
          `or pick a landing from [${offered.map((l) => `"${l}"`).join(', ')}].`,
      );
    }
  }

  if (config?.lens !== undefined) {
    assertKnownLens(config.lens, 'the controlled lens prop');
  }

  if (config?.initialAt !== undefined) {
    const { lens, runtimeStageId } = config.initialAt;
    // An address is a string with a stage in it. An empty one is not a
    // narrower address, it is a missing argument — and it would resolve to a
    // refusal at run time, which is a worse place to learn about a typo.
    if (typeof runtimeStageId !== 'string' || runtimeStageId.trim() === '') {
      throw new ViewerConfigError(
        `footprint-viewer: initialAt.runtimeStageId is ${runtimeStageId === undefined ? 'missing' : `"${String(runtimeStageId)}"`} — ` +
          `an address needs a stage id, footprintjs's own (like "llm#3" or "sf-tools/search#7"). ` +
          `Leave initialAt out to open where the viewer would anyway.`,
      );
    }
    if (lens !== undefined) {
      assertKnownLens(lens, 'initialAt.lens');
      const offered = config.lenses ?? ALL_LENSES;
      if (!offered.includes(lens)) {
        throw new ViewerConfigError(
          `footprint-viewer: initialAt.lens is "${lens}", but lenses does not include it — ` +
            `a viewer cannot open on a tab that does not exist. Add "${lens}" to lenses, ` +
            `or address a tab from [${offered.map((l) => `"${l}"`).join(', ')}].`,
        );
      }
    }
  }

  return source;
}
