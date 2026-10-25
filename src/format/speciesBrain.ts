import * as v from 'valibot';
import { GrazerSchema, ChallengeGrazerSchema } from './grazers';
import { DiverSchema, PatrolDiverSchema } from './flyers';
import { ScriptSpeciesSchema } from './speciesScripts';
import { StalkerSchema, SkirmisherSchema, GuardianSchema, GuardianPatternsSchema, PerchHunterSchema } from './brains';
import { BorrowedDecisionSchema } from './decisionScripts';

const count = v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0), v.maxValue(65535));
/** The same callback-free policy declarations used by native recipes and product species catalogues. */
export const SpeciesBrainSchema: v.GenericSchema<SpeciesBrainRowsInput, SpeciesBrainRows> = v.union([
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

/** Admitted data contracts, independent of validator implementation metadata. */
export type SpeciesBrainRowsInput = ({
    archetype: 'grazer';
    data: v.InferInput<(typeof GrazerSchema)['options'][0]>;
}) | ({
    archetype: 'grazer';
    data: v.InferInput<(typeof GrazerSchema)['options'][1]>;
    phaseSlots: number;
}) | ({
    archetype: 'diver';
    data: v.InferInput<typeof DiverSchema>;
}) | ({
    archetype: 'decision';
    data: v.InferInput<typeof BorrowedDecisionSchema>;
}) | ({
    archetype: 'challenge-grazer';
    data: v.InferInput<typeof ChallengeGrazerSchema>;
    phaseSlots: number;
}) | ({
    archetype: 'patrol-diver';
    data: v.InferInput<typeof PatrolDiverSchema>;
}) | ({
    archetype: 'script';
    data: v.InferInput<typeof ScriptSpeciesSchema>;
}) | ({
    archetype: 'stalker';
    data: v.InferInput<typeof StalkerSchema>;
}) | ({
    archetype: 'skirmisher';
    data: v.InferInput<typeof SkirmisherSchema>;
}) | ({
    archetype: 'guardian';
    data: (v.InferInput<typeof GuardianSchema>) | (v.InferInput<typeof GuardianPatternsSchema>);
}) | ({
    archetype: 'perch-hunter';
    data: v.InferInput<typeof PerchHunterSchema>;
});
export type SpeciesBrainRows = ({
    archetype: 'grazer';
    data: v.InferOutput<(typeof GrazerSchema)['options'][0]>;
}) | ({
    archetype: 'grazer';
    data: v.InferOutput<(typeof GrazerSchema)['options'][1]>;
    phaseSlots: number;
}) | ({
    archetype: 'diver';
    data: v.InferOutput<typeof DiverSchema>;
}) | ({
    archetype: 'decision';
    data: v.InferOutput<typeof BorrowedDecisionSchema>;
}) | ({
    archetype: 'challenge-grazer';
    data: v.InferOutput<typeof ChallengeGrazerSchema>;
    phaseSlots: number;
}) | ({
    archetype: 'patrol-diver';
    data: v.InferOutput<typeof PatrolDiverSchema>;
}) | ({
    archetype: 'script';
    data: v.InferOutput<typeof ScriptSpeciesSchema>;
}) | ({
    archetype: 'stalker';
    data: v.InferOutput<typeof StalkerSchema>;
}) | ({
    archetype: 'skirmisher';
    data: v.InferOutput<typeof SkirmisherSchema>;
}) | ({
    archetype: 'guardian';
    data: (v.InferOutput<typeof GuardianSchema>) | (v.InferOutput<typeof GuardianPatternsSchema>);
}) | ({
    archetype: 'perch-hunter';
    data: v.InferOutput<typeof PerchHunterSchema>;
});
