# Changelog

## 0.1.0

The first release — the one front door for viewing a recorded agent run.

- `<FootprintViewer>`: five readings (Story, Why, Flow, Skill Graph, Data) as
  tabs over ONE shared cursor, carried across tabs by commit index.
- Config is optional: the viewer infers what lights up from the recording
  itself, reports each choice (one dev line each), and explicit config always
  beats inference. A pinned tab with nothing to show renders an honest empty
  state instead of vanishing.
- `exportInferredConfig` (+ the dev-mode "pin config" affordance): the fully
  resolved config as JSON — today's inference becomes tomorrow's pinned file.
- Four sources: a fetched envelope URL, a recording in hand, a live recorder,
  and the app-owned fetch function (which may carry story beats as their own
  parcel; its `RecordingUnavailable` message shows verbatim).
- Refusals in the lens doors' voice: wrong inputs render a three-sentence
  teaching card (`readAgentRecording` / `describeReceived`, imported —
  one refusal voice across the ecosystem).
- Capability-accounted slots: a replacement detail pane receives the full
  contract (cursor in three units, the tracing walk, the axis); in dev, an
  unused capability is one named console line, silenced only by declaring
  `drops`.
- Defaults encode the incidents: `flow.tracing` TRUE (turning it off is a
  visible line), `whenEmpty` 'say-so'; config conflicts are errors naming
  both sides.
- The Story tab is the whole PLAYER: the scene (the agent, its thought
  bubbles, the rack of every tool it could see with the picked one lit), the
  beat transport, and the notepad / inspector panel beside them. The notepad
  alone is one panel of that shell, still reachable as
  `story: { view: 'notepad' }`. Story keeps its own axis — its beats are a
  narration, not a step count, so the player drives its own transport and the
  viewer's shared cursor is untouched by a visit there.
- The Story tab's `agentthinkingui` is an optional peer, imported lazily —
  declared without being installed renders a teaching card, never a crash.
- Who narrates is a reported fact (`data-story-source`): the producer's own
  parcel wins, then agentthinkingui's own `fromRecording` (0.30+, the reader
  for an archived run — it carries the run's real task line and model, and
  leaves a cost absent where nothing was measured), then the viewer's own
  replay through agentfootprint's narrator, which needs no optional peer and
  is what answers "does this run narrate at all?" for the tab strip.
- `data-cursor-*` honesty attributes on the root, so "a tab switch keeps its
  place" is verifiable from outside.
- Out of scope, deliberately: live-edge following, layout editing,
  persistence, metrics.
