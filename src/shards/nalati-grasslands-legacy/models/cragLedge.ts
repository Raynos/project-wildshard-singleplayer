/**
 * The crag ledge (E306 / E315 M3): a flat granite slab jutting from a mountain slope, snow on its top above the snow
 * line — walkable, the snow leopard's (Aqbars, B12) lookouts round his cave on the west massif (src/shards/nalati-grasslands/world/Crags.ts
 * finds six on the valley-facing flanks). Placed at the slab's centre with `at.y` = its walkable top, `yaw` = downhill;
 * every copy its own size and shape (its seed drawn from its place's rng stream). Painted into its place's mesh
 * (src/shards/nalati-grasslands/world/painted.ts). Collides: the slab as a box whose top is the ledge (a real floor since P1).
 */
import * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import { M } from '../world/paint';
import { graniteBlock } from '../world/granite';
import { painted, type Paint } from '../world/painted';

export interface CragLedgeParams {
  /** the slab's width across the slope and its depth out of it (m) */
  readonly w: number;
  readonly d: number;
  /** snow settles on its top above this height */
  readonly snowLine: number;
}

const C = { graniteDark: new THREE.Color('#6e675f'), snow: new THREE.Color('#f1f4f8') };
const TH = 1.6;

const paint: Paint<CragLedgeParams> = (kit, at, p) => {
  const rng = kit.rng, top = at.y, yaw = at.yaw;
  kit.add(graniteBlock(p.w, TH, p.d, rng.int(1, 9999), 0.12), C.graniteDark, { top: { color: C.snow, threshold: 0.45, amount: 0.95, minY: p.snowLine }, brush: 0.1, matrix: M(at.x, top - TH / 2 + 0.05, at.z, yaw) });
  const cs = Math.cos(yaw), sn = Math.sin(yaw), hw = p.w / 2 - 0.25, hd = p.d / 2 - 0.25;
  return {
    boxes: [{ x: at.x, z: at.z, hw: p.w / 2 - 0.3, hd: p.d / 2 - 0.3, rot: -yaw, yBottom: top - 6, yTop: top }],
    // (the box's top is the ledge: a real floor since P1 — this is placement only)
    floor: (qx, qz) => { const dx = qx - at.x, dz = qz - at.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; return Math.abs(lx) <= hw && Math.abs(lz) <= hd ? top : undefined; },
  };
};

export const cragLedge = defineModel<CragLedgeParams>({
  id: 'nalati-grasslands/crag-ledge', name: 'Crag ledge', category: 'nature', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/models/cragLedge.ts', surface: 'rock',
  defaults: { w: 5, d: 3.5, snowLine: 60 },
  build: painted(paint, { seed: 0xc4a6, finish: { aoH: 1.2 } }),
});
