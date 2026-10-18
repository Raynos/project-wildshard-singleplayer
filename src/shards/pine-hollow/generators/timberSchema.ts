/** Build-only admission of the retained timber oracle. Play code reads admitted scenes and facts. */
import * as v from 'valibot';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import type { KitMat } from './cabinShapes';

const num = v.pipe(v.number(), v.finite());
const TimberFloorSchema = v.strictObject({ x: num, z: num, rot: num, hw: num, hd: num, y: num });
/** the timber kit's materials (homestead.ts `MatKey`) */
const MAT_KEYS = ['log', 'endGrain', 'chink', 'roof', 'beam', 'deck', 'door', 'stone', 'bark', 'iron', 'cloth', 'char'] as const satisfies readonly KitMat[];
const Part = v.strictObject({ key: v.picklist(MAT_KEYS), counts: v.array(num) });
/** a baked timber's row: its parts' vertex counts per material (in the builder's order), the glass's, its facts */
export const TIMBER_ROW = { parts: v.array(Part), glass: v.array(num), colliders: v.pipe(v.array(v.unknown()), v.transform(rows => readColliderRows(rows, { kinds: ['box', 'treads'], surfaces: ['wood', 'stone'] }))), floors: v.array(TimberFloorSchema), anchors: v.record(v.string(), v.tuple([num, num, num])) };
export const TimberRowSchema = v.strictObject(TIMBER_ROW);
