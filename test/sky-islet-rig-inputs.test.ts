// oxlint-disable-next-line import/no-nodejs-modules -- Compare original authored outputs and isolate actual sealed-driver fixtures.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { skyIsletRigRows } from '../src/shards/far-reach/generators/isletRigRows';
import { isletMotionRows } from '../src/shards/far-reach/generators/isletMotion';

const jsonBytes = (value: unknown): Uint8Array => new TextEncoder().encode(`${JSON.stringify(value)}\n`);
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

test('motion source rows detach every caller and retire their publication job', () => {
  const first = isletMotionRows(), second = isletMotionRows(); first.channels.splice(0);
  expect(jsonBytes(second)).toEqual(jsonBytes(isletMotionRows()));
});
