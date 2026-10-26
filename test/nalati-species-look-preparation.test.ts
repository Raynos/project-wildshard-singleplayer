import { currentHeldSource, currentHeldEntryWithout } from './fixtures/nalati-current-held';
import { originalSpeciesJson, originalSpeciesOutput } from './fixtures/nalati-original-species';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the complete retained metadata and frozen output pins.
import { readFileSync } from 'node:fs';
import { checkNalatiSpeciesSource } from './fixtures/check-nalati-species-source';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { prepareNalatiSpeciesLooks } from '../src/shards/nalati-grasslands/generators/speciesLookPreparation';
import originals from './fixtures/nalati-species-files.json' with { type: 'json' };
import heldOriginals from './fixtures/nalati-held-files.json' with { type: 'json' };

const original = v.parse(v.object({ hullBook: v.unknown(), looks: v.unknown() }),
  originalSpeciesJson('species.json'));
const compactBody = v.parse(v.object({ compactBody: v.unknown() }), original.hullBook).compactBody;
const rows = v.parse(v.object({ rows: v.array(v.looseObject({ kind: v.string(), attachments: v.optional(v.array(v.object({ geometry: v.unknown() }))) })) }), original.looks);
const crackRow = rows.rows.find(row => row.kind === 'balbal')?.attachments?.[0]?.geometry;
if (crackRow === undefined) throw new Error('Missing original crack geometry');
const kingPose = v.parse(v.object({ programs: v.unknown(), group: v.string() }),
  JSON.parse(readFileSync('src/shards/nalati-grasslands/data/goldenKingPose.generated.json', 'utf8')));

test('source look preparation preserves the complete original metadata and JSON assignment order', () => {
  const made = prepareNalatiSpeciesLooks(compactBody, kingPose, crackRow);
  expect(JSON.stringify(made.hullBook)).toBe(JSON.stringify(original.hullBook));
  expect(JSON.stringify(made.looks)).toBe(JSON.stringify(original.looks));
  expect(made.looks.rows).toHaveLength(10);
  expect(made.looks.rows.filter(row => row.animate !== undefined).map(row => row.kind)).toEqual(['balbal', 'eagle']);
  expect(made.looks.rows.filter(row => row.frame !== undefined).map(row => row.kind)).toEqual(['golden-king']);
  expect(made.looks.frames.king.smooth.some(row => row.initial === null)).toBe(true);
});

test('metadata loans own every nested input and rebuild without sharing authored state', () => {
  const compact = { body: [1, 2, 3] }, pose = { programs: [{ channel: 'original' }], group: 'king.pose' }, crack = { count: 7 };
  const made = prepareNalatiSpeciesLooks(compact, pose, crack);
  const before = JSON.stringify(made);
  compact.body[0] = 9; pose.programs[0] = { channel: 'mutated' }; crack.count = 99;
  expect(JSON.stringify(made)).toBe(before);
  const first = made.looks.rows[0]; if (first === undefined) throw new Error('Missing first species look');
  first.id = 'mutated'; first.sockets.push('mutated'); first.material.rim = -1;
  made.looks.frames.king.memory.pose = 999;
  const programs = Object.values(made.looks.poses)[0]?.programs;
  if (programs === undefined) throw new Error('Missing pose programs'); programs.splice(0);
  const rebuilt = prepareNalatiSpeciesLooks(compactBody, kingPose, crackRow);
  expect(JSON.stringify(rebuilt.looks)).toBe(JSON.stringify(original.looks));
  expect(JSON.stringify(rebuilt.hullBook)).toBe(JSON.stringify(original.hullBook));
});

test('the actual source constructor preserves all five complete original files', () => {
  checkNalatiSpeciesSource();
  expect(originals).toHaveLength(5);
  for (const pin of originals) {
    const bytes = originalSpeciesOutput(pin.path); expect(bytes.length, pin.path).toBe(pin.bytes);
    expect(hashImmutableBytes(bytes), pin.path).toBe(pin.sha256);
  }
});

test('the source consumer retains both complete original held documents from its current native look constructor', () => {
  const documents = [currentHeldSource.held.held, currentHeldSource.held.stealth];
  expect(documents).toHaveLength(heldOriginals.length);
  for (const [index, pin] of heldOriginals.entries()) {
    const bytes = new TextEncoder().encode(`${JSON.stringify(documents[index], null, 2)}\n`);
    expect(bytes.length, pin.path).toBe(pin.bytes); expect(hashImmutableBytes(bytes), pin.path).toBe(pin.sha256);
  }
});

test('an omitted look source refuses despite all original complete outputs remaining in the checkout', async () => {
  await expect(currentHeldEntryWithout('/generators/speciesLookPreparation.ts')).rejects.toThrow('Defining held source helper omitted');
  for (const pin of originals) {
    const bytes = originalSpeciesOutput(pin.path); expect(bytes.length, pin.path).toBe(pin.bytes);
    expect(hashImmutableBytes(bytes), pin.path).toBe(pin.sha256);
  }
});
