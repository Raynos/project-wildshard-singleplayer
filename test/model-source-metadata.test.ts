import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- The original model metadata is a tracked source oracle.
import { readFileSync } from 'node:fs';
import { modelPrototypeFacts, modelSourceMetadata, modelCoverMetadata } from '../src/sdk/bake/sourceMetadata';
import original from './fixtures/driftwood-island-original.json' with { type: 'json' };
import type { DriftwoodIslandFacts } from '../src/shards/driftwood-isle/generators/islandFacts';

const finite = v.pipe(v.number(), v.finite()), point = v.object({ x: finite, y: finite, z: finite });
const planted = v.object({ x: finite, z: finite, h: finite, lean: finite, leanDir: finite, rot: finite, fronds: finite });
const facts = v.object({ protos: v.array(v.object({ name: v.string(), present: v.boolean(), empty: v.boolean(),
  min: point, max: point, half: finite, top: finite })), extraPalms: v.array(planted), bake: v.object({ bounceGain: finite, sunY: finite }) });
const source = v.object({ protos: v.array(v.object({ name: v.string() })), lod: v.record(v.string(), v.number()),
  extraPalms: v.array(planted), bake: v.object({ bounceGain: finite, refSun: v.tuple([finite, finite, finite]) }) });
const cover = v.object({ protos: v.array(v.object({ name: v.string(), kind: v.string() })), mustDraw: v.number() });

function outcome(run: () => unknown): unknown {
  try { return { rows: run() }; }
  catch (error) { if (error instanceof v.ValiError) return { issues: error.issues }; throw error; }
}

test('cached model facts preserve complete original rows and exact finite refusals', () => {
  expectTypeOf<ReturnType<typeof modelPrototypeFacts>>().toEqualTypeOf<DriftwoodIslandFacts>();
  expect(JSON.stringify(modelPrototypeFacts(original))).toBe(JSON.stringify(v.parse(facts, original)));
  const proto = original.protos[0];
  if (proto === undefined) throw new Error('Missing original prototype');
  for (const input of [null, {}, { ...original, extra: true }, { ...original, protos: [{ ...proto, half: Infinity }] },
    { ...original, bake: { ...original.bake, sunY: Number.NaN } }]) {
    expect(outcome(() => modelPrototypeFacts(input))).toEqual(outcome(() => v.parse(facts, input)));
  }
});

test('model source and cover metadata retain projections, storage order and numeric laws', () => {
  const input: unknown = JSON.parse(readFileSync('public/assets/models/driftwood-blender/island.json', 'utf8'));
  for (const [read, schema] of [[modelSourceMetadata, source], [modelCoverMetadata, cover]] as const) {
    expect(JSON.stringify(read(input))).toBe(JSON.stringify(v.parse(schema, input)));
    expect(read(input)).not.toBe(input);
    for (const bad of [null, {}, { protos: [{ name: 4 }], mustDraw: 0 }, { protos: [], mustDraw: Number.NaN }]) {
      expect(outcome(() => read(bad))).toEqual(outcome(() => v.parse(schema, bad)));
    }
  }
  expect(modelCoverMetadata({ protos: [], mustDraw: Infinity, unrelated: true })).toEqual({ protos: [], mustDraw: Infinity });
});
