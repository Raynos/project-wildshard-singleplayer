import type { Material, Texture } from 'three';
import { hdMaterial } from './meshes';

/**
 * Sky Reach's compiled look materials (the shardfile's `look.materials`, SF59 graphs among them), handed over by the
 * runtime before the world is built (runtime/index.ts) and read where a baked kind is drawn (world/shack.ts,
 * world/dressing.ts) or a model wears a look over its own map (`skyMappedLook`). Before they are set (the Model Explorer,
 * a test) a kind draws in the bake's plain standard material and a model in its plain painted one.
 */
let looks: ReadonlyMap<string, Material> = new Map();
let bind: ((id: string, map: Texture) => Material) | null = null;
/** Hand over the compiled look materials and the binding of a `meshMap` look to a model's map (runtime/index.ts, before the world is built). */
export function setSkyLooks(materials: ReadonlyMap<string, Material>, mapped?: (id: string, map: Texture) => Material): void { looks = materials; bind = mapped ?? null; }
/** A compiled look material by its `look.materials` id; undefined before the looks are set. */
export function skyLook(id: string): Material | undefined { return looks.get(id); }
/** A `meshMap` look (`look.materials.<id>`) over a model's own `map`: one cached material per look and map, one program per look (the catalogue's `bindMeshMap`); its plain painted material before the looks are set. */
export function skyMappedLook(id: string, map: Texture): Material { return bind === null || !looks.has(id) ? hdMaterial(map) : bind(id, map); }
