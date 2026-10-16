import * as v from 'valibot';
import { GrazerSchema, ChallengeGrazerSchema } from './grazers';
import { DiverSchema, PatrolDiverSchema } from './flyers';
import { ScriptSpeciesSchema } from './speciesScripts';
import { StalkerSchema, SkirmisherSchema, GuardianSchema, GuardianPatternsSchema, PerchHunterSchema } from './brains';
import { BorrowedDecisionSchema } from './decisionScripts';

const count = v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0), v.maxValue(65535));
/** The same callback-free policy declarations used by native recipes and product species catalogues. */
export const SpeciesBrainSchema = v.union([
  v.strictObject({ archetype: v.literal('grazer'), data: GrazerSchema.options[0] }),
  v.strictObject({ archetype: v.literal('grazer'), data: GrazerSchema.options[1], phaseSlots: count }),
  v.strictObject({ archetype: v.literal('diver'), data: DiverSchema }),
  v.strictObject({ archetype: v.literal('decision'), data: BorrowedDecisionSchema }),
  v.strictObject({ archetype: v.literal('challenge-grazer'), data: ChallengeGrazerSchema, phaseSlots: count }),
  v.strictObject({ archetype: v.literal('patrol-diver'), data: PatrolDiverSchema }),
  v.strictObject({ archetype: v.literal('script'), data: ScriptSpeciesSchema }),
  v.strictObject({ archetype: v.literal('stalker'), data: StalkerSchema }),
  v.strictObject({ archetype: v.literal('skirmisher'), data: SkirmisherSchema }),
  v.strictObject({ archetype: v.literal('guardian'), data: v.union([GuardianSchema, GuardianPatternsSchema]) }),
  v.strictObject({ archetype: v.literal('perch-hunter'), data: PerchHunterSchema }),
]);
