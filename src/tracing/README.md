# tracing/ — the value-click walk (Same-Rail Rewind)

Click a value, walk its writers, on the same ruler the tabs scrub — no second
cursor. Pure commit-log reading: a key's writer stops are the commits whose
trace touched it; `start(key)` moves the one cursor to the nearest writer
at-or-before where you stand, `prev`/`next` ride the rail, `done` steps off.

This is the capability that was once lost silently when an app replaced a
pane — which is why `flow.tracing` defaults to TRUE, and why the slot
contract hands a replacement the same walk (`ViewerPaneProps.tracing`).
