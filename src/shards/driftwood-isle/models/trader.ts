/**
 * Driftwood Isle's trader and her counter (E314, Jake's picks 2026-09-30: "a trader at Wendell's hut", the goods laid
 * out on a small driftwood counter in front of her — board 9 and board 2 A in art/loot/round-1-loop/). Code models on
 * the low-poly kit, Wendell's look (src/shards/driftwood-isle/npc/Castaway.ts), built in their own space: feet / foot of the counter
 * at the origin, front toward +Z.
 *
 * - `trader`: the NPC (src/shards/driftwood-isle/npc/Trader.ts): one figure, turned on pivots; the world keeps it live with
 *   `traderOf(placed.object).update(…)`. A capsule collider.
 * - `tradeCounter`: a driftwood plank counter on crooked log legs with a lower shelf (a crate on it), a cream sailcloth
 *   runner with a teal stripe draped over the front, and the shop's goods on top: two whetstones on a wooden block (the
 *   whetstone I and II), a red heart charm on a cord hung from a little T-stand (the sturdy heart) with a smaller heart
 *   beside it, a rolled sea chart tied with twine, a folded sailcloth cape with a rope clasp, a brass dish of doubloons.
 *   One merged mesh, one draw. A box collider (you walk round it, never up it).
 *
 * The world side (where they stand, the per-frame update) is src/shards/driftwood-isle/quest/TraderStall.ts. No shop logic here.
 */
import * as THREE from 'three';
import { defineModel, type ModelDef, type ModelPart } from '@wildshard/engine/models/model';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { Trader } from '../npc/Trader';
import { traderRig } from '../quest/people';
import type { NpcRig } from '@wildshard/game/systems/npc/npcRig';

import { COUNTER_TOP as TOP } from '../data/counterLayout';
import { COUNTER_GEOMETRY, fixedGeometryReady, loadFixedGeometry } from '../boot/fixedGeometry';

const byGroup = new WeakMap<THREE.Object3D, NpcRig<Trader, Sky>>();

/** the live Trader behind a placed copy of `trader` (null: not one) */
export function traderOf(o: THREE.Object3D): Trader | null { return byGroup.get(o)?.model ?? null; }

export function traderRigOf(o: THREE.Object3D): NpcRig<Trader, Sky> | null { return byGroup.get(o) ?? null; }

export const trader: ModelDef<object> = defineModel<object>({
  id: 'driftwood-isle/trader', name: 'The trader', category: 'people', pipeline: 'code', file: 'src/shards/driftwood-isle/models/trader.ts', surface: 'flesh',
  defaults: {},
  build: (ctx) => { const rig = traderRig(ctx.sky); byGroup.set(rig.model.group, rig); return rig.model.group; },
  colliders: () => [{ kind: 'capsule', x: 0, y: 0.9, z: 0, halfHeight: 0.62, radius: 0.26 }],
});

export const tradeCounter: ModelDef<object> = defineModel<object>({
  id: 'driftwood-isle/trade-counter', name: 'The trader\'s counter', category: 'props', pipeline: 'code', file: 'src/shards/driftwood-isle/models/trader.ts', surface: 'wood',
  defaults: {},
  build: (ctx) => {
    const parts = (): readonly ModelPart[] => [{ geometry: COUNTER_GEOMETRY.copy(), material: lowPolyMaterial(ctx.sky), castShadow: true, receiveShadow: true }];
    if (fixedGeometryReady()) return parts();
    return loadingSpecimen('driftwood-isle/trade-counter', [TOP.w, TOP.y + 0.4, TOP.d], async () => {
      await loadFixedGeometry();
      const [part] = parts();
      if (part === undefined) throw new Error('Trade counter geometry missing');
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      return mesh;
    });
  },
  colliders: () => [{ kind: 'box', x: 0, y: TOP.y / 2, z: 0, hx: TOP.w / 2, hy: TOP.y / 2, hz: TOP.d / 2 + 0.02 }],
});
