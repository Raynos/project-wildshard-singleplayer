// oxlint-disable-next-line import/no-nodejs-modules -- Compare the complete retained decorative wires.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { decorativeRows, decorativeRowsOnGround } from '../src/shards/nalati-grasslands/generators/decorative';
import { readNativeTerrain } from '../src/sdk/bake/terrain';
import { withPortableMath } from '../src/commons/bake/portableMath';
import { jsonBytes } from '../scripts/bake-output.mjs';

const terrain = readFileSync('public/assets/baked/nalati-grasslands/terrain.bin');

test('native ground and byte adapters retain both complete original decorative wires', () => {
  const before = Uint8Array.from(terrain);
  const source = readNativeTerrain(terrain);
  const direct = withPortableMath(() => decorativeRowsOnGround(source.heightAt));
  const adapted = withPortableMath(() => decorativeRows(terrain));
  const bytes = jsonBytes(direct);
  expect(Buffer.compare(bytes, jsonBytes(adapted))).toBe(0);
  for (const directory of ['boot', 'data']) {
    const original = readFileSync(`src/shards/nalati-grasslands/${directory}/decorative.generated.json`);
    expect(Buffer.compare(bytes, original)).toBe(0);
  }
  expect(Buffer.compare(terrain, before)).toBe(0);
});

test('separate placement calls own their nested results and reject malformed terrain', () => {
  const ground = readNativeTerrain(terrain).heightAt;
  const first = withPortableMath(() => decorativeRowsOnGround(ground));
  const second = withPortableMath(() => decorativeRowsOnGround(ground));
  expect(second).toEqual(first);
  expect(second).not.toBe(first);
  if (!('phone' in first) || typeof first.phone !== 'object' || first.phone === null
    || !('phone' in second)) throw new Error('Missing decorative phone profile');
  expect(first.phone).not.toBe(second.phone);
  Object.assign(first.phone, { horses: null });
  expect(jsonBytes(second)).toEqual(jsonBytes(withPortableMath(() => decorativeRowsOnGround(ground))));
  expect(() => decorativeRows(new Uint8Array(0))).toThrow('Native terrain byte cap');
});
