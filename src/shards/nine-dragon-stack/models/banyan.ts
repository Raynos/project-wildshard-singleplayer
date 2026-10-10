/**
 * The banyan of Lantern Square and what stands at its foot (dome B, E169; E306 / E315 second pass) — three models the
 * square draws into its kit ('paifang', the square cluster's one merged mesh with the neon spill baked in), so they cost
 * no draw of their own; the world records where each stands (../generators/banyan.ts, `ctx.inKit`) and registers them on the
 * kit's mesh (`place` with `drawnInto`, ../world/inKit.ts). Built here in their own space for the Model Explorer:
 *  - the banyan (strangler fig): the carved granite planter, the braided trunk of 22 roots, the limbs, the aerial-root
 *    curtains and the red wish ribbons, under its painted leaf-card canopy (../world/canopy.ts: the cards, their depth
 *    pass and the dark core, over the tree's own plan, baked: ../generators/canopyGeometry.ts). Its planter collides: an octagonal prism;
 *  - the earth-god shrine (土地公): a red lacquer cabinet under a tiled hip roof, candles, a censer, oranges;
 *  - the 九龍城 stele: a granite slab on its plinth.
 * Their signs (the shrine's plaque and couplets, the stele's calligraphy) and lanterns are sign and paper-lantern copies.
 */
import { defineModel, type ModelBuild, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { BANYAN } from '../layout';
import { ndLook, need, specimen, withSpecimens } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/banyan.ts';

/** a piece built alone in its own space (G285: baked, ../generators/specimens.ts) */
function built(ctx: ModelContext, id: string, key: string): ModelBuild {
  return withSpecimens(ctx, id, () => [{ geometry: specimen(ctx, `banyan:${key}`), material: need(ndLook(ctx).mat, 'the Jiehua program') }]);
}

/** the tree and, once the world's canopy programs are in, its crown (the cards drawn twice: colour, then the depth pass) */
function tree(ctx: ModelContext): ModelBuild {
  return withSpecimens(ctx, 'nine-dragon-stack/banyan', () => treeParts(ctx));
}
function treeParts(ctx: ModelContext): readonly ModelPart[] {
  const look = ndLook(ctx);
  const parts: ModelPart[] = [{ geometry: specimen(ctx, 'banyan:tree'), material: need(look.mat, 'the Jiehua program') }];
  const c = look.canopy;
  if (c !== null) {
    const cards = specimen(ctx, 'banyan:crown:cards');
    parts.push({ geometry: specimen(ctx, 'banyan:crown:core'), material: c.core }, { geometry: cards, material: c.cards, renderOrder: 1 }, { geometry: cards, material: c.depth, renderOrder: 2 });
  }
  return parts;
}

/** the planter as an octagonal prism, 1 m tall, 0.3 m past its rim (what the square collided with before, E315) */
function planter(): ColliderDesc {
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, r = BANYAN.r + 0.3;
    pts.push(Math.cos(a) * r, 0, Math.sin(a) * r, Math.cos(a) * r, 1.0, Math.sin(a) * r);
  }
  return { kind: 'hull', x: 0, y: 0, z: 0, points: new Float32Array(pts), surface: 'stone' };
}

export const banyan = defineModel({
  id: 'nine-dragon-stack/banyan', name: 'Banyan (strangler fig, carved planter)', category: 'nature', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => tree(ctx),
  colliders: () => [planter()],
});

export const earthGodShrine = defineModel({
  id: 'nine-dragon-stack/earth-god-shrine', name: 'Earth-god shrine (土地公)', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => built(ctx, 'nine-dragon-stack/earth-god-shrine', 'shrine'),
  specimenYaw: Math.PI, // (the Explorer's camera looks down +z: turned, its niche faces it)
  // its stone base and altar, a box of their footprint
  colliders: () => [{ kind: 'box', x: 0, y: 0.9, z: 0.05, hx: 1.0, hy: 0.9, hz: 0.65, surface: 'stone' }],
});

export const kowloonSteleModel = defineModel({
  id: 'nine-dragon-stack/kowloon-stele', name: '九龍城 stele', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => built(ctx, 'nine-dragon-stack/kowloon-stele', 'stele'),
  specimenYaw: Math.PI,
  colliders: () => [{ kind: 'box', x: 0, y: 1.1, z: 0, hx: 0.6, hy: 1.1, hz: 0.5, surface: 'stone' }],
});
