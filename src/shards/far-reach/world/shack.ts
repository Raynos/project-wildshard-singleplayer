import { SKY_LIBRARY } from './meshes';
import type { Material } from 'three';

/**
 * The weathered-timber surfaces of Sky Reach's small buildings (E392, round 18): a baked shack part is drawn in its kind's
 * material graph (data/shackLook.ts, the shardfile's `look.materials.shack-<kind>`), reading its `aShk` face coordinates.
 * The geometry is built at bake time (`generators/shackKit.ts`, SHARD-PLATFORM SF72); the client only draws it.
 */
export type ShackKind = 'plank' | 'shingle' | 'stone' | 'beam';

/** A kind's compiled graph; undefined (the bake's plain vertex-coloured standard material) before the looks are set. */
export function shackMaterial(kind: ShackKind): Material | undefined { return SKY_LIBRARY.look(`shack-${kind}`); }
