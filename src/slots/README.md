# slots/ — replace a pane without losing the wiring

A slot replacement receives every capability the shipped pane had, as props
(`ViewerPaneProps`): the one cursor in its three units, the tracing walk, the
axis it is mounted on, and the run itself. "Replaced a pane, silently lost
tracing" is the incident this package exists to end — so in dev builds the
capability entries are access-tracked, and a pane that never reads one gets
ONE named console line after its first render. Silence is only allowed when
it is written down: `slots: { detail: { component: MyPane, drops: ['tracing'] } }`.
Production builds carry no tracking and no warning.

- `capability.ts` — the tracking proxy, the drops vocabulary, the audit sentence.
- `DetailSlotBridge.tsx` — adapts the lens shell's detail slot to the viewer's
  contract; one component serves both Flow and Why (`axis.granularity`).
