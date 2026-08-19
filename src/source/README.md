# source/ — where the recording comes from

One job: turn a `ViewerSource` (a url, an object in hand, a live recorder, or
the app's own fetch function) into the one recording the viewer shows — or
into the honest facts the screen says instead (a three-sentence teaching card
for wrong inputs, the app's own sentence for a gone recording, the error for
a failed one).

- `loadSource.ts` — the resolver. Reuses the lens doors' `readAgentRecording`
  and `describeReceived`, so a wrong input gets the same words at every door
  in the ecosystem.
- `refusals.ts` — every refusal sentence, spelled once and pinned verbatim in
  tests. Carries the local mirror of the doors' two "where to go" sentences
  (see the TODO there — an upstream export ask on agentfootprint-lens).
