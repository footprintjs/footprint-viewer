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

## Open on a place — a deep link

A run detail page is a link somebody sends. `initialAt` lets that link carry a
place: the tab to open, and a **stop** — `runtimeStageId`, footprintjs's own
address for a stage (`llm#3`, `sf-tools/search#7`). The viewer resolves the
address against this run's own ruler once, when the recording is ready, and
every tab shares the cursor it lands on.

```tsx
<FootprintViewer
  source={source}
  config={{
    initialAt: { lens: 'why', runtimeStageId: 'call-llm#18' },
    onNavigation: (report) => {
      if (report.outcome === 'missed') {
        // Your own copy, from the report's own data:
        //   "call-llm#18 is not a stop on this run — nearest is llm#12."
        setNotice(report.message);
      }
    },
  }}
/>
```

The half worth knowing is the **miss**. An address from a bookmark, a chat
answer or another run may not exist on this one — and then nothing moves. The
cursor stays where it was, `onNavigation` reports `outcome: 'missed'` with the
`nearest` stop as an **offer** (never taken — moving there is your call), and
the dev report carries the same sentence. A viewer that jumped to something
near enough would be answering a question nobody asked, and the reader would
have no way to tell.

`initialAt` **seeds** the cursor; it does not control it. It is read once per
mount, so a reader who scrubs away is never dragged back. To send a mounted
viewer somewhere new, remount it: `key={address}`.

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

## The Story tab is the whole player

Story is the run replayed as its own story, on agentthinkingui's player: the
agent on stage with its thought bubbles, the rack of every tool it could see
with the picked one lit, the beat transport under them, and the notepad /
inspector panel beside them. That whole shell is the reading — the notepad is
one panel of it, and is still reachable on its own:

```tsx
<FootprintViewer source={source} config={{
  story: { view: 'notepad' },   // absent: 'player' — the whole shell
}} />
```

**Story keeps its own axis.** Its beats are a narration, not a step count, so
the player drives its own transport and the viewer's shared cursor is not
moved by a visit here — the other tabs keep their place exactly as they left
it. Forcing the one cursor onto beats would invent a correspondence the data
does not carry.

**Who narrates** is reported as `data-story-source` on the tab: `parcel` (the
story travelled with the recording — the producer's own voice, never
overwritten), `library` (agentthinkingui's own `fromRecording`, the default
for an archived run), or `viewer` (the viewer's own replay through
agentfootprint's narrator — the fallback that needs no optional peer, and the
one that answers "does this run narrate at all?" for the tab strip).

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
- **Optional peer:** `agentthinkingui` (0.30+) — only the Story tab. Declaring
  `'story'` without it renders a teaching card in that tab; nothing else
  changes. Import its stylesheet once in your app
  (`import 'agentthinkingui/styles.css'`) — the tab says so out loud if it
  loaded the package and not the styles.

## Fixtures and demo

Every fixture is generated from a real run (`demo/generate-skill-run.ts`,
`demo/generate-plain-run.ts`) — never hand-authored. `npm run demo` mounts
the zero-config viewer over the generated skill run at
http://localhost:5176.

MIT © Sanjay Krishna Anbalagan
