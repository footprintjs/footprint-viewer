/**
 * generate-skill-run — produce `demo/skill-run.json` (and the envelope form)
 * from a REAL agentfootprint run (house rule: fixture data is GENERATED,
 * never hand-authored). Mirrors agentfootprint-lens's demo generator pattern.
 *
 * The agent is a support-triage skill graph on a scripted mock provider, so
 * ONE turn exercises everything the viewer infers from: skill routing (the
 * SkillGraph tab), agent events (Why + Story), a commit log (Flow + tracing)
 * and the raw record (Data).
 *
 * Run:  npx tsx demo/generate-skill-run.ts
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Agent, defineTool } from 'agentfootprint';
import { defineSkill, skillGraph } from 'agentfootprint/context';
import { mock } from 'agentfootprint/providers';
import { buildRecordingEnvelope, recordRun } from 'agentfootprint/observe';

const here = dirname(fileURLToPath(import.meta.url));

const inspectCharge = defineTool({
  name: 'inspect_charge',
  description: 'Inspect a charge and return duplicate / refund eligibility evidence.',
  inputSchema: { type: 'object', properties: { invoice_id: { type: 'string' } } },
  execute: async () => ({ duplicate: true, refundable: true, amount: '$49.00', charge_id: 'ch_72A' }),
});

const issueRefund = defineTool({
  name: 'issue_refund',
  description: 'Issue a refund for a verified charge and amount.',
  inputSchema: { type: 'object', properties: { charge_id: { type: 'string' }, amount: { type: 'number' } } },
  execute: async () => ({ status: 'succeeded', refund_id: 're_91M', amount: '$49.00' }),
});

const support = defineSkill({
  id: 'support',
  description: 'Classify and route the customer request.',
  body: 'Identify the intent. Route to a reachable specialist before taking billing actions.',
});
const billing = defineSkill({
  id: 'billing',
  description: 'Inspect charges and determine the resolution path.',
  body: 'Inspect the charge before choosing a resolution. Never issue money from this skill.',
  tools: [inspectCharge],
});
const refunds = defineSkill({
  id: 'refunds',
  description: 'Authorize and issue verified refunds.',
  body: 'Refund only the verified charge id and amount. Confirm the refund id to the customer.',
  tools: [issueRefund],
});

const graph = skillGraph()
  .entry(support)
  .route(support, billing) //                                    model edge
  .route(billing, refunds, { onToolReturn: 'inspect_charge' }) // declared, deterministic
  .build();

let i = 0;
const scripted = mock({
  respond: () => {
    i += 1;
    if (i === 1)
      return {
        content: 'Billing first — inspecting the charge.',
        toolCalls: [{ id: 'c1', name: 'read_skill', args: { id: 'billing' } }],
        stopReason: 'tool_use' as const,
      };
    if (i === 2)
      return {
        content: 'Checking the charge.',
        toolCalls: [{ id: 'c2', name: 'inspect_charge', args: { invoice_id: 'in_8841' } }],
        stopReason: 'tool_use' as const,
      };
    if (i === 3)
      return {
        content: 'Eligible — issuing the refund.',
        toolCalls: [{ id: 'c3', name: 'issue_refund', args: { charge_id: 'ch_72A', amount: 4900 } }],
        stopReason: 'tool_use' as const,
      };
    return {
      content: 'Your duplicate $49.00 charge has been refunded (re_91M).',
      toolCalls: [],
      stopReason: 'stop' as const,
    };
  },
});

const agent = Agent.create({ provider: scripted, model: 'mock', maxIterations: 8 })
  .system('You are a customer support agent.')
  .skillGraph(graph)
  .build();

const recorder = recordRun(agent);
await agent.run({ message: 'I was charged twice for my Pro plan. Can you refund the duplicate?' });
const recording = recorder.toRecording();

// The archivable envelope around the SAME run — the shape the
// 'recording-envelope' source fetches. Built from the LIVE handle, which is
// the only thing that can state the drop count honestly.
const envelope = buildRecordingEnvelope(recorder, {
  run: { id: 'skill-run-fixture', complete: true },
});
recorder.stop();

const out = join(here, 'skill-run.json');
writeFileSync(out, JSON.stringify(recording));
const envelopeOut = join(here, 'skill-run.envelope.json');
writeFileSync(envelopeOut, JSON.stringify(envelope));

const snap = recording.snapshot as { commitLog?: unknown[] } | undefined;
// eslint-disable-next-line no-console
console.log(
  `wrote ${out} — ${recording.events?.length ?? 0} events, ${snap?.commitLog?.length ?? 0} commits` +
    ` · wrote ${envelopeOut} (format ${String((envelope as { format?: unknown }).format)})`,
);
