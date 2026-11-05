import * as v from 'valibot';
import { WaterSurfaceSchema } from './water.ts';
import { WorldSceneSchema } from './clientChannels.ts';
import { RidingPracticeSchema } from './practiceCourseRows.ts';
import { ReturnProgramDocumentSchema } from './returnProgramDocument.ts';

const finite = v.pipe(v.number(), v.finite());
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const names = v.pipe(v.array(text), v.maxLength(128), v.check(rows => new Set(rows).size === rows.length));

export interface WaterWorldInput {
  surface: v.InferInput<typeof WaterSurfaceSchema>;
  terrain: v.InferInput<typeof WorldSceneSchema>;
  placeSets: { place: string; id: string; name: string; file: string; pois?: string[] | undefined;
    x: number; z: number; r: number; mode?: 'centre' | 'bounds' }[];
  practice: v.InferInput<typeof RidingPracticeSchema>;
}
export interface WaterWorldRows {
  surface: v.InferOutput<typeof WaterSurfaceSchema>;
  terrain: v.InferOutput<typeof WorldSceneSchema>;
  placeSets: { place: string; id: string; name: string; file: string; pois: string[];
    x: number; z: number; r: number; mode?: 'centre' | 'bounds' }[];
  practice: v.InferOutput<typeof RidingPracticeSchema>;
}

/** The entire water-world file: both native practice admission and the painted
 * ground recipe, plus the exact named-place grammar used by world.sets. */
export const WaterWorldSchema: v.GenericSchema<WaterWorldInput, WaterWorldRows> = v.strictObject({
  surface: WaterSurfaceSchema, terrain: WorldSceneSchema,
  placeSets: v.pipe(v.array(v.strictObject({ place: text, id: text, name: text, file: text, pois: v.optional(names, []),
    x: finite, z: finite, r: v.pipe(finite, v.minValue(0)), mode: v.exactOptional(v.picklist(['centre', 'bounds'])) })),
    v.maxLength(128), v.check(rows => new Set(rows.map(row => row.id)).size === rows.length)),
  practice: v.intersect([RidingPracticeSchema, v.looseObject({ program: ReturnProgramDocumentSchema })]),
});
