# config/ — the whole API is one object

- `types.ts` — `ViewerConfig`, `ViewerSource`, the slot contract
  (`ViewerPaneProps`), and every reported shape. Every field except `source`
  has a default, and every absence means something stated.
- `validate.ts` — config mistakes are loud at mount: thrown, with full
  sentences. A conflict names BOTH sides (the AgentRecipe rule); a typo gets
  its closest real name.
- `resolve.ts` — explicit config beats inference, inference fills every
  absence, and the outcome is written down: tab states, dev report lines, and
  `exportInferredConfig` — the fully-resolved config as JSON, so today's
  inference becomes tomorrow's pinned file.
