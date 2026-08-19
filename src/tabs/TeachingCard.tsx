/**
 * The viewer's honest on-screen refusal — the doors' three-sentence grammar:
 *   1. what this viewer reads
 *   2. what you passed looks like   (named, not guessed at)
 *   3. where to go                  (the teaching half)
 * Never a blank panel, never a crash.
 *
 * TODO(upstream ask, agentfootprint-lens): this is a local sibling of the
 * doors' DoorRefusalCard, which lens does not export. When it is exported
 * (with the eyebrow parameterized), mount that instead.
 */

import React from 'react';

export interface TeachingCardProps {
  /** The card's eyebrow, e.g. "Footprint Viewer · not an input this viewer reads". */
  readonly eyebrow: string;
  /** Sentence 1, whole. */
  readonly reads: string;
  /** Sentence 2's prefix ("What you passed looks like") and object. */
  readonly receivedPrefix: string;
  readonly received: string;
  /** Sentence 3, whole. */
  readonly goTo: string;
}

export function TeachingCard(props: TeachingCardProps): React.ReactElement {
  return (
    <div
      data-testid="viewer-refusal"
      role="note"
      style={{
        margin: 12,
        padding: '12px 14px',
        borderRadius: 8,
        border: '1px solid rgba(128,128,128,0.35)',
        fontSize: 13,
        lineHeight: 1.6,
        maxWidth: 620,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          opacity: 0.65,
          marginBottom: 6,
        }}
      >
        {props.eyebrow}
      </div>
      <p style={{ margin: 0 }}>{props.reads}</p>
      <p style={{ margin: '6px 0 0' }}>
        {props.receivedPrefix} <strong data-testid="viewer-refusal-received">{props.received}</strong>.
      </p>
      <p style={{ margin: '6px 0 0', opacity: 0.8 }} data-testid="viewer-refusal-go-to">
        {props.goTo}
      </p>
    </div>
  );
}
