/**
 * <FootprintViewer> — you declare what you want to see (or pass nothing but a
 * source), and the viewer does the wiring: five readings of one recording on
 * ONE shared cursor, correct by construction — or it refuses in a sentence
 * that names what you passed and where to go.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Recording } from 'agentfootprint-lens/why';
import type { LensRecorder } from 'agentfootprint-lens/core';

import type {
  LensId,
  RunnerLike,
  StoryTrace,
  ViewerConfig,
  ViewerSource,
  ViewerWarning,
} from './config/types.js';
import { validateViewerConfig } from './config/validate.js';
import { resolveViewer, type ViewerResolution } from './config/resolve.js';
import { inferCapabilities } from './infer/inference.js';
import { deliverWarnings, isDevMode } from './infer/report.js';
import { loadViewerSource, type LoadedSource } from './source/loadSource.js';
import { REFUSAL_EYEBROW } from './source/refusals.js';
import { storyFromRecording } from './story/storyFromRecording.js';
import { useViewerCursor } from './cursor/useViewerCursor.js';
import { DataTab } from './tabs/DataTab.js';
import { EmptyState } from './tabs/EmptyState.js';
import { LensTab } from './tabs/LensTab.js';
import { SkillGraphTab } from './tabs/SkillGraphTab.js';
import { StoryTab } from './tabs/StoryTab.js';
import { TeachingCard } from './tabs/TeachingCard.js';

export interface FootprintViewerProps {
  /** Where the recording comes from. May live here or in `config.source` —
   *  one of the two is required; both (different) is a named conflict. */
  readonly source?: ViewerSource;
  /** Optional since the inference amendment: absent, the viewer reads the
   *  recording itself and decides what lights up — and reports each choice. */
  readonly config?: ViewerConfig;
}

const TAB_TITLES: Record<LensId, string> = {
  story: 'Story',
  why: 'Why',
  flow: 'Flow',
  skillgraph: 'Skill Graph',
  data: 'Data',
};

function StateCard(props: {
  readonly testId: string;
  readonly title: string;
  readonly body: string;
}): React.ReactElement {
  return (
    <div
      data-testid={props.testId}
      role="status"
      style={{ margin: 12, padding: '14px 16px', maxWidth: 620, lineHeight: 1.6 }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{props.title}</div>
      <div style={{ opacity: 0.75, fontSize: 13 }}>{props.body}</div>
    </div>
  );
}

export function FootprintViewer(props: FootprintViewerProps): React.ReactElement {
  const { config } = props;

  // Config mistakes are loud at mount — a typo should never ship.
  const source = useMemo(
    () => validateViewerConfig(props.source, config),
    [props.source, config],
  );

  const [loaded, setLoaded] = useState<LoadedSource | { readonly state: 'loading' }>({
    state: 'loading',
  });

  useEffect(() => {
    let alive = true;
    setLoaded({ state: 'loading' });
    void loadViewerSource(source).then((result) => {
      if (alive) setLoaded(result);
    });
    return () => {
      alive = false;
    };
  }, [source]);

  // `hidden` keeps everything mounted (recording, cursor, tab state) while
  // rendering nothing visible.
  const hidden = config?.hidden ?? false;

  let body: React.ReactElement;
  if (loaded.state === 'loading') {
    body = (
      <StateCard
        testId="viewer-loading"
        title="Opening the recording…"
        body="The viewer is reading the run. This card is the loading state — never a blank pane."
      />
    );
  } else if (loaded.state === 'refused') {
    body = <TeachingCard eyebrow={REFUSAL_EYEBROW} {...loaded.refusal} />;
  } else if (loaded.state === 'gone') {
    // The app's own retention sentence, verbatim.
    body = <StateCard testId="viewer-gone" title="This recording is gone" body={loaded.message} />;
  } else if (loaded.state === 'failed') {
    body = (
      <StateCard
        testId="viewer-failed"
        title="The recording could not be loaded"
        body={loaded.message}
      />
    );
  } else {
    body = (
      <ReadyViewer
        recording={loaded.recording}
        recorder={loaded.recorder}
        runner={loaded.runner}
        parcelStory={loaded.story}
        live={loaded.live}
        config={config}
      />
    );
  }

  // Stats go quiet whenever there is nothing measured.
  const onStats = config?.onStats;
  const ready = loaded.state === 'ready';
  useEffect(() => {
    if (!ready) onStats?.(undefined);
  }, [ready, onStats]);

  return (
    <div
      data-testid="footprint-viewer"
      style={hidden ? { display: 'none' } : { height: '100%', minHeight: 0 }}
    >
      {body}
    </div>
  );
}

interface ReadyViewerProps {
  readonly recording: Recording;
  readonly recorder: LensRecorder;
  readonly runner: RunnerLike | undefined;
  readonly parcelStory: StoryTrace | undefined;
  readonly live: boolean;
  readonly config: ViewerConfig | undefined;
}

function ReadyViewer(props: ReadyViewerProps): React.ReactElement {
  const { recording, recorder, runner, parcelStory, live, config } = props;

  // A story that travels as its own parcel wins over derivation.
  const story = useMemo(
    () => parcelStory ?? storyFromRecording(recording, { agent: config?.appName }),
    [parcelStory, recording, config?.appName],
  );

  const caps = useMemo(
    () => inferCapabilities({ recording, recorder, story, live }),
    [recording, recorder, story, live],
  );

  const resolution: ViewerResolution = useMemo(
    () => resolveViewer(config, caps),
    [config, caps],
  );

  // Every inference / degradation sentence: once per distinct set, to the
  // console (dev) and to onWarning (always).
  const onWarning = config?.onWarning;
  const deliveredRef = useRef<string>('');
  useEffect(() => {
    const key = resolution.warnings.map((w) => w.message).join('\n');
    if (key === deliveredRef.current) return;
    deliveredRef.current = key;
    deliverWarnings(resolution.warnings, onWarning);
  }, [resolution, onWarning]);

  const onStats = config?.onStats;
  useEffect(() => {
    onStats?.(resolution.stats);
  }, [resolution, onStats]);

  // The address, if the host gave one. Its tab is already decided (an address
  // may name its own tab, and `resolveViewer` lets it win over `landing`), so
  // what goes down is the lens the viewer will actually open on.
  const initialAt = useMemo(
    () =>
      config?.initialAt === undefined
        ? undefined
        : {
            lens: config.lens ?? resolution.landing,
            runtimeStageId: config.initialAt.runtimeStageId,
          },
    [config?.initialAt, config?.lens, resolution.landing],
  );

  const cursor = useViewerCursor({ recorder, onCursor: config?.onCursor, initialAt });

  /**
   * What became of the address — reported to the host as DATA, and written
   * into the inference report as a sentence when the viewer did not do
   * exactly what was asked.
   *
   * An EXACT landing is silent on the report: nothing was substituted, so
   * there is nothing to disclose. A miss and an enclosing landing are both
   * disclosures — one moved nothing, the other moved somewhere else — and the
   * viewer says so rather than letting a host believe its address landed.
   */
  const onNavigation = config?.onNavigation;
  const navigation = cursor.navigation;
  const navigationReportedRef = useRef(false);
  useEffect(() => {
    if (navigation === null) return;
    // Once per mount, like the seeding itself — see `initialAt`.
    if (navigationReportedRef.current) return;
    navigationReportedRef.current = true;
    onNavigation?.(navigation);
    if (navigation.outcome === 'exact') return;
    deliverWarnings(
      [
        {
          code: 'navigation',
          message:
            navigation.outcome === 'missed'
              ? `footprint-viewer: initialAt did not land — ${navigation.message} Nothing moved.`
              : `footprint-viewer: initialAt landed on the enclosing stop — ${navigation.message}`,
        },
      ],
      onWarning,
    );
  }, [navigation, onNavigation, onWarning]);

  // The tab strip: controlled (`lens`/`onLensChange`) or self-driving.
  const [ownLens, setOwnLens] = useState<LensId>(resolution.landing);
  const active = config?.lens ?? ownLens;
  const onLensChange = config?.onLensChange;
  const selectLens = useCallback(
    (next: LensId) => {
      onLensChange?.(next);
      if (config?.lens === undefined) setOwnLens(next);
    },
    [onLensChange, config?.lens],
  );

  const visibleTabs = resolution.tabs.filter((t) => t.status !== 'hidden');
  const activeTab = resolution.tabs.find((t) => t.id === active);

  const pinConfig = useCallback(() => {
    const json = JSON.stringify(resolution.resolved, null, 2);
    // eslint-disable-next-line no-console
    console.info(
      `footprint-viewer: the resolved config — pass it as config to pin today's inference:\n${json}`,
    );
    try {
      void navigator.clipboard?.writeText(json);
    } catch {
      // The console line is the affordance; the clipboard is a courtesy.
    }
  }, [resolution]);

  let pane: React.ReactElement;
  if (activeTab === undefined) {
    pane = (
      <StateCard
        testId="viewer-no-tab"
        title={`No "${active}" tab here`}
        body={`This viewer offers: ${visibleTabs.map((t) => TAB_TITLES[t.id]).join(', ')}.`}
      />
    );
  } else if (activeTab.id === 'skillgraph') {
    // The debugger's own "No skill graph ran here" card is the honest empty
    // state — mount it either way, one voice.
    pane = <SkillGraphTab recorder={recorder} cursor={cursor} />;
  } else if (activeTab.status === 'empty') {
    pane = <EmptyState lens={activeTab.id} />;
  } else if (activeTab.id === 'story') {
    pane = (
      <StoryTab
        story={story}
        view={resolution.resolved.story.view}
        theme={config?.theme}
        appName={config?.appName}
        onWarning={onWarningWithConsole(onWarning)}
      />
    );
  } else if (activeTab.id === 'data') {
    pane = <DataTab recording={recording} recorder={recorder} humanizer={config?.humanizer} />;
  } else {
    const isWhy = activeTab.id === 'why';
    // The milestone axis IS the framework-free reading; turning
    // hideFrameworkSteps off shows every step under the Why tab.
    const granularity: 'step' | 'group' = isWhy
      ? resolution.resolved.why.hideFrameworkSteps
        ? 'group'
        : 'step'
      : 'step';
    pane = (
      <LensTab
        lens={activeTab.id}
        granularity={granularity}
        recording={recording}
        recorder={recorder}
        runner={runner}
        cursor={cursor}
        detailSlot={config?.slots?.detail}
        tracingEnabled={resolution.resolved.flow.tracing}
        theme={config?.theme}
        appName={config?.appName}
        humanizer={config?.humanizer}
        onWarning={onWarning}
      />
    );
  }

  const at = cursor.cursor;
  return (
    <div
      data-testid="viewer-ready"
      // Checkable honesty: "a tab switch keeps its place" is verifiable from
      // outside — adopted from neo, where it proved its worth in tests.
      data-cursor-step={at?.step ?? -1}
      data-cursor-total={at?.totalSteps ?? -1}
      data-cursor-stage={at?.runtimeStageId ?? ''}
      data-cursor-commit={at?.commitIdx ?? -1}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      {resolution.resolved.showTabs && (
        <div
          role="tablist"
          aria-label="Viewer readings"
          style={{
            display: 'flex',
            gap: 4,
            alignItems: 'center',
            padding: '6px 8px',
            borderBottom: '1px solid rgba(128,128,128,0.3)',
            flexWrap: 'wrap',
          }}
        >
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={tab.id === active}
              data-testid={`viewer-tab-${tab.id}`}
              data-tab-status={tab.status}
              onClick={() => selectLens(tab.id)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid rgba(128,128,128,0.35)',
                background: tab.id === active ? 'rgba(128,128,128,0.18)' : 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: tab.id === active ? 600 : 400,
                opacity: tab.status === 'empty' ? 0.6 : 1,
              }}
              title={
                tab.status === 'empty'
                  ? `${TAB_TITLES[tab.id]} — nothing to show in this recording (the tab says so itself)`
                  : TAB_TITLES[tab.id]
              }
            >
              {TAB_TITLES[tab.id]}
            </button>
          ))}
          {isDevMode() && (
            <button
              type="button"
              data-testid="viewer-pin-config"
              onClick={pinConfig}
              style={{
                marginLeft: 'auto',
                padding: '3px 8px',
                borderRadius: 6,
                border: '1px dashed rgba(128,128,128,0.5)',
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: 11,
                opacity: 0.7,
              }}
              title="Dev only: print the fully-resolved config as JSON — pass it as config to pin today's inference"
            >
              pin config
            </button>
          )}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{pane}</div>
    </div>
  );
}

/** The Story tab's missing-package sentence goes to the console too (dev),
 *  matching every other dev sentence's delivery. */
function onWarningWithConsole(
  onWarning: ((w: ViewerWarning) => void) | undefined,
): (w: ViewerWarning) => void {
  return (w) => {
    if (isDevMode()) {
      // eslint-disable-next-line no-console
      console.warn(w.message);
    }
    onWarning?.(w);
  };
}
