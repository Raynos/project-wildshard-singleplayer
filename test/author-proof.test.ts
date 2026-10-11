// oxlint-disable-next-line import/no-nodejs-modules -- The author CLI proof owns disposable local products.
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep authored test products outside the shared repository.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the proof's explicit local input files.
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import * as v from 'valibot';
import { emptyShardfile } from '../src/sdk/author';
import { parseShardfile } from '../src/sdk/shardfile';
import { proveAuthorSimulation } from '../src/sdk/headless';
import { authorProofExample } from '../scripts/docs/authoring/readers';
import { AuthorProofPlanSchema, AuthorProofReportSchema } from '../src/sdk/tickProtocol';

const source = (slug: string, x = 0) => {
  const base = emptyShardfile({ slug, name: 'Author proof', author: 'SDK', revision: 1, seed: 17 });
  return parseShardfile({ ...base, quests: { flags: ['reached', 'complete'], dialogue: [],
    triggers: [{ id: 'beacon-region', kind: 'region', flag: 'reached', x, z: 0, radius: 2 }],
    quests: [{ id: 'beacon', title: 'The beacon', completeFlag: 'complete', steps: [{ id: 'reach', objective: 'Reach beacon', done: { all: ['reached'] } }], onComplete: { fact: 'beacon.lit' } }],
  }, ledger: [{ fact: 'beacon.lit', origin: { kind: 'engine', source: 'quest:beacon' }, rewards: [{ kind: 'achievement', id: 'beacon', title: 'Beacon keeper', threshold: 1 }] }] });
};
const plan = () => v.parse(AuthorProofPlanSchema, { version: 1, tape: Array.from({ length: 8 }, () => []), checkpointTick: 4, requiredFacts: ['beacon.lit'] });

it('proves two authored packages through only public author inputs, using actual grid restore and ledger reload', async () => {
  for (const slug of ['mesa-proof', 'pastel-proof']) {
    const result = await proveAuthorSimulation(source(slug), new Map(), plan());
    expect(result.grid).toEqual({ reserveBeforePhysics: true, runtimeFence: true, refusedSave: true, restored: true, frozenTicks: 5, loads: 2, leasesAfterDispose: 0 });
    expect(result.ledger).toEqual({ facts: [{ name: 'beacon.lit', actorId: 'beacon', tick: 1 }], granted: 1, durableReload: true, duplicateStable: true });
  }
}, 20_000);

it('refuses a missing real fact and forged fact inputs rather than manufacturing a passing report', async () => {
  await expect(proveAuthorSimulation(source('absent-proof', 100), new Map(), plan())).rejects.toThrow('native fact missing');
  expect(() => v.parse(AuthorProofPlanSchema, { ...plan(), facts: [{ name: 'beacon.lit' }] })).toThrow();
  expect(() => v.parse(AuthorProofPlanSchema, { ...plan(), checkpointTick: 9 })).toThrow();
  expect(v.parse(AuthorProofPlanSchema, authorProofExample()).checkpointTick).toBe(60);
  expect(() => v.parse(AuthorProofPlanSchema, { ...plan(), tape: Array.from({ length: 4097 }, () => []) })).toThrow();
}, 20_000);

it('runs the same native proof from the author CLI without a repository-only grader', async () => {
  const { runCli } = await import('../src/sdk/cli');
  const directory = mkdtempSync(resolve(tmpdir(), 'author-proof-cli-'));
  const messages: string[] = [], original = console.info;
  try {
    writeFileSync(resolve(directory, 'shard.json'), JSON.stringify(source('cli-proof')));
    writeFileSync(resolve(directory, 'proof.json'), JSON.stringify(plan()));
    console.info = (message: string) => { messages.push(message); };
    await runCli(['prove', resolve(directory, 'shard.json'), resolve(directory, 'proof.json')]);
    expect(v.parse(AuthorProofReportSchema, JSON.parse(messages.join(''))).ledger.granted).toBe(1);
  } finally { console.info = original; rmSync(directory, { recursive: true, force: true }); }
}, 20_000);
