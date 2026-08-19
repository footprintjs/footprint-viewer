/**
 * footprint-viewer — the one front door for viewing a recorded agent run.
 *
 *   import { FootprintViewer } from 'footprint-viewer';
 *
 *   <FootprintViewer source={{ kind: 'recording', data: recording }} />
 *
 * Zero config works: the viewer reads the recording itself and decides what
 * lights up (and says so, one dev line per choice). Explicit config always
 * beats inference; `exportInferredConfig` turns today's inference into
 * tomorrow's pinned file.
 */

export { FootprintViewer, type FootprintViewerProps } from './FootprintViewer.js';

export {
  ALL_LENSES,
  type LensId,
  type PaneAxis,
  type PaneCapability,
  type PaneSlot,
  type PaneTracing,
  type ResolvedViewerConfig,
  type RunnerLike,
  type StoryTrace,
  type ViewerConfig,
  type ViewerCursor,
  type ViewerNavigationReport,
  type ViewerPaneProps,
  type ViewerSlots,
  type ViewerSource,
  type ViewerStats,
  type ViewerStop,
  type ViewerWarning,
  type WhenEmpty,
} from './config/types.js';

export { ViewerConfigError } from './config/validate.js';

// Today's inference as tomorrow's pinned file.
export { exportInferredConfig } from './config/resolve.js';

// The offline story derivation — the same beats the Story tab shows.
export { storyFromRecording } from './story/storyFromRecording.js';
