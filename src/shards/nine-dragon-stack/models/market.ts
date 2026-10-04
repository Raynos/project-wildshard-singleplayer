/**
 * The square's market sets (E281 round 2; E306 / E315 M4): the market booth, the parasol table and the dining pavilion —
 * each a Kit + KitX geometry in its own frame (../world/stalls.ts builds them: front on z = 0 facing +z / the table at
 * the origin), drawn by the Jiehua program as ONE InstancedMesh per set, culled per copy by the fragment's culler. What a
 * copy cannot vary — its lanterns, signs, glow, steam, diners and customers — the market row places beside it.
 *
 * The booth's cook draws from the market row's rng stream, at the first booth (so the square's other draws keep their
 * order): the square builds it there and hands the geometry over (../world/props3d.ts `placeSet`); a booth built for
 * any other reason (a tool, a test) seeds its own stream.
 */
import type { BufferGeometry } from 'three';
import { BOOTH, PAV, boothSet, parasolSet, pavilionSet } from '../world/stalls';
import { ndLook, need } from '../world/modelLook';
import { Rng } from '@wildshard/engine/core/rng';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import type { ColliderDesc } from '@wildshard/engine/world/registry';

const FILE = 'src/shards/nine-dragon-stack/models/market.ts';

/** the set's geometry as the square built it (`set:<name>` in the look), else built here once */
function set(ctx: ModelContext, name: string, make: () => BufferGeometry): readonly ModelPart[] {
  const look = ndLook(ctx);
  return [{ geometry: look.geo.get(`set:${name}`) ?? ctx.once(`nds:set:${name}`, make), material: need(look.mat, 'the Jiehua program') }];
}

export const marketBooth = defineModel({
  id: 'nine-dragon-stack/market-booth', name: 'Market booth (roast ducks, steamers, a cook)', category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => set(ctx, 'booth', () => boothSet(new Rng(4101))),
  // its footprint behind the counter, 2.4 m up
  colliders: () => [{ kind: 'box', x: 0, y: 1.2, z: -BOOTH.d / 2, hx: BOOTH.w / 2, hy: 1.2, hz: BOOTH.d / 2, surface: 'wood' }],
});

export const parasolTable = defineModel({
  id: 'nine-dragon-stack/parasol-table', name: 'Parasol table', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => set(ctx, 'parasol', parasolSet),
  // the table and its diners, 1.5 m square (the parasol is out of reach)
  colliders: () => [{ kind: 'box', x: 0, y: 0.4, z: 0, hx: 0.75, hy: 0.4, hz: 0.75, surface: 'metal' }],
});

export interface PavilionParams {
  /** the copy's turn about +y (radians): its colliders stay square to the square's grid whatever the turn, as the old
   *  footprint boxes were (identical collision, E315) */
  readonly turn: number;
}

/** the table with its diners, and the four posts (the canopy is out of reach), square to the world at any turn */
function pavilionColliders(p: PavilionParams): ColliderDesc[] {
  const back = -p.turn;
  const out: ColliderDesc[] = [{ kind: 'box', x: 0, y: 0.45, z: 0, hx: 0.85, hy: 0.45, hz: 0.85, yaw: back, surface: 'wood' }];
  for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) out.push({ kind: 'box', x: lx * PAV.half, y: PAV.h / 2, z: lz * PAV.half, hx: 0.08, hy: PAV.h / 2, hz: 0.08, yaw: back, surface: 'wood' });
  return out;
}

export const diningPavilion = defineModel<PavilionParams>({
  id: 'nine-dragon-stack/dining-pavilion', name: 'Dining pavilion (hot pot)', category: 'buildings', pipeline: 'code', file: FILE, defaults: { turn: 0 },
  build: (ctx) => set(ctx, 'pavilion', pavilionSet),
  colliders: (p) => pavilionColliders(p),
});
