import * as v from 'valibot';
import { SCRIPT_LIMITS } from './scriptLimits';
import { isJsonData } from './json';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
/** Owner-local preparation; host limits and one memory per module stay fixed. */
export const PageScriptPreparationSchema = v.strictObject({ modules: v.pipe(v.array(id), v.maxLength(SCRIPT_LIMITS.instances)), yield: v.picklist(['frame', 'task']) });
/** A generated cave cut consists of physics rectangles and triangle-AABB holes. */
export const PageTerrainCutSchema = v.pipe(v.unknown(), v.check(isJsonData), v.strictObject({
  frame: v.strictObject({ x: n, z: n, yaw: n }),
  cuts: v.pipe(v.array(v.strictObject({ lx: n, lz: n, hw: n, hd: n, below: n })), v.maxLength(128)),
  holes: v.pipe(v.array(v.strictObject({ lx: n, lz: n, hw: n, hd: n, y0: n, y1: n })), v.maxLength(128)),
}));
export type PageTerrainCutRows = v.InferOutput<typeof PageTerrainCutSchema>;
/** Material bindings over a real engine pond surface and its probe. */
export const PageWaterBindingSchema = v.strictObject({ object: id, look: id, looks: v.pipe(v.array(id), v.maxLength(4)),
  ripples: id, skyline: id, centre: id, probe: id });
