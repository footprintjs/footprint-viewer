/**
 * The Data tab — the run's own record: the final state, and the raw typed
 * events exactly as they fired. No narration, no grouping; this is the tab
 * for "show me the bytes". The event list is the lens's own EventStream.
 */

import React from 'react';
import { EventStream } from 'agentfootprint-lens';
import type { Recording } from 'agentfootprint-lens/why';
import type { LensRecorder, Humanizer } from 'agentfootprint-lens/core';

export interface DataTabProps {
  readonly recording: Recording;
  readonly recorder: LensRecorder;
  readonly humanizer: Humanizer | undefined;
}

export function DataTab(props: DataTabProps): React.ReactElement {
  const snapshot = props.recording.snapshot as { sharedState?: unknown } | null | undefined;
  const finalState = snapshot?.sharedState;
  return (
    <div data-testid="viewer-data" style={{ display: 'grid', gap: 12, padding: 12 }}>
      <section>
        <h3 style={{ margin: '0 0 6px', fontSize: 13 }}>Final state</h3>
        {finalState === undefined ? (
          <p style={{ margin: 0, opacity: 0.75, fontSize: 13 }}>
            This recording carries no state snapshot — only the events below.
          </p>
        ) : (
          <pre
            style={{
              margin: 0,
              padding: 10,
              fontSize: 11.5,
              lineHeight: 1.5,
              overflowX: 'auto',
              maxHeight: 280,
              border: '1px solid rgba(128,128,128,0.3)',
              borderRadius: 6,
            }}
          >
            {JSON.stringify(finalState, null, 2)}
          </pre>
        )}
      </section>
      <section>
        <h3 style={{ margin: '0 0 6px', fontSize: 13 }}>Every event, as it fired</h3>
        <EventStream
          log={props.recorder.selectEventLog()}
          {...(props.humanizer !== undefined ? { humanizer: props.humanizer } : {})}
        />
      </section>
    </div>
  );
}
