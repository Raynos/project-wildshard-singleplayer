import * as v from 'valibot';
import { expect, test } from 'vitest';
import { riggedHullRecipeRows } from '../src/sdk/bake/riggedHullRecipes';
import { PINE_HULLS, type RiggedHullsRow } from '../src/shards/pine-hollow/generators/creatureHulls';
import authored from '../src/shards/pine-hollow/data/creatureHulls.json' with { type: 'json' };

const num = v.pipe(v.number(), v.finite());
const rgb = v.tuple([num, num, num]);
const nativeFlap = v.strictObject({ yMin: num, y0: num, z0: num, slope: num, keep: num, bulge: num });
const nativeCoat = v.strictObject({
  /** the species default palette (the variant's `tint` overrides keys of it) */
  palette: v.picklist(['deer', 'elk', 'boar', 'bear']),
  /** the variant the hull was generated as: [kind, variant id] (its tint, over `palette`, is the atlas's coat) */
  source: v.tuple([v.string(), v.string()]),
  /** the palette keys: [dark, body, light] */
  keys: v.tuple([v.string(), v.string(), v.string()]),
  /** per variant id, the coat keys' target tones (sRGB; a `grizzle` entry paints silver guard-hair tips) */
  measured: v.exactOptional(v.record(v.string(), v.record(v.string(), rgb))),
});
const RiggedHullsSchema = v.strictObject({
  label: v.string(),
  rigs: v.array(v.string()),
  hulls: v.record(v.string(), v.string()),
  coats: v.record(v.string(), nativeCoat),
  flaps: v.exactOptional(v.record(v.string(), nativeFlap)),
  fur: v.exactOptional(v.record(v.string(), v.record(v.string(), v.strictObject({ rim: rgb, sheenColor: rgb })))),
});


const palettes = ['deer', 'elk', 'boar', 'bear'] as const;
type Native = v.InferOutput<typeof RiggedHullsSchema>;
const exactTypes: [RiggedHullsRow extends Native ? true : false, Native extends RiggedHullsRow ? true : false] = [true, true];

test('source hull recipes retain the complete native family, order and detached mutable rows', () => {
  expect(exactTypes).toEqual([true, true]);
  const before = v.parse(RiggedHullsSchema, authored), after = riggedHullRecipeRows(authored, palettes);
  expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  expect(PINE_HULLS).toEqual(before);
  const reversed = Object.fromEntries(Object.entries(authored).reverse());
  expect(JSON.stringify(riggedHullRecipeRows(reversed, palettes))).toBe(JSON.stringify(v.parse(RiggedHullsSchema, reversed)));
  after.rigs.push('another-rig');
  const coat = Object.values(after.coats)[0];
  if (coat === undefined) throw new Error('Missing original coat');
  coat.keys[0] = 'another-key';
  expect(riggedHullRecipeRows(authored, palettes)).toEqual(before);
  const minimal = { label: '', rigs: [], hulls: {}, coats: {} };
  expect(riggedHullRecipeRows(minimal, palettes)).toEqual(v.parse(RiggedHullsSchema, minimal));
  expect(Object.keys(riggedHullRecipeRows(minimal, palettes))).toEqual(['label', 'rigs', 'hulls', 'coats']);
  const other = riggedHullRecipeRows({ ...minimal, coats: { x: { palette: 'grey', source: ['', ''], keys: ['', '', ''] } } }, ['grey']);
  expect(other.coats['x']?.palette).toBe('grey');
});

test('source hull recipes retain all native strict, finite and exact-optional refusals', () => {
  const base = { label: '', rigs: [], hulls: {}, coats: {} };
  const coat = { palette: 'deer', source: ['deer', 'hind'], keys: ['dark', 'body', 'light'] };
  const flap = { yMin: 0, y0: 1, z0: 2, slope: 3, keep: 4, bulge: 5 };
  const bad: unknown[] = [null, [], {}, { ...base, extra: true }, { ...base, rigs: [1] }, { ...base, hulls: { x: 1 } },
    { ...base, flaps: undefined }, { ...base, fur: undefined },
    { ...base, coats: { x: { ...coat, palette: 'unknown' } } }, { ...base, coats: { x: { ...coat, source: ['one'] } } },
    { ...base, coats: { x: { ...coat, keys: ['one', 'two'] } } }, { ...base, coats: { x: { ...coat, extra: 1 } } },
    { ...base, coats: { x: { ...coat, measured: undefined } } },
    { ...base, coats: { x: { ...coat, measured: { hind: { body: [0, Infinity, 0] } } } } },
    { ...base, flaps: { x: { ...flap, extra: 1 } } },
    { ...base, fur: { x: { hind: { rim: [0, 0, 0], sheenColor: [0, Number.NaN, 0] } } } },
    { ...base, fur: { x: { hind: { rim: [0, 0], sheenColor: [0, 0, 0] } } } },
  ];
  for (const key of Object.keys(flap)) bad.push({ ...base, flaps: { x: { ...flap, [key]: Infinity } } });
  for (const input of bad) {
    expect(() => v.parse(RiggedHullsSchema, input)).toThrow();
    expect(() => riggedHullRecipeRows(input, palettes)).toThrow();
  }
});
