import { Color, Group, InstancedMesh, type MeshStandardMaterial } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader, spliceEdits } from '@wildshard/sdk/looks/shaderEdits';
import { SKY_ISLE_CLIP_EDITS, SKY_ISLE_ROCK, SKY_ISLE_ROCK_EDITS } from '../data/skyIsleLook';
import { SKY_ISLE_HD, SKY_ISLE_MODELS } from '../data/skyIsles';
import { hdMaterial, skyHd } from './meshes';
import FRAMES from '../data/skyIsleFrames.json' with { type: 'json' };
import { SKY, SKY_SUN } from '../data/skyLook';

/** A hex colour as a linear-space GLSL vec3 (the shader's output space before the post chain). */
function linear(hex: number): string { const c = new Color(hex); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; }

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
 * The aerial haze on the sky isles (E399 round 6, measured on mockup A's isle band, x 0.1-0.9, y 0.27-0.42: its darkest
 * isle rock is a hazed mauve, 107,81,77, where ours read dark brown, 75,58,38): toward the warm haze over `near`..`far` metres, at most `max`.
 */
export const SKY_ISLE_HAZE = { color: SKY.fog, near: 60, far: 320, max: 0.22 } as const;

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
export function skyIsleModels(placed: SkyIslePlacements, clipTop = false): Group {
  const group = new Group();
  for (const { model, m } of placed) {
    const name = SKY_ISLE_MODELS.find((n) => n === model); if (name === undefined) throw new Error(`far-reach: no sky isle model ${model}`);
    const made = skyHd(name), frame = FRAMES.find((f) => f.model === name); if (made === null || frame === undefined) continue;
    const g = made.geometry; g.translate(-frame.tx, -frame.deck, -frame.tz); g.scale(frame.k, frame.k, frame.k); g.computeBoundingBox(); g.computeBoundingSphere();
    const material: MeshStandardMaterial = hdMaterial(made.map);
    material.color.setScalar(SKY_ISLE_HD.tint); material.emissiveMap = made.map; material.emissive.setScalar(1); material.emissiveIntensity = SKY_ISLE_HD.selfLight;
    // the rock grey-brown, the turf kept green (E399: from below the paint read olive-yellow; the mockups' undersides are
    // sandy-grey stone with darker crevices)
    patchShader(material, 'far.sky-isle-rock', PATCH_ORDER.decorate, (shader) => {
      editShader(shader, spliceEdits(clipTop ? [...SKY_ISLE_ROCK_EDITS, ...SKY_ISLE_CLIP_EDITS] : SKY_ISLE_ROCK_EDITS, { turf: clipTop ? '0.0' : SKY_ISLE_ROCK.turf,
        sunX: SKY_SUN[0].toFixed(4), sunY: SKY_SUN[1].toFixed(4), sunZ: SKY_SUN[2].toFixed(4), shadeLo: SKY_ISLE_HD.shade[0].toFixed(2), shadeHi: SKY_ISLE_HD.shade[1].toFixed(2),
        hazeColor: linear(SKY_ISLE_HAZE.color), hazeNear: SKY_ISLE_HAZE.near.toFixed(1), hazeSpan: (SKY_ISLE_HAZE.far - SKY_ISLE_HAZE.near).toFixed(1), hazeMax: SKY_ISLE_HAZE.max.toFixed(2) }));
    }, { key: (prior) => `${prior}|far.sky-isle-rock|haze|rim-sun${clipTop ? '|clip' : ''}` });
    const mesh = new InstancedMesh(g, material, m.length / 16); mesh.name = `far.sky-isles.${name}`;
    mesh.instanceMatrix.array.set(m); mesh.computeBoundingSphere(); group.add(mesh);
  }
  return group;
}
