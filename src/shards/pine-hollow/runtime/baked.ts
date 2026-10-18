import { createNativeBakeReader, nativeBodySpecSchema, nativeColliderSchema } from '@wildshard/sdk/headlessRuntime';
import * as v from 'valibot';
import { PINE_TERRAIN } from '../data/terrainBindings';
import baked from '../data/physics.generated.json' with { type: 'json' };

/** The exact captured native lattice, including the crag cuts. */
export const PINE_GROUND_RES = PINE_TERRAIN.res, PINE_GROUND_SIZE = PINE_TERRAIN.size;
const reader = createNativeBakeReader(baked, { label: 'Pine', resolution: PINE_GROUND_RES, size: PINE_GROUND_SIZE, parked: true,
  spec: nativeBodySpecSchema('segments'), solid: nativeColliderSchema([1, 2, 6, 9], 'piece'),
  extra: v.object({}) });
/** Build-validated King and shelter facts, beside the original native binary decoder. */
export type PineBake = ReturnType<typeof reader.read> & Pick<typeof baked, 'kingHit' | 'shelterTrees'>;
export type PineSolid = PineBake['solids'][number];
/** Independent collider admission uses the same original shape and query-owner law. */
export const parsePineSolid = reader.solid;
/** Decode once; invalid products never publish a cached value. */
let parsed: PineBake | null = null;
export function pineBake(): PineBake {
  parsed ??= { ...structuredClone({ kingHit: baked.kingHit, shelterTrees: baked.shelterTrees }), ...reader.read() };
  return parsed;
}
