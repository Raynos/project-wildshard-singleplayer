import { createNativeBakeReader, nativeBodySpecSchema, nativeColliderSchema } from '@wildshard/sdk/headlessRuntime';
import * as v from 'valibot';
import { PINE_TERRAIN } from '../data/terrainBindings';
import baked from '../data/physics.generated.json' with { type: 'json' };

/** The exact captured native lattice, including the crag cuts. */
export const PINE_GROUND_RES = PINE_TERRAIN.res, PINE_GROUND_SIZE = PINE_TERRAIN.size;
const finite = v.pipe(v.number(), v.finite()), triple = v.tuple([finite, finite, finite]);
const KingHit = v.strictObject({ head: triple, body: v.tuple([triple, triple]), fore: v.tuple([triple, triple]), ribs: triple, radius: v.pipe(finite, v.minValue(0.001)) });
const ShelterTree = v.tuple([finite, finite, v.pipe(finite, v.minValue(0)), v.pipe(finite, v.minValue(0)), v.pipe(finite, v.minValue(0), v.maxValue(1))]);
const reader = createNativeBakeReader(baked, { label: 'Pine', resolution: PINE_GROUND_RES, size: PINE_GROUND_SIZE, parked: true,
  spec: nativeBodySpecSchema('segments'), solid: nativeColliderSchema([1, 2, 6, 9], 'piece'),
  extra: v.object({ kingHit: KingHit, shelterTrees: v.array(ShelterTree) }) });
/** Strict native world with the original King hit volumes and tree shelter metadata. */
export type PineBake = ReturnType<typeof reader.read>;
export type PineSolid = PineBake['solids'][number];
/** Independent collider admission uses the same original shape and query-owner law. */
export const parsePineSolid = reader.solid;
/** Decode once; invalid products never publish a cached value. */
export const pineBake = reader.read;
