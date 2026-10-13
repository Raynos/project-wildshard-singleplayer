import type { Material } from 'three';

/**
 * Sky Reach's compiled look materials (the shardfile's `look.materials`, SF59 graphs among them), handed over by the
 * runtime before the world is built (runtime/index.ts) and read where a baked kind is drawn (world/shack.ts,
 * world/dressing.ts). Before they are set (the Model Explorer, a test) a kind draws in the bake's plain standard material.
 */
let looks: ReadonlyMap<string, Material> = new Map();
/** Hand over the compiled look materials (runtime/index.ts, before the world is built). */
export function setSkyLooks(materials: ReadonlyMap<string, Material>): void { looks = materials; }
/** A compiled look material by its `look.materials` id; undefined before the looks are set. */
export function skyLook(id: string): Material | undefined { return looks.get(id); }
