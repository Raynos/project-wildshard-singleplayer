// Copied from the light lab (the dev labs (deleted in E357 F7), round-9-lab-light) into the clean room.
// Lab P6 "light" (E169): which lights cast pools, and how hard. Turns the clean room's emitters (lanterns, lit
// shopfronts, lamps, neon signs, lightboxes) and its lit interior-mapped windows into PoolLights for the light volume
// (@wildshard/sdk/looks/lightVolume). Every number here was tuned in the loop against the round-8 targets (round-9-lab-light/README.md).
import { Color, type Matrix4, Vector3, type Vector4 } from 'three';
import type { PoolLight } from '@wildshard/sdk/looks/lightVolume';
import { POOL } from '../../data/light';
// SHARD-PLATFORM M3: the pools' tuning is data (data/light.ts POOL, colours as hex).

/** the clean room's Emitter (emitters.ts), structurally */
export interface EmitterLike { at: Vector3; color: Color; w: number; h: number; power: number; spill: number }
/** the facade grammar's WindowInst (facade/grammar.ts), structurally: win.y = lit (0 or 0.8–1.15) */
export interface WindowLike { m: Matrix4; win: Vector4; light: Color }

const tmpP = new Vector3(), tmpN = new Vector3();

export interface PoolSources {
  lanterns: readonly EmitterLike[];
  shops: readonly EmitterLike[];
  lamps: readonly Vector3[];
  signs: readonly EmitterLike[];
  windows: readonly WindowLike[];
}

export interface PoolScale { lantern: number; shop: number; lamp: number; sign: number; window: number }
const UNIT: PoolScale = { lantern: 1, shop: 1, lamp: 1, sign: 1, window: 1 };

export function gatherPools(src: PoolSources, scale: PoolScale = UNIT): PoolLight[] {
  const out: PoolLight[] = [];
  const L = POOL.lantern;
  for (const e of src.lanterns) {
    const s = e.w / 0.5;
    out.push({ at: e.at.clone(), color: new Color(L.tint).lerp(e.color, L.redShare), k: L.k * s * scale.lantern, r: L.r * s, cut: L.cut });
  }
  // lit shops, stall counters, the shrine: the ctx emitters that are not lamps; weaker when their spill is (never
  // stronger: the stall's two 0.6 / 0.4 spill emitters washed the aerial square orange at ×2)
  const S = POOL.shop;
  for (const e of src.shops) {
    const k = S.k * Math.min(Math.max(e.spill / 0.3, 0.5), 1);
    out.push({ at: e.at.clone(), color: new Color(S.tint).lerp(e.color, 0.5), k: k * scale.shop, r: Math.max(S.rMin, S.rPerW * e.w), cut: S.cut });
  }
  const P = POOL.lamp;
  for (const p of src.lamps) out.push({ at: p.clone(), color: new Color(P.tint), k: P.k * scale.lamp, r: P.r, cut: P.cut });
  const G = POOL.sign;
  for (const e of src.signs) {
    if (e.spill <= 0) continue;
    const size = Math.max(e.w, e.h);
    out.push({ at: e.at.clone(), color: e.color.clone(), k: G.k * Math.min(e.power, 1.5) * scale.sign, r: Math.max(G.rMin, G.rPerSize * size), cut: G.cut });
  }
  const W = POOL.window;
  for (const w of src.windows) {
    const lit = w.win.y;
    if (lit <= 0) continue;
    tmpP.setFromMatrixPosition(w.m);
    tmpN.setFromMatrixColumn(w.m, 2).normalize();
    const h = new Vector3().setFromMatrixColumn(w.m, 1).length();
    out.push({ at: tmpP.clone().addScaledVector(tmpN, W.out).setY(tmpP.y + h * 0.5), color: w.light.clone(), k: W.k * lit * scale.window, r: W.r, cut: W.cut });
  }
  return out;
}

/** the square's lamps (square.ts pushes them as 0.34 × 0.3 m emitters); every other ctx emitter is a shop-like light
 *  (a lit shop interior sits 0.1 m inside its glazing: the omni light reaches the square through it) */
export function isLamp(e: EmitterLike): boolean { return e.w < 0.5 && e.h < 0.5; }
