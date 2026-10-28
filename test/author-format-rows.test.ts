import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import { authorFormatRows } from '../src/sdk/formatJsonSchema';
import { SpecimenMaterialSchema } from '../src/format/specimenCatalogue';
import { SceneDressingSchema } from '../src/format/sceneDressing';
import type { CatalogueEconomySchema } from '../src/format/catalogueEconomy';
import { QuestFiguresSchema, type KitFigureCardsSchema } from '../src/format/questFigures';
import { driftwoodFigureCommerceObservation } from './fixtures/driftwood-figure-commerce-observation';
import original from './fixtures/driftwood-figure-commerce-original.json' with { type: 'json' };

function outcome(run: () => unknown): unknown {
  try { return { result: run() }; }
  catch (error) { if (error instanceof v.ValiError) return { issues: error.issues }; throw error; }
}

test('finite author admission retains complete native output types and excludes nonvalidators', () => {
  expectTypeOf<ReturnType<typeof authorFormatRows<'catalogueEconomy.CatalogueEconomySchema'>>>().toEqualTypeOf<v.InferOutput<typeof CatalogueEconomySchema>>();
  expectTypeOf<ReturnType<typeof authorFormatRows<'questFigures.QuestFiguresSchema'>>>().toEqualTypeOf<v.InferOutput<typeof QuestFiguresSchema>>();
  expectTypeOf<ReturnType<typeof authorFormatRows<'questFigures.KitFigureCardsSchema'>>>().toEqualTypeOf<v.InferOutput<typeof KitFigureCardsSchema>>();
  type Names = Parameters<typeof authorFormatRows>[0];
  expectTypeOf<Extract<Names, 'nativePhysics.nativeBodySchema' | 'namedJsonContracts.HEADLESS_ASSEMBLY_JSON_SCHEMA'>>().toEqualTypeOf<never>();
  expect(() => { Reflect.apply(authorFormatRows, undefined, ['nativePhysics.nativeBodySchema', {}]); }).toThrow('requires a validator');
  expect(() => { Reflect.apply(authorFormatRows, undefined, ['namedJsonContracts.HEADLESS_ASSEMBLY_JSON_SCHEMA', {}]); }).toThrow('requires a validator');
  for (const name of ['unknown.Schema', 'constructor', '__proto__']) expect(() => { Reflect.apply(authorFormatRows, undefined, [name, {}]); }).toThrow('Unknown author format');
});

test('native strict/default/semantic admission and complete issue ordering remain exact', () => {
  for (const value of [{ id: 'mat', family: 'lowpoly' }, { id: 'mat', family: 'painterly', rim: .3, color: [1, .7, .2] },
    {}, { id: '', family: 'missing', rim: Number.NaN }, { id: 'mat', family: 'lowpoly', extra: true },
    { id: 'mat', family: 'painterly', textureFallback: [0, 0, 0, 300] }]) {
    expect(outcome(() => authorFormatRows('specimenCatalogue.SpecimenMaterialSchema', value))).toEqual(outcome(() => v.parse(SpecimenMaterialSchema, value)));
  }
  const malformed = { figures: [{ id: 'missing', feet: () => undefined }] };
  expect(outcome(() => authorFormatRows('questFigures.QuestFiguresSchema', malformed))).toEqual(outcome(() => v.parse(QuestFiguresSchema, malformed)));
  expect(() => authorFormatRows('questFigures.QuestFiguresSchema', malformed)).toThrow();
});

test('native defaults are admitted without adding fields to the author input', () => {
  const draft = { name: 'defaults', catalogues: [], packs: {}, geometry: {}, materials: {}, layers: [], statics: [], animations: [] };
  const rows = authorFormatRows('sceneDressing.SceneDressingSchema', draft);
  expect(rows).toEqual(v.parse(SceneDressingSchema, draft));
  expect([rows.instances, rows.staticModels, rows.sites, rows.emitters]).toEqual([[], [], [], []]);
  expect(draft).not.toHaveProperty('instances'); expect(draft).not.toHaveProperty('staticModels');
});

test('every original figure, quest card, economy and trader wire remains unchanged', () => {
  expect(driftwoodFigureCommerceObservation()).toEqual(original);
});
