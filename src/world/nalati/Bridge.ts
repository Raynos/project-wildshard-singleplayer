/**
 * Bridge — the timber bridge carrying the N road over the Kunes at (0, 160) (map-01 "BRIDGE", deck −6). A plank deck
 * on four log stringers, resting on log cribs (square boxes of crossed logs, stone-filled, a raked ice-breaker on the
 * upstream / east side) spaced ~8 m across the braided corridor, with a crib abutment at each bank; wheel-guard logs,
 * post-and-rail handrails with knee braces. The ends are found from the terrain: the deck runs until the road meets
 * it (so a terrain tweak doesn't leave it floating or buried).
 *
 *   const bridge = buildBridge(ctx);  // PoiPiece: the deck as plank slabs (level + the two ramps), rails / cribs as boxes; `floor` = the deck (placement)
 *
 * The deck is level (−6) over the corridor and ramps down 1 : 5 at either end until it meets the road, so a bank lower
 * than the deck (the sky road's foot is at −8.6) gets a ramped approach instead of a step.
 */
import * as THREE from 'three';
import { PaintKit, M, pole, v3, blob, logPainter } from './paint';
import { BRIDGE } from './layout';
import type { ColliderDesc } from '../registry';
import { slab, type Box } from './solid';
import type { PoiCtx, PoiPiece } from './types';

const C = {
  plank: new THREE.Color('#9a7550'),
  plankDark: new THREE.Color('#76573a'),
  log: new THREE.Color('#7b5b3e'),
  logGrey: new THREE.Color('#8d8171'),
  stone: new THREE.Color('#8e8b85'),
  stoneDark: new THREE.Color('#6f6c67'),
  endGrain: new THREE.Color('#c7a67a'),
};

export function buildBridge(ctx: PoiCtx): PoiPiece {
  const { sky, ground } = ctx;
  const kit = new PaintKit(0xb21d);
  const rng = kit.rng;
  const colliders: Box[] = [];
  const descs: ColliderDesc[] = [];
  const bx = BRIDGE.x, bz = BRIDGE.z, deck = BRIDGE.deckY, W = BRIDGE.width;

  // the deck is level over the river corridor (±half0) and ramps down (1 : 5) beyond it until it meets the road
  const half0 = BRIDGE.span / 2, SLOPE = 0.2;
  const findEnd = (dir: number) => {
    for (let d = 6; d < half0 + 26; d += 0.25) {
      const y = deck - Math.max(0, d - half0) * SLOPE;
      if (ground(bx, bz + dir * d) >= y - 0.15) return d + 0.4;
    }
    return half0 + 26;
  };
  const zS = bz - findEnd(-1), zN = bz + findEnd(1), L = zN - zS;
  const zFs = Math.max(zS, bz - half0), zFn = Math.min(zN, bz + half0);                  // the level part
  const prof = (z: number) => deck - Math.max(0, zFs - z, z - zFn) * SLOPE;
  const top = deck, stringerY = -0.27;                                                    // stringers: 0.27 m under the deck surface

  // ── cribs under the level span (abutment-size at its ends), post pairs under the ramps ──
  const cribAt: number[] = [zFs + 1.4, zFn - 1.4];
  const spanL = zFn - zFs;
  const nPiers = Math.max(1, Math.round((spanL - 2.8) / 8.5) - 1);
  for (let i = 1; i <= nPiers; i++) cribAt.push(zFs + 1.4 + ((spanL - 2.8) * i) / (nPiers + 1));
  for (const cz of cribAt) {
    let gy = Infinity;
    for (const [dx, dz] of [[-1.4, -1.1], [1.4, -1.1], [-1.4, 1.1], [1.4, 1.1], [0, 0]] as const) gy = Math.min(gy, ground(bx + dx, cz + dz));
    const y0 = gy - 0.5, y1 = top + stringerY - 0.2;
    if (y1 - y0 < 0.4) continue;
    const layers = Math.ceil((y1 - y0) / 0.3);
    for (let l = 0; l < layers; l++) {
      const y = y0 + 0.15 + l * 0.3;
      const logs: [THREE.Vector3, THREE.Vector3][] = l % 2 === 0
        ? [-1.05, 1.05].map((sz) => [v3(bx - 1.75, y, cz + sz), v3(bx + 1.75, y, cz + sz + rng.range(-0.04, 0.04))])
        : [-1.35, 1.35].map((sx) => [v3(bx + sx, y, cz - 1.45), v3(bx + sx + rng.range(-0.04, 0.04), y, cz + 1.45)]);
      for (const [a, b] of logs) kit.add(pole(a, b, 0.16, 0.15, 8), logPainter(a, b, rng.next() < 0.3 ? C.logGrey : C.log, C.endGrain), { jitter: 0.09 });
      // the stone fill bulging out between the log courses
      if (y > gy - 0.2) for (const side of [0, 1, 2, 3]) for (let k = 0; k < 2; k++) {
        const u = rng.range(-0.9, 0.9), s = rng.range(0.13, 0.19);
        const px = side < 2 ? bx + u * 1.2 : bx + (side === 2 ? -1.28 : 1.28), pz = side < 2 ? cz + (side === 0 ? -0.98 : 0.98) : cz + u * 0.95;
        kit.add(blob(s, rng, 0, 0.8, 0.25), rng.next() < 0.5 ? C.stone : C.stoneDark, { matrix: M(px, y + 0.15, pz, rng.range(0, 6)), brush: 0.1 });
      }
    }
    // stone fill showing at the top, and a raked ice-breaker on the upstream (east, −x) side
    for (let k = 0; k < 6; k++) kit.add(blob(0.32, rng, 1, 0.7), C.stone, { matrix: M(bx + rng.range(-1, 1), y1 - 0.12, cz + rng.range(-0.7, 0.7), rng.range(0, 6)) });
    if (cz !== cribAt[0] && cz !== cribAt[1]) {
      for (const sz of [-0.9, 0, 0.9]) kit.add(pole(v3(bx - 1.5, y1 - 0.1, cz + sz * 0.6), v3(bx - 4.2, y0 + 0.2, cz + sz * 0.15), 0.13, 0.12, 6), C.logGrey, { jitter: 0.08 });
    }
    colliders.push({ x: bx, z: cz, hw: 1.9, hd: 1.55, rot: 0, yBottom: y0 - 2, yTop: y1 - 0.2 });
  }
  for (const [z0, z1] of [[zS, zFs], [zFn, zN]] as const) {
    for (let z = z0 + 1.2; z < z1 - 0.6; z += 2.4) {
      for (const sx of [-1.65, 1.65]) { const gy = ground(bx + sx, z); if (prof(z) + stringerY - gy > 0.25) kit.add(pole(v3(bx + sx, gy - 0.4, z), v3(bx + sx, prof(z) + stringerY, z), 0.13, 0.12, 7), C.log, { jitter: 0.08 }); }
    }
  }

  // ── stringers (a level run + the two ramps) ──
  const breaks = [zS - 0.3, zFs, zFn, zN + 0.3];
  for (const sx of [-1.65, -0.55, 0.55, 1.65]) for (let i = 0; i + 1 < breaks.length; i++) {
    const za = breaks[i] ?? zS, zb = breaks[i + 1] ?? zN;
    if (zb - za < 0.2) continue;
    kit.add(pole(v3(bx + sx, prof(za) + stringerY, za), v3(bx + sx, prof(zb) + stringerY, zb), 0.19, 0.18, 8), C.log, { jitter: 0.06 });
  }

  // ── deck planks, across the road (pitched on the ramps) ──
  for (let z = zS; z < zN; z += 0.3) {
    const zc = z + 0.15, pitch = zc < zFs ? -Math.atan(SLOPE) : zc > zFn ? Math.atan(SLOPE) : 0;
    const len = W + rng.range(-0.12, 0.12);
    kit.add(new THREE.BoxGeometry(len, 0.08, 0.28), rng.next() < 0.28 ? C.plankDark : C.plank, { matrix: M(bx + rng.range(-0.06, 0.06), prof(zc) - 0.04 + rng.range(-0.008, 0.008), zc, rng.range(-0.02, 0.02), 1, 1, 1, pitch), flat: true, jitter: 0.07 });
  }
  // wheel guards
  for (const sx of [-1, 1]) for (let i = 0; i + 1 < breaks.length; i++) {
    const za = Math.max(zS, breaks[i] ?? zS), zb = Math.min(zN, breaks[i + 1] ?? zN);
    if (zb - za < 0.2) continue;
    kit.add(pole(v3(bx + sx * (W / 2 - 0.2), prof(za) + 0.1, za), v3(bx + sx * (W / 2 - 0.2), prof(zb) + 0.1, zb), 0.1, 0.1, 6), C.logGrey, { jitter: 0.06 });
  }

  // ── handrails: posts every ~2.3 m, top + mid rails post to post, knee braces to the outer stringer ──
  const n = Math.max(2, Math.round(L / 2.3));
  for (const sx of [-1, 1]) {
    const x = bx + sx * (W / 2 + 0.05);
    let prev: THREE.Vector3 | null = null;
    for (let i = 0; i <= n; i++) {
      const z = zS + 0.2 + ((L - 0.4) * i) / n, y = prof(z);
      kit.add(pole(v3(x, y - 0.25, z), v3(x, y + 1.1, z), 0.085, 0.075, 6), C.log, { jitter: 0.08 });
      kit.add(pole(v3(x, y + 0.6, z), v3(x + sx * 0.75, y + stringerY - 0.1, z), 0.05, 0.05, 5), C.logGrey, { jitter: 0.08 });
      const cur = v3(x, y, z);
      if (prev) {
        kit.add(pole(v3(x, prev.y + 1.05, prev.z), v3(x, y + 1.05, z), 0.065, 0.065, 6), C.logGrey);
        kit.add(pole(v3(x, prev.y + 0.55, prev.z), v3(x, y + 0.55, z), 0.05, 0.05, 6), C.logGrey);
        colliders.push({ x, z: (prev.z + z) / 2, hw: 0.12, hd: (z - prev.z) / 2 + 0.05, rot: 0, yBottom: Math.min(prev.y, y) - 0.5, yTop: Math.max(prev.y, y) + 1.15 });
      }
      prev = cur;
    }
  }
  // bank stones round the ends
  for (const z0 of [zS, zN]) for (let k = 0; k < 7; k++) {
    const x = bx + (k < 4 ? -1 : 1) * rng.range(3.3, 5.2), z = z0 + rng.range(-1.5, 1.5);
    kit.add(blob(rng.range(0.35, 0.7), rng, 1, 0.6), C.stone, { matrix: M(x, ground(x, z) - 0.1, z, rng.range(0, 6)) });
  }

  const mesh = kit.mesh(sky, { ground, aoH: 0.6 });
  mesh.name = 'nalati-bridge';
  const platform = (x: number, z: number): number | undefined => (Math.abs(x - bx) <= W / 2 + 0.1 && z >= zS - 0.3 && z <= zN + 0.3 ? prof(z) : undefined);
  // the deck as real geometry (P1): the level span as one plank slab, each ramp a slab tipped 1 : 5 whose top meets the
  // span's edge and runs 0.3 m past the road's lip (its low end is under the turf there)
  const hx = W / 2 + 0.1, thick = 0.35;
  descs.push(slab(bx, (zFs + zFn) / 2, top, thick, hx, (zFn - zFs) / 2, 0, 'planks'));
  const pitch = Math.atan(SLOPE);
  for (const [z0, z1, s] of [[zS - 0.3, zFs, -1], [zFn, zN + 0.3, 1]] as const) {
    if (z1 - z0 < 0.2) continue;
    const len = (z1 - z0) / Math.cos(pitch), zc = (z0 + z1) / 2;
    descs.push(slab(bx, zc, prof(zc), thick, hx, len / 2, 0, 'planks', s < 0 ? -pitch : pitch));
  }
  return { name: 'bridge', object: mesh, colliders, surface: 'wood', descs, floor: platform, tris: mesh.geometry.getAttribute('position').count / 3 };
}
