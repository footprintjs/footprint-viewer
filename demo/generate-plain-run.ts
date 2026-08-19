/**
 * generate-plain-run — produce `demo/plain-run.json` from a REAL
 * agentfootprint run with NO skill graph, so the inference matrix has its
 * other column: agent events and a commit log, but no skill routing.
 *
 * Also writes the two WRONG-SHAPE fixtures the refusal tests read — both
 * extracted from this same real run, never hand-authored:
 *
 *   demo/commit-log.json     the bare commit log (an array of commit bundles)
 *   demo/snapshot-only.json  a footprintjs run snapshot (commit log, no
 *                            agent events around it)
 *
 * Run:  npx tsx demo/generate-plain-run.ts
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Agent, defineTool } from 'agentfootprint';
import { mock } from 'agentfootprint/providers';
import { recordRun } from 'agentfootprint/observe';

const here = dirname(fileURLToPath(import.meta.url));

const lookupWeather = defineTool({
  name: 'lookup_weather',
  description: 'Get current weather for a city.',
  inputSchema: { type: 'object', properties: { city: { type: 'string' } } },
  execute: async () => ({ city: 'Pittsburgh', tempF: 71, sky: 'clear' }),
});

let i = 0;
const scripted = mock({
  respond: () => {
    i += 1;
    if (i === 1)
      return {
        content: 'Checking the weather.',
        toolCalls: [{ id: 'w1', name: 'lookup_weather', args: { city: 'Pittsburgh' } }],
        stopReason: 'tool_use' as const,
      };
    return {
      content: 'It is 71°F and clear in Pittsburgh.',
      toolCalls: [],
      stopReason: 'stop' as const,
    };
  },
});

const agent = Agent.create({ provider: scripted, model: 'mock', maxIterations: 4 })
  .system('You are a helpful assistant.')
  .tools([lookupWeather])
  .build();

const recorder = recordRun(agent);
await agent.run({ message: 'What is the weather in Pittsburgh?' });
const recording = recorder.toRecording();
recorder.stop();

const out = join(here, 'plain-run.json');
writeFileSync(out, JSON.stringify(recording));

// The wrong shapes, cut from the same real run.
const snapshot = recording.snapshot as { commitLog?: unknown[] } | null;
const commitLog = snapshot?.commitLog ?? [];
writeFileSync(join(here, 'commit-log.json'), JSON.stringify(commitLog));
writeFileSync(join(here, 'snapshot-only.json'), JSON.stringify(snapshot));

// eslint-disable-next-line no-console
console.log(
  `wrote ${out} — ${recording.events?.length ?? 0} events, ${commitLog.length} commits` +
    ` · wrote commit-log.json (${commitLog.length} bundles) · wrote snapshot-only.json`,
);
