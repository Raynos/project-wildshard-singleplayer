/**
 * The reef fish (E306 / E315 M1: a model on the contract, src/engine/models/model.ts; it was built inside src/shards/driftwood-isle/world/Seabed.ts):
 * a small faceted fish — a flattened diamond body (8 tris) and a tail fin (2), nose along −z, ~0.35 m long — on a plain
 * flat-shaded material, its colour per copy (instanceColor). The lagoon places a school of them instanced (one draw) over
 * its densest reef and swims them round a lissajous loop every frame (src/shards/driftwood-isle/world/Seabed.ts).
 */
import * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';

/** the fish's colours: each copy takes one (Placement.color) */
export const REEF_FISH_COLOURS = [0xffb347, 0x4fc3f7, 0xf06292, 0xfff176] as const;

export const reefFish = defineModel<Record<string, never>>({
  id: 'driftwood-isle/reef-fish', name: 'Reef fish', category: 'creatures', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/reefFish.ts',
  defaults: {},
  build: (ctx) => {
    const pos: number[] = [];
    const nose = [0, 0, -0.18], tail = [0, 0, 0.14], top = [0, 0.07, -0.02], bot = [0, -0.06, -0.02], l = [-0.035, 0, -0.03], r = [0.035, 0, -0.03];
    const t1 = [0, 0.07, 0.24], t2 = [0, -0.07, 0.24];
    const faces = [[nose, top, l], [nose, r, top], [nose, l, bot], [nose, bot, r], [tail, l, top], [tail, top, r], [tail, bot, l], [tail, r, bot], [tail, t1, t2], [tail, t2, t1]];
    for (const f of faces) for (const v of f) pos.push(...v);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geometry.computeVertexNormals();
    const material = ctx.once('driftwood-isle/reef-fish:material', () => {
      const m = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.6, metalness: 0.1 });
      ctx.sky.setupMaterial(m);
      return m;
    });
    return [{ geometry, material }];
  },
});
