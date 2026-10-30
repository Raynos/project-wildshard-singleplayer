import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import type { AuthorMapPalette } from '../src/sdk/bake/mapRaster';
import type { MapPaletteRow } from '../src/format/minimap';
import type { GroundRows } from '../src/format/terrain';
import type { ScalarLatticeRows, ScalarTripletRows } from '../src/format/scalarChannel';
import type { GeographyRows } from '../src/shards/nalati-grasslands/data/geographyTypes';
import { toonHeldArmsRows } from '../src/sdk/rows';
import { HeldArmsSchema } from '../src/format/heldArms';

function outcome(run: () => unknown): unknown {
  try { return { rows: run() }; }
  catch (error) { if (error instanceof v.ValiError) return { issues: error.issues }; throw error; }
}

test('geography, palette and toon-held ports retain complete native mutable/readonly contracts', () => {
  expectTypeOf<AuthorMapPalette>().toEqualTypeOf<MapPaletteRow>();
  expectTypeOf<GeographyRows['map']>().toEqualTypeOf<MapPaletteRow>();
  expectTypeOf<GeographyRows['ground']>().toEqualTypeOf<GroundRows>();
  expectTypeOf<GeographyRows['channels']['wet']>().toEqualTypeOf<ScalarLatticeRows>();
  expectTypeOf<GeographyRows['pigment']>().toEqualTypeOf<ScalarTripletRows>();
  expectTypeOf<ReturnType<typeof toonHeldArmsRows>>().toEqualTypeOf<v.InferOutput<(typeof HeldArmsSchema)['options'][0]>>();
});

test('toon-held admission retains its exact original option grammar and refusal ordering', () => {
  for (const bad of [null, {}, { slug: 'bad', look: {}, claims: [] }, { slug: 'bad', claims: () => [] },
    { active: 'primary', tools: [] }]) {
    expect(outcome(() => toonHeldArmsRows(bad))).toEqual(outcome(() => v.parse(HeldArmsSchema.options[0], bad)));
    expect(() => toonHeldArmsRows(bad)).toThrow();
  }
});
