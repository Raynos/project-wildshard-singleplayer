import * as v from 'valibot';
import { NativeGroupRowsSchema, PageGroupRowsSchema, PopulationKnockdownSchema } from '@wildshard/format/creatures';
import { WildlifePopulationSchema } from '@wildshard/format/wildlifePopulation';
import { ForagerPopulationSchema } from '@wildshard/format/ambientLife';
import { PopulationFieldSchema } from '@wildshard/format/populationEnvironment';

/** Admit data-only native group ownership, ordered steps and guest bindings without a live world. */
export function parseNativeGroupRows(input: unknown): v.InferOutput<typeof NativeGroupRowsSchema> { return v.parse(NativeGroupRowsSchema, input); }
/** Admit native habitat fields through the same bounded runtime schema. */
export function parsePopulationField(input: unknown): v.InferOutput<typeof PopulationFieldSchema> { return v.parse(PopulationFieldSchema, input); }
/** Admit page-owned group metadata, contacts and effects. */
export function parsePageGroupRows(input: unknown): v.InferOutput<typeof PageGroupRowsSchema> { return v.parse(PageGroupRowsSchema, input); }
/** Admit the complete native wildlife population declaration. */
export function parseWildlifePopulation(input: unknown): v.InferOutput<typeof WildlifePopulationSchema> { return v.parse(WildlifePopulationSchema, input); }
/** Preserve the required population/frame/knockdown envelope when reading authored motion metadata. */
export function parsePopulationKnockdownSource(input: unknown): v.InferOutput<typeof PopulationKnockdownSchema> {
  return v.parse(v.object({ population: v.object({ frame: v.object({ knockdown: PopulationKnockdownSchema }) }) }), input).population.frame.knockdown;
}
/** Preserve the required population/forager/row envelope without installing its native host. */
export function parsePopulationForagerSource(input: unknown): v.InferOutput<typeof ForagerPopulationSchema> {
  return v.parse(v.object({ population: v.object({ forager: v.object({ row: ForagerPopulationSchema }) }) }), input).population.forager.row;
}
