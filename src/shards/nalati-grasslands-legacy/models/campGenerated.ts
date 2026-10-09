/**
 * The camps' generated props (E306 / E315 second pass; was src/world/nalati/modelProps.ts): TRELLIS.2 GLBs
 * (scripts/img2mesh/props/nalati.json) that replaced PaintKit twins (E136, the user's pick) and kept their footprints and
 * colliders — the kazan on its tripod, the painted sandyq chest, the firewood stack, the kumis churn, a saddle set down
 * on the grass, and the golden eagle standing on its perch. Each is instanced with its camp's others of it when its file
 * lands (src/shards/nalati-grasslands/world/painted.ts `NalatiSet.instance`: one InstancedMesh per model per camp; a failed load draws
 * nothing and logs once, its collider stays).
 *
 * A placement is the point on the ground under it (`at.y` = the ground there), `rot` the way its front faces in the
 * camp's frame (0 = −z); the GLBs face +Z, so each turns the file by `rot + π` and sits it a few cm into the turf.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { MODEL_SIZE } from '../world/glbPaint';
import { generated } from '../world/painted';
import type { Box } from '../world/solid';

const FILE = 'src/shards/nalati-grasslands/models/campGenerated.ts';
const FLIP = Math.PI;

/** the kazan on its tripod over the fire ring (its plume is the shard's smoke, at `at.y + 0.9`) */
export const kazan = defineModel<object>({
  id: 'nalati-grasslands/kazan', name: 'Kazan on its tripod', category: 'props', pipeline: 'trellis', file: FILE, surface: 'wood',
  defaults: {},
  build: generated({
    id: 'nalati-grasslands/kazan', name: 'cauldron',
    pose: (at) => ({ x: at.x, y: at.y - 0.04, z: at.z, rot: at.rot ?? 0.4, scale: 1.05 }),
    collide: (at) => ({ boxes: [{ x: at.x, z: at.z, hw: 0.7, hd: 0.7, rot: 0, yBottom: at.y - 1, yTop: at.y + 0.95 }] }),
  }),
});

/** a painted sandyq chest (1.05 m long) */
export const chest = defineModel<object>({
  id: 'nalati-grasslands/chest', name: 'Sandyq chest', category: 'props', pipeline: 'trellis', file: FILE, surface: 'wood',
  defaults: {},
  build: generated({
    id: 'nalati-grasslands/chest', name: 'chest',
    pose: (at) => ({ x: at.x, y: at.y - 0.02, z: at.z, rot: (at.rot ?? 0) + FLIP, scale: 1.2 }),
    collide: (at) => ({ boxes: [{ x: at.x, z: at.z, hw: 0.55, hd: 0.3, rot: -(at.rot ?? 0), yBottom: at.y - 1, yTop: at.y + 0.75 }] }),
  }),
});

export interface FirewoodParams {
  /** a turn of this copy off its pile's line (a pile is two stacks side by side) */
  readonly dy: number;
  /** the pile's one box (world space), carried by the first stack of a pile */
  readonly pile?: Box;
}

/** a birch firewood stack (the woodpile is two, side by side) */
export const firewood = defineModel<FirewoodParams>({
  id: 'nalati-grasslands/firewood', name: 'Firewood stack', category: 'props', pipeline: 'trellis', file: FILE, surface: 'wood',
  defaults: { dy: 0 },
  build: generated<FirewoodParams>({
    id: 'nalati-grasslands/firewood', name: 'firewood',
    pose: (at, p) => ({ x: at.x, y: at.y - 0.03, z: at.z, rot: (at.rot ?? 0) + FLIP + p.dy, scale: 1.45 }),
    collide: (_at, p) => (p.pile === undefined ? {} : { boxes: [p.pile] }),
  }),
});

export interface ChurnParams {
  /** its box's half-width and height */
  readonly hw: number;
  readonly h: number;
}

/** a kumis churn (a staved tub, the dasher standing in it); `at.scale` sizes it */
export const kumisChurn = defineModel<ChurnParams>({
  id: 'nalati-grasslands/kumis-churn', name: 'Kumis churn', category: 'props', pipeline: 'trellis', file: FILE, surface: 'wood',
  defaults: { hw: 0.28, h: 1.1 },
  build: generated<ChurnParams>({
    id: 'nalati-grasslands/kumis-churn', name: 'kumis-churn',
    pose: (at) => ({ x: at.x, y: at.y - 0.02, z: at.z, rot: at.rot ?? 0, scale: at.scale ?? 1 }),
    collide: (at, p) => ({ boxes: [{ x: at.x, z: at.z, hw: p.hw, hd: p.hw, rot: 0, yBottom: at.y - 1, yTop: at.y + p.h }] }),
  }),
});

/** a saddle set down on the grass (walk-through) */
export const groundSaddle = defineModel<object>({
  id: 'nalati-grasslands/ground-saddle', name: 'Saddle on the grass', category: 'props', pipeline: 'trellis', file: FILE, surface: 'wood',
  defaults: {},
  build: generated({
    id: 'nalati-grasslands/ground-saddle', name: 'saddle',
    pose: (at) => ({ x: at.x, y: at.y - 0.02, z: at.z, rot: (at.rot ?? 0) + FLIP, scale: 1.25 }),
  }),
});

/** the golden eagle standing on its perch, 0.85 m tall (`at` = its feet on the perch's bar) */
export const perchedEagle = defineModel<object>({
  id: 'nalati-grasslands/perched-eagle', name: 'Golden eagle on its perch', category: 'props', pipeline: 'trellis', file: FILE, surface: 'wood',
  defaults: {},
  build: generated({
    id: 'nalati-grasslands/perched-eagle', name: 'eagle',
    pose: (at) => ({ x: at.x, y: at.y - 0.02, z: at.z, rot: (at.rot ?? 0) + FLIP, scale: 0.85 / MODEL_SIZE.eagle[1] }),
  }),
});
