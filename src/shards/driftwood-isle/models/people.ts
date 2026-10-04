/**
 * Driftwood Isle's people (E306 / E315 M5): Wendell the castaway, who gives the island's quest — built with the low-poly
 * kit in code (src/shards/driftwood-isle/npc/Castaway.ts: the striped shirt, the straw hat, the driftwood staff, and his campfire and
 * its smoke column beside him). Not skinned: his body, head and waving arm turn on pivots. The quest stands him by the
 * hut (src/shards/driftwood-isle/quest/Spine.ts); the card is the same build at his own origin, his fire where it burns beside him —
 * without the smoke column (a particle effect the world animates, not the figure: it would frame the card 12 m tall).
 */
import * as THREE from 'three';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { castawayRig } from '../quest/people';

export const castaway: ModelDef<object> = defineModel<object>({
  id: 'driftwood-isle/castaway', name: 'Wendell, the castaway', category: 'people', pipeline: 'code', file: 'src/shards/driftwood-isle/models/people.ts', surface: 'flesh',
  defaults: {},
  build: (ctx) => {
    const g = castawayRig(ctx.sky, { x: 0, y: 0, z: 0 }, { x: -1.2, y: 0, z: -1.1 }).model.group;
    const smoke: THREE.Object3D[] = [];
    g.traverse((o) => { if (o instanceof THREE.Points) smoke.push(o); });
    for (const o of smoke) o.removeFromParent();
    return g;
  },
});
