/**
 * The demo: the ZERO-CONFIG mount over the generated skill run — the
 * amendment's whole point on one page. The viewer reads the recording and
 * decides; open the console to see each inference reported.
 */

import React from 'react';
import { FootprintViewer } from '../src/index.js';
import skillRun from './skill-run.json';

export function Demo(): React.ReactElement {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '8px 12px', borderBottom: '1px solid #ddd' }}>
        <strong>footprint-viewer</strong>
        <span style={{ opacity: 0.7, fontSize: 13 }}>
          {' '}— zero config over a generated skill run. The recording decides what lights up.
        </span>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <FootprintViewer source={{ kind: 'recording', data: skillRun as never }} />
      </div>
    </div>
  );
}
