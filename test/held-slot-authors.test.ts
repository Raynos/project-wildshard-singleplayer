// oxlint-disable-next-line import/no-nodejs-modules -- The SDK author ports must retain native Node's renderer refusal boundary.
import { execFileSync } from 'node:child_process';
import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import { mountedLoadoutRows, bowVariantRows, heldSlotsRows } from '../src/sdk/rows';
import { MountedLoadoutSchema } from '../src/format/loadout';
import { BowVariantSchema } from '../src/format/bowVariantRows';
import { parseHeldSlots } from '../src/format/heldArms';
import { heldSlotRows } from '../src/shards/nalati-grasslands/generators/heldSlots';
import loadout from '../src/shards/nalati-grasslands/data/loadout.json' with { type: 'json' };
import variants from '../src/shards/nalati-grasslands/data/legendaryWeapons.json' with { type: 'json' };
import power from '../src/shards/nalati-grasslands/boot/bowVariant.json' with { type: 'json' };
import { hashImmutableBytes } from '../src/sdk/immutable';
import original from './fixtures/held-slot-author-original.json' with { type: 'json' };

const authored = { ...loadout, variants: { bow: { id: `weapon.${variants.goldenBow.id}`, name: variants.goldenBow.name }, blade: { id: `weapon.${variants.naizagai.id}`, name: variants.naizagai.name } } };

test('complete mounted, reward and slot types retain the defining schemas and every original wire byte', () => {
  expectTypeOf<ReturnType<typeof mountedLoadoutRows>>().toEqualTypeOf<v.InferOutput<typeof MountedLoadoutSchema>>();
  expectTypeOf<ReturnType<typeof bowVariantRows>>().toEqualTypeOf<v.InferOutput<typeof BowVariantSchema>>();
  expectTypeOf<ReturnType<typeof heldSlotsRows>>().toEqualTypeOf<ReturnType<typeof parseHeldSlots>>();
  expect(mountedLoadoutRows(authored)).toEqual(v.parse(MountedLoadoutSchema, authored));
  expect(bowVariantRows(power)).toEqual(v.parse(BowVariantSchema, power));
  const rows = heldSlotRows(authored, power), bytes = new TextEncoder().encode(JSON.stringify(rows));
  expect({ bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) }).toEqual(original);
  expect(heldSlotsRows(rows)).toEqual(parseHeldSlots(rows));
});

test('native registration, destination, refill, upgrade and JSON refusals still run at author admission', () => {
  const rows = heldSlotRows(authored, power);
  for (const invalid of [
    { ...rows, registration: [...rows.registration, rows.registration[0]] },
    { ...rows, equipment: { ...rows.equipment, primary: 'missing' } },
    { ...rows, refills: [{ slot: 'blade', kind: 'add-magazine' }] },
    { ...rows, upgrades: rows.upgrades.map(row => ({ ...row, slot: 'polearm' })) },
    { ...rows, execute: () => 1 },
  ]) { expect(() => heldSlotsRows(invalid)).toThrow(); expect(() => parseHeldSlots(invalid)).toThrow(); }
  expect(() => mountedLoadoutRows({ ...authored, initial: 'missing' })).toThrow();
  expect(() => bowVariantRows({ ...power, execute: () => 1 })).toThrow();
});

test('actual loadout row admission imports no native renderer or weapon service', () => {
  const source = `import {mountedLoadoutRows,bowVariantRows,heldSlotsRows} from './src/sdk/rows.ts';
    const results=[mountedLoadoutRows,bowVariantRows,heldSlotsRows].map(read=>{try{read({});return false;}catch{return true;}});
    console.log(JSON.stringify(results));`;
  const result = execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e', source], { encoding: 'utf8', timeout: 30_000 });
  expect(JSON.parse(result)).toEqual([true, true, true]);
});
