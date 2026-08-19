# story/ — the Story tab's two halves

- `storyFromRecording.ts` — derive the narrated beats from a recording, by
  replaying its typed events through agentfootprint's own `agentThinkingTrace`
  recorder. One narration engine, one voice; `undefined` means "no story
  derives", which is the tab's honest empty fact. A story that travels as its
  own parcel (the fetch source's `story` field) wins over this derivation.
- `loadStoryModule.ts` — the lazy import of `agentthinkingui`, the viewer's
  one OPTIONAL peer. Absent install → the Story tab's teaching card, never a
  crash.
- `StoryTab.tsx` (in tabs/) mounts whichever the config asked for:
  `view: 'player'` (the animated replay) or `'notepad'` (the beats, written).
