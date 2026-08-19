# footprint-viewer

**One component that shows a recorded agent run.** Five readings — Story, Why,
Flow, Skill Graph, Data — as tabs over one shared cursor: switch tabs and you
keep your place, always.

You declare what you want to see, and the viewer does the wiring —
correctly, or it refuses in a sentence that names what you passed and where
to go. Pass nothing but the recording, and the viewer reads it and decides
what lights up.

```bash
npm install footprint-viewer agentfootprint-lens agentfootprint react react-dom
# optional — only if you want the Story tab:
npm install agentthinkingui
```

## Show a run — zero config

The recording is self-describing, so the viewer can decide on its own: a run
that walked a skill graph gets the Skill Graph tab lit; a run with a commit
log gets Flow with value-click tracing on; and so on. Each choice is one
plain line in the dev console, so nothing is decided silently.

```tsx
import { FootprintViewer } from 'footprint-viewer';

<FootprintViewer source={{ kind: 'recording', data: recording }} />
```

Where the recording comes from is up to you — four sources:

```tsx
{ kind: 'recording-envelope', url: '/api/runs/42' }  // the viewer fetches it
{ kind: 'recording', data: recording }               // already in hand
{ kind: 'live', recorder }                           // a run under way
{ kind: 'fetch', get: () => myTransport() }          // your own tickets/auth;
                                                     // may also carry story beats
```

## Pin the choices — a config

Everything the viewer inferred can be written down. `exportInferredConfig`
(or the dev-mode "pin config" button in the tab strip) prints the fully
resolved config as JSON — today's inference becomes tomorrow's pinned file.
Explicit config always beats inference, and a pinned tab whose events are
absent stays on screen with an honest empty state instead of vanishing.

```tsx
<FootprintViewer config={{
  source: { kind: 'recording-envelope', url: '/api/runs/' + id },
  lenses: ['story', 'why', 'flow', 'skillgraph', 'data'],
  landing: 'why',
  why:  { hideFrameworkSteps: true },
  flow: { tracing: true },   // the default — turning it off is a visible line
}} />
```

## Replace a pane — without losing the wiring

A replacement pane receives every capability the shipped pane had: the one
cursor in its three units, the value-click tracing walk, and the axis it is
mounted on. In dev, a pane that never uses a capability gets one named
console line — silenced only by writing the drop down:

```tsx
<FootprintViewer config={{
  source: { kind: 'recording', data: recording },
  slots: { detail: { component: MyPane, drops: ['tracing'] } },
}} />
```

## When something is wrong

A wrong input never renders a blank panel. It renders three sentences in the
lens doors' own voice: what this viewer reads, what you passed looks like
(named, not guessed at), and where to go. A tab that can work but has nothing
to show says so on screen. Config typos throw at mount, with the closest real
name — a typo should never ship.

## What rides where

- **Required peers:** `agentfootprint-lens` (Flow, Why, Skill Graph and Data
  all ride it), `agentfootprint` (the story narration and the recording
  contract), `react` / `react-dom`.
- **Optional peer:** `agentthinkingui` — only the Story tab. Declaring
  `'story'` without it renders a teaching card in that tab; nothing else
  changes.

## Fixtures and demo

Every fixture is generated from a real run (`demo/generate-skill-run.ts`,
`demo/generate-plain-run.ts`) — never hand-authored. `npm run demo` mounts
the zero-config viewer over the generated skill run at
http://localhost:5176.

MIT © Sanjay Krishna Anbalagan
