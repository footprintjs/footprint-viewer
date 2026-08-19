# tabs/ — the five readings, and what a tab says when it can't read

Every pixel here comes from the lens libraries the viewer arranges:

- `LensTab.tsx` — Flow (`granularity="step"`: every step) and Why
  (`granularity="group"`: the agent's own moments) are the same shipped
  `<Lens>` shell on two axes, controlled by the one cursor.
- `SkillGraphTab.tsx` — the lens's SkillGraphDebugger; its own "No skill
  graph ran here" card is the tab's honest empty state.
- `DataTab.tsx` — the run's own record: final state + the lens EventStream.
- `StoryTab.tsx` — agentthinkingui's player or notepad, imported lazily
  (the one optional peer); not installed → the teaching card below.
- `TeachingCard.tsx` — the three-sentence refusal grammar (what this reads /
  what you passed looks like / where to go), the doors' voice.
- `EmptyState.tsx` — a declared tab with nothing to show says so; absence is
  a rendered fact, never a vanished tab.
