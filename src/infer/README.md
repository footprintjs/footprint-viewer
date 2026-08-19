# infer/ — the recording decides what lights up

Zero-config is the default: the envelope is self-describing, so the viewer
measures what the recording carries — story beats, agent events, a commit
log, skill routing — and lights the matching tabs. Explicit config always
beats inference, and a pinned tab whose events are absent renders the honest
empty state instead of vanishing.

- `inference.ts` — the measurements (`inferCapabilities`). Skill routing is
  the lens's own `selectSkillRoute(...).hasRouting` — one truth, imported.
- `report.ts` — every inferred choice is one dev-mode console line, and the
  same sentence as data through `onWarning`. Production prints nothing.
