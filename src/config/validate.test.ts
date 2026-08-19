/**
 * Config mistakes are loud at mount — thrown, with full sentences. The two
 * example sentences from the design page are pinned verbatim.
 */

import { describe, expect, it } from 'vitest';

import { validateViewerConfig, ViewerConfigError } from './validate.js';
import type { ViewerSource } from './types.js';

const okSource: ViewerSource = { kind: 'recording', data: { events: [] } as never };

describe('validateViewerConfig', () => {
  it('throws the pinned sentence for an unknown lens, with the closest name', () => {
    expect(() =>
      validateViewerConfig(okSource, { lenses: ['flowchart' as never] }),
    ).toThrowError(
      'footprint-viewer: "flowchart" is not a lens this viewer knows. ' +
        'The lenses are "story", "why", "flow", "skillgraph" and "data". Closest name: "flow".',
    );
  });

  it('throws the pinned two-origins sentence, naming both sides', () => {
    const twoOrigins = {
      kind: 'recording-envelope',
      url: '/api/runs/42',
      data: { events: [] },
    } as never;
    expect(() => validateViewerConfig(twoOrigins, undefined)).toThrowError(
      'footprint-viewer: source names two origins — a url and a data object. ' +
        'A viewer reads ONE recording; keep the one this page means. ' +
        '(The AgentRecipe rule, applied to viewing: a conflict is an error that names both sides.)',
    );
  });

  it('throws when source is named twice with different objects — both sides named', () => {
    const a: ViewerSource = { kind: 'recording', data: { events: [] } as never };
    const b: ViewerSource = { kind: 'recording', data: { events: [] } as never };
    expect(() => validateViewerConfig(a, { source: b })).toThrowError(
      /source is named twice — once as the component's source prop and once inside config\.source/,
    );
    // The same object in both places is not a conflict.
    expect(validateViewerConfig(a, { source: a })).toBe(a);
  });

  it('throws when there is no source at all, teaching the four kinds', () => {
    expect(() => validateViewerConfig(undefined, undefined)).toThrowError(/no source/);
    expect(() => validateViewerConfig(undefined, {})).toThrowError(/recording-envelope/);
  });

  it('throws when landing names a tab that lenses leaves out', () => {
    expect(() =>
      validateViewerConfig(okSource, { lenses: ['flow', 'data'], landing: 'story' }),
    ).toThrowError(
      'footprint-viewer: landing is "story", but lenses does not include it — ' +
        'a viewer cannot open on a tab that does not exist. Add "story" to lenses, ' +
        'or pick a landing from ["flow", "data"].',
    );
  });

  it('throws on an empty lens list and on duplicates', () => {
    expect(() => validateViewerConfig(okSource, { lenses: [] })).toThrowError(
      /lenses is an empty list/,
    );
    expect(() =>
      validateViewerConfig(okSource, { lenses: ['flow', 'flow'] }),
    ).toThrowError('footprint-viewer: "flow" appears twice in lenses — each tab exists once. Keep the first.');
  });

  it('errors are ViewerConfigError', () => {
    try {
      validateViewerConfig(undefined, undefined);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ViewerConfigError);
    }
  });
});
