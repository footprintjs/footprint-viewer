/**
 * A declared tab with nothing to show says so — absence is a rendered fact,
 * never a vanished tab and never blank space. (The Skill Graph tab does not
 * use this: the lens's own "No skill graph ran here" card is its honest
 * empty state, and the viewer mounts it rather than re-writing it.)
 */

import React from 'react';

import type { LensId } from '../config/types.js';

const EMPTY_SENTENCES: Record<LensId, { readonly title: string; readonly body: string }> = {
  story: {
    title: 'No story to tell here',
    body: 'This recording carries no beats the narrator can read — the run left no narratable moments.',
  },
  why: {
    title: 'No agent moments here',
    body: 'This recording carries no agent events, so there is nothing to group into moments.',
  },
  flow: {
    title: 'No steps here',
    body: 'This recording carries no commit log, so there are no steps to walk.',
  },
  skillgraph: {
    title: 'No skill graph ran here',
    body: 'This recording carries no skill-routing events — the run never walked a skill graph.',
  },
  data: {
    title: 'Nothing recorded here',
    body: 'This recording carries no events and no commit log — there is no record to show.',
  },
};

export function EmptyState({ lens }: { readonly lens: LensId }): React.ReactElement {
  const words = EMPTY_SENTENCES[lens];
  return (
    <div
      data-testid={`viewer-empty-${lens}`}
      role="note"
      style={{ margin: 12, padding: '14px 16px', maxWidth: 620, lineHeight: 1.6 }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{words.title}</div>
      <div style={{ opacity: 0.75, fontSize: 13 }}>{words.body}</div>
    </div>
  );
}
