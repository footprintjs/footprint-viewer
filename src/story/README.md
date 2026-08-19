# story/ — the Story tab's two halves

- `storyFromRecording.ts` — the viewer's OWN derivation of the narrated beats,
  by replaying a recording's typed events through agentfootprint's own
  `agentThinkingTrace` recorder. It is synchronous and needs no optional peer,
  which is why it is what answers "does this run narrate at all?" for the tab
  strip and the stats — and it is the Story tab's fallback narrator under an
  agentthinkingui older than 0.30. `undefined` means "no story derives", which
  is the tab's honest empty fact.
- `loadStoryModule.ts` — the lazy import of `agentthinkingui`, the viewer's
  one OPTIONAL peer. Absent install → the Story tab's teaching card, never a
  crash. Its `fromRecording` (0.30+) is the package's own reader for an
  ARCHIVED run, and is the narrator the Story tab prefers: it puts the run's
  real task line and model on the trace (the player's topbar reads them) and
  leaves a cost ABSENT where nothing was measured instead of writing a
  `0.0s · 0 tok` that was never true.
- `StoryTab.tsx` (in tabs/) mounts the whole player — scene, transport and
  the notepad/inspector panel — or, on `view: 'notepad'`, those beats written
  out on their own inside the scope atui's stylesheet is written against.

Who narrates, in preference order: the producer's own **parcel** (never
overwritten) → the **library**'s `fromRecording` → the **viewer**'s own
derivation. The answer is on the tab's root as `data-story-source`.
