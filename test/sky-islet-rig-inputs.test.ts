// oxlint-disable-next-line import/no-nodejs-modules -- Compare original authored outputs and isolate actual sealed-driver fixtures.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyIsletRigRows } from '../src/shards/far-reach/generators/isletRigRows';
import { isletMotionRows } from '../src/shards/far-reach/generators/isletMotion';
import { isletGlb, isletScenes } from '../src/shards/far-reach/generators/isletScene';

const jsonBytes = (value: unknown): Uint8Array => new TextEncoder().encode(`${JSON.stringify(value)}\n`);
// GR5: the islet scenes and pool are no longer written to files (the product and the map call these functions);
// their original bytes stay pinned by hash.
const pinned = [
  { id: 'islet motion', make: () => jsonBytes(isletMotionRows()), bytes: 32_303, hash: '156bf866d10eeb077b94a752deac1bf5264486dedb328702d2d81ac85cccfd68' },
  { id: 'islet scenes', make: () => jsonBytes(isletScenes()), bytes: 10_644, hash: 'c78727f373fef3a73e342c63969681e2322cf7400ba9614dffb48df51197b905' },
  { id: 'islet pool', make: isletGlb, bytes: 12_956, hash: '3c18959354dfbd48b6faa7f68d5a4072b88e2b4c2133084b9cee8e07f6c1f048' },
];
const original = v.parse(v.object({ rigs: v.unknown(), rails: v.unknown() }), JSON.parse(readFileSync('src/shards/far-reach/data/isletRig.json', 'utf8')));

test('authored rig rows retain every original chain anchor, rail box and field order', () => {
  expect(JSON.stringify(skyIsletRigRows())).toBe(JSON.stringify(original));
});

test('each authored rig bank owns its chain and rail arrays', () => {
  const first = skyIsletRigRows(), second = skyIsletRigRows(), local = first.rigs[0]?.local[0], rails = first.rails[0];
  if (local === undefined || rails === undefined) throw new Error('Missing original chain/rail bank');
  local[0] += 1; rails.length = 0;
  expect(JSON.stringify(second)).toBe(JSON.stringify(original));
  expect(JSON.stringify(skyIsletRigRows())).toBe(JSON.stringify(original));
});

test.each(pinned)('the $id keep their complete original bytes from authored rig rows', ({ make, bytes, hash }) => {
  const made = make();
  expect(made.byteLength).toBe(bytes);
  expect(hashImmutableBytes(made)).toBe(hash);
});

test('motion source rows detach every caller and retire their publication job', () => {
  const first = isletMotionRows(), second = isletMotionRows(); first.channels.splice(0);
  expect(jsonBytes(second)).toEqual(jsonBytes(isletMotionRows()));
});
