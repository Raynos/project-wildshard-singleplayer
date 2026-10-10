import { expect, it } from 'vitest';
import * as v from 'valibot';
import { nalatiWitness } from './native';

it('executes the actual native installer while refusing incomplete whole-shard gameplay coverage', () => {
  const result = nalatiWitness('headless');
  expect(result.status).toBe(1); expect(result.stderr).toBe('');
  const report = v.parse(v.object({ slug: v.string(), entry: v.string(), compatible: v.boolean(),
    headless: v.object({ status: v.string(), nativeBoot: v.boolean(), actors: v.number(), ticksExecuted: v.number(), checkpointHash: v.string() }),
    missing: v.array(v.string()) }), JSON.parse(result.stdout));
  expect(report).toMatchObject({ slug: 'nalati-grasslands', entry: 'runtime/headless.ts', compatible: false,
    headless: { status: 'partial', nativeBoot: true, actors: 35, ticksExecuted: 120 } });
  expect(report.headless.checkpointHash).toMatch(/^[a-f0-9]{64}$/u);
  for (const gap of ['golden-king', 'storm-titan', 'quests-and-gameplay-ledger', 'entryways']) expect(report.missing).toContain(gap);
});
