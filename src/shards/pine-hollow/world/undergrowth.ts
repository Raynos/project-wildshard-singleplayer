import { SEED } from '@wildshard/engine/core/config';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { paintCanvas, type CanvasAtlasRow } from '@wildshard/sdk/looks/canvasAtlas';
import { GroundCover, type GroundCoverDraw, type GroundCoverKind } from '@wildshard/sdk/looks/groundCover';
import { UNDER_SHAPES } from './undergrowthKit';
import { UNDER_EDITS, UNDER_VERTEX_EDITS } from '../data/forestLook';
import { UNDER_LOOK } from '../data/undergrowthLook';
import { FERN_PAINT, LITTER_PAINT, MOSS_PAINT, REED_PAINT, SHRUB_PAINT, STONE_PAINT } from '../data/undergrowthPaint';

/**
 * Forest-floor undergrowth: ferns, low round-leaf shrubs and needle/twig litter — the field (world): where every copy
 * goes, each kind's geometry, texture and material. Each kind is a model (src/shards/pine-hollow/models/fern.ts …) that
 * `place` draws instanced into `group` and culls per 32 m cell round the forest's view (E315: `kinds`, `groundCoverMatrix`,
 * `groundCoverCells`; src/shards/pine-hollow/world/drawnModels.ts).
 *
 *   const under = new Undergrowth(sky, forest).build();
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
 * Six draw calls (+ fern & shrub shadow passes). Instances scale to 0 beyond `fadeFar` metres
 * in the vertex shader so distant ones cost nothing in the fragment stage.
 *
 * The field is the SDK's ground cover (@wildshard/sdk/looks/groundCover): one program for every kind, the distance fade
 * and the wind; its look is data/undergrowthLook.ts, its edits data/forestLook.ts; its textures are data/undergrowthPaint.ts
 * (@wildshard/sdk/looks/canvasAtlas rows, painted from the level seed when the field builds).
 *
 * Public: `group` (the kinds' placed meshes go in it), `kinds` (each kind's parts), `layout`, `counts`, `view`.
 */

/** one kind as the field draws it: its geometry, its material (and its shadow's) — a model's parts (E315) */
export type UnderKindDraw = GroundCoverDraw;
/** one of the field's six kinds */
export type UnderKind = GroundCoverKind;

/** a kind's painter: its row painted from the level's seed when the field builds */
const paint = (row: CanvasAtlasRow) => (): HTMLCanvasElement => paintCanvas(row, { SEED });

/** Pine Hollow's forest floor: the SDK ground cover with its look, shapes, edits and painted textures. */
export class Undergrowth extends GroundCover {
  /** the field over `forest`, lit by `sky` */
  constructor(sky: Sky, forest: Forest) {
    super({
      sky, forest, look: UNDER_LOOK, shapes: UNDER_SHAPES, edits: { lit: UNDER_EDITS, vertex: UNDER_VERTEX_EDITS },
      paint: { ferns: paint(FERN_PAINT), shrubs: paint(SHRUB_PAINT), litter: paint(LITTER_PAINT), stones: paint(STONE_PAINT), moss: paint(MOSS_PAINT), reeds: paint(REED_PAINT) },
    });
  }
}
