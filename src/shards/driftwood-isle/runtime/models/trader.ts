import { driftwoodRows } from '../boot/rows';
/**
 * Driftwood Isle's trader and her counter (E314, Jake's picks 2026-09-30: "a trader at Wendell's hut", the goods laid
 * out on a small driftwood counter in front of her — board 9 and board 2 A in art/loot/round-1-loop/). Code models on
 * the low-poly kit, Wendell's look (src/shards/driftwood-isle/runtime/models/people.ts), built in their own space: feet / foot of the counter
 * at the origin, front toward +Z.
 *
 * - `trader`: the NPC, a kit figure (@wildshard/game/systems/npc/kitFigure on the figure catalogue's kit rows): one figure,
 *   turned on pivots; the world keeps it live with `traderOf(placed.object).update(…)`. A capsule collider.
 * - `tradeCounter`: a driftwood plank counter on crooked log legs with a lower shelf (a crate on it), a cream sailcloth
 *   runner with a teal stripe draped over the front, and the shop's goods on top: two whetstones on a wooden block (the
 *   whetstone I and II), a red heart charm on a cord hung from a little T-stand (the sturdy heart) with a smaller heart
 *   beside it, a rolled sea chart tied with twine, a folded sailcloth cape with a rope clasp, a brass dish of doubloons.
 *   One merged mesh, one draw. A box collider (you walk round it, never up it).
 *
 * The world side (where they stand, the per-frame update) is src/shards/driftwood-isle/quest/TraderStall.ts. No shop logic here.
 */
import type * as THREE from 'three';
import { defineModel, type ModelDef, type ModelPart } from '@wildshard/engine/models/model';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { FigureRows } from '@wildshard/game/systems/npc/figureRows';
import { KitFigure } from '@wildshard/game/systems/npc/kitFigure';
import { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { loadFixedGeometry, fixedDraw, fixedGeometryGroups, FIGURES } from '../boot/blobAssets';

const byGroup = new WeakMap<THREE.Object3D, KitFigure>();

/** the live Trader behind a placed copy of `trader` (null: not one) */
export function traderOf(o: THREE.Object3D): KitFigure | null { return byGroup.get(o) ?? null; }

export const trader: ModelDef<object> = defineModel<object>({
  id: 'driftwood-isle/trader', name: 'The trader', category: 'people', pipeline: 'code', file: 'src/shards/driftwood-isle/runtime/models/trader.ts', surface: 'flesh',
  prepare: loadFixedGeometry, defaults: {},
  build: (ctx) => {
    const geometry = new Map(Object.entries(fixedGeometryGroups().npc.trader).map(([part, slot]) => [part, fixedDraw(slot).copy()]));
    const rig = new KitFigure(ctx.sky, 'trader', FIGURES.rows('trader'), FIGURES.kit('trader'), { geometry }, new SceneHandles(ctx.sky));
    byGroup.set(rig.group, rig); return rig.group;
  },
  colliders: () => FigureRows.collidersFor(FIGURES.rows('trader')),
});

export const tradeCounter: ModelDef<object> = defineModel<object>({
  id: 'driftwood-isle/trade-counter', name: 'The trader\'s counter', category: 'props', pipeline: 'code', file: 'src/shards/driftwood-isle/runtime/models/trader.ts', surface: 'wood',
  prepare: loadFixedGeometry, defaults: {},
  build: (ctx): readonly ModelPart[] => [{ geometry: fixedDraw('tradeCounter').copy(), material: lowPolyLookMaterial(ctx.sky, 'still'), castShadow: true, receiveShadow: true }],
  colliders: () => [{ kind: 'box', x: 0, y: driftwoodRows('custom/fixedLayouts').nativeView.COUNTER_TOP.y / 2, z: 0, hx: driftwoodRows('custom/fixedLayouts').nativeView.COUNTER_TOP.w / 2, hy: driftwoodRows('custom/fixedLayouts').nativeView.COUNTER_TOP.y / 2, hz: driftwoodRows('custom/fixedLayouts').nativeView.COUNTER_TOP.d / 2 + 0.02 }],
});
