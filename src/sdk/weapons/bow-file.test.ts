// oxlint-disable-next-line import/no-nodejs-modules -- Read the tracked original authored bow file in this Node fixture.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parse } from 'valibot';
import { HeldBowFileSchema } from '@wildshard/format/weaponProfiles';
import { parseHeldBowFile } from './bowProfile';

const original: unknown = JSON.parse(readFileSync('public/assets/nalati/baked/recurve-pool.json', 'utf8'));

test('author bow admission preserves the complete original file', () => {
  expect(parseHeldBowFile(original)).toEqual(parse(HeldBowFileSchema, original));
});

test('author bow admission keeps strict missing and unknown field refusals', () => {
  const admitted = parseHeldBowFile(original);
  expect(() => parseHeldBowFile({ ...admitted, extra: true })).toThrow();
  const { pool, ...missing } = admitted;
  expect(pool).toBeDefined();
  expect(() => parseHeldBowFile(missing)).toThrow();
});
