import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { GroundCover, type GroundCoverDraw, type GroundCoverKind, type UnderPlacements } from '../runtime/looks/groundCover';
import type { UnderShapes } from '../runtime/world/undergrowthKit';
import { UNDER_LOOK } from '../data/undergrowthLook';

/**
 * Forest-floor undergrowth: ferns, low round-leaf shrubs and needle/twig litter — the field (world): where every copy
 * goes, each kind's geometry, texture and material. Each kind is a model (src/shards/pine-hollow/runtime/models/fern.ts …) that
 * `place` draws instanced into `group` and culls per 32 m cell round the forest's view (E315: `kinds`, `groundCoverMatrix`,
 * `groundCoverCells`; src/shards/pine-hollow/world/drawnModels.ts).
 *
 *   const under = await new Undergrowth(sky, forest, shapes, placements).buildAsync(macrotask);
 *   scene.add(under.group);
 *   game.onUpdate((dt) => under.update(dt, player.position));   // only feeds the viewer position uniform
 *
 * Everything is placed once, deterministically (Rng), chunk-wide:
 *  - ~6000 ferns (9 arched frond quads in a rosette, procedural pinnate-leaf alpha texture) in
 *    shaded forest floor, along trail verges (5.5–10 m from the centreline) and around the pond:
 *    not on rock / cabin pads / inside trunks / in the water. Cast + receive shadows.
 *  - ~1500 shrubs (4 crossed quads, round-leaf texture) at floor/grass edges.
 *  - ~5000 twig/needle-litter quads and ~3000 dark pebble clusters lying flat under the trees.
 *  - ~3000 moss patches (flat, soft mottled alpha) hugging the base of trunks.
 *  - ~1500 reed / sedge clumps (tall thin blades, 0.8–1.2 m) on the pond shore and in the shallows.
 * Six draw calls (+ fern, shrub & reed shadow passes). Instances scale to 0 beyond the tier's fade
 * in the graph's vertex stage so distant ones cost nothing in the fragment stage.
 *
 * The field is the shard's ground cover (runtime/looks/groundCover.ts): one graph program for every kind, the distance
 * fade and the wind; its look and graph are data/undergrowthLook.ts; its textures are baked at build time from
 * generators/undergrowthPaint.ts (canvas rows painted from the level seed by generators/bake-pine-painted.mjs).
 *
 * Public: `group` (the kinds' placed meshes go in it), `kinds` (each kind's parts), `layout`, `view`.
 */

/** one kind as the field draws it: its geometry, its material (and its shadow's) — a model's parts (E315) */
export type UnderKindDraw = GroundCoverDraw;
/** one of the field's six kinds */
export type UnderKind = GroundCoverKind;

/** Pine Hollow's forest floor: the ground cover with its look, shapes and baked textures. */
export class Undergrowth extends GroundCover {
  /** the field over `forest`, lit by `sky` */
  constructor(sky: Sky, forest: Forest, shapes: UnderShapes, placements: UnderPlacements) {
    super({ sky, forest, look: UNDER_LOOK, shapes, placements });
  }
}
