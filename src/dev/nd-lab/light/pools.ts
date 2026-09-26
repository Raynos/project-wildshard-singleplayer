// Lab P6 "light" (E169): which lights cast pools, and how hard. Turns the clean room's emitters (lanterns, lit
// shopfronts, lamps, neon signs, lightboxes) and its lit interior-mapped windows into PoolLights for the light volume
// (lightvol.ts). Every number here was tuned in the loop against the round-8 targets (round-9-lab-light/README.md).
import { Color, type Matrix4, Vector3, type Vector4 } from 'three';
import type { PoolLight } from './lightvol';

/** the clean room's Emitter (emitters.ts), structurally */
export interface EmitterLike { at: Vector3; color: Color; w: number; h: number; power: number; spill: number }
/** the facade grammar's WindowInst (facade/grammar.ts), structurally: win.y = lit (0 or 0.8–1.15) */
export interface WindowLike { m: Matrix4; win: Vector4; light: Color }

/** per source kind: strength k, radius r (m, scaled by the source's size where noted), reach in r, colour pull */
export const POOL = {
  /** paper lanterns: the candle light is amber, the paper's red only tints it */
  lantern: { k: 0.35, r: 2.0, cut: 3.0, tint: new Color(0xffa060), redShare: 0.2 },
  /** a lit shop interior (the emitter sits 0.1 m inside the shop's glazing, 1.6 m up) */
  shop: { k: 1.8, rPerW: 0.45, rMin: 1.8, cut: 3.0, out: 0.9, tint: new Color(0xffb866) },
  /** the square's street lamps (a warm sodium head 4.2 m up) */
  lamp: { k: 3.2, r: 2.6, cut: 3.4, tint: new Color(0xffc987) },
  /** neon signs and lightboxes: coloured, weaker, short */
  sign: { k: 0.45, rPerSize: 0.55, rMin: 0.8, cut: 2.4 },
  /** a lit window: warm light on its sill, the balcony floor under it and the wall around it */
  window: { k: 0.2, r: 0.8, cut: 2.4, out: 0.45 },
} as const;

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
    out.push({ at: e.at.clone(), color: L.tint.clone().lerp(e.color, L.redShare), k: L.k * s * scale.lantern, r: L.r * s, cut: L.cut });
  }
  // lit shops, stall counters, the shrine: the ctx emitters that are not lamps; weaker when their spill is (never
  // stronger: the stall's two 0.6 / 0.4 spill emitters washed the aerial square orange at ×2)
  const S = POOL.shop;
  for (const e of src.shops) {
    const k = S.k * Math.min(Math.max(e.spill / 0.3, 0.5), 1);
    out.push({ at: e.at.clone(), color: S.tint.clone().lerp(e.color, 0.5), k: k * scale.shop, r: Math.max(S.rMin, S.rPerW * e.w), cut: S.cut });
  }
  const P = POOL.lamp;
  for (const p of src.lamps) out.push({ at: p.clone(), color: P.tint.clone(), k: P.k * scale.lamp, r: P.r, cut: P.cut });
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
