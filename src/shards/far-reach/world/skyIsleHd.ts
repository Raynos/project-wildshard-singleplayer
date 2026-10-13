import { Group, InstancedMesh } from 'three';
import { SKY_ISLE_MODELS } from '../data/skyIsles';
import { skyMappedLook } from './looks';
import { skyHd } from './meshes';

/**
 * The textured floating islands for the decorative sky isles (E392/E399, `art/far-reach/round-21-sky-isles/`): every
 * council seat read the code isles as "dark bare rock islands" from below, where the mockups' are lush (a thick mossy
 * turf spilling over the rim, warm sandy-grey stratified rock, long roots and moss trailing beneath). Three codex
 * references on white → BiRefNet cutout → Hunyuan3D-2 turbo shape + 2048 paint → decimated, a 1024 WebP map, meshopt.
 * Each model is brought to a unit frame once (its turf level at y 0, its rim's median radius 1, centred on its top: found
 * offline, generators/skyIsleFrames.ts), then every isle that uses it is one instance, scaled to its rim radius and keel depth and turned to its own yaw
 * (placed offline, generators/placements.ts). No trees in the models: the firs stand on the turf. A model that failed to load leaves its isles undrawn.
 */
/**
 * A model's unit frame as baked (generators/skyIsleFrames.ts, `data/skyIsleFrames.json`): the move (its top's centre and
 * turf level, `tx` / `deck` / `tz`) and the scale (`k`, its rim's median radius to 1) that bring it there, its rim radius
 * per angle bin and its widest reach under the turf, both in unit radii (the bakes' poses read those).
 */
export interface SkyIsleFrame { model: string; tx: number; deck: number; tz: number; k: number; bulge: number; rim: number[] }

/** The placed isles: each model's instance matrices, baked (generators/placements.ts, `data/placements.json`). */
export type SkyIslePlacements = readonly { readonly model: string; readonly m: readonly number[] }[];

/** The sky isles as textured models (see the module note), one instanced draw per model at its baked matrices. */
/** `clipTop` (the playable islands' keels): everything above the model's turf is cut away, so its canopy never pokes through a deck. */
export async function skyIsleModels(placed: SkyIslePlacements, clipTop = false, pause: () => Promise<void> = () => Promise.resolve()): Promise<Group> {
  const group = new Group();
  for (const { model, m } of placed) {
    const name = SKY_ISLE_MODELS.find((n) => n === model); if (name === undefined) throw new Error(`far-reach: no sky isle model ${model}`);
    const made = skyHd(name); if (made === null) continue;
    const g = made.geometry;
    // the rock grey-brown, the turf kept green, the sun's turn and rim, the haze (look.materials 'sky-isle' / 'sky-isle-keel',
    // data/skyIsleLook.ts; E399: from below the paint read olive-yellow, the mockups' undersides are sandy-grey stone)
    const material = skyMappedLook(clipTop ? 'sky-isle-keel' : 'sky-isle', made.map);
    const mesh = new InstancedMesh(g, material, m.length / 16); mesh.name = `far.sky-isles.${name}`;
    mesh.instanceMatrix.array.set(m); mesh.computeBoundingSphere(); group.add(mesh);
    await pause();
  }
  return group;
}
