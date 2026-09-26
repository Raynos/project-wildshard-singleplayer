// The Kowloon wall generator: a wall plane filled with bays of stacked blocks at random setbacks, each ruled with its
// windows, then dressed with balconies, window cages, air-con boxes, pipes and laundry. Used for the towers around the
// square and for the four walls of the Yamen Well, top to bottom.
import { Vector3 } from 'three';
import type { Ctx } from './ctx';
import { E, K, type Look } from './kit';
import { hipRoof } from './square';
import { laundry } from './props';
import { WALL, chars, type Rng } from './util';

export interface WallSpec {
  /** a point on the wall plane at the start of its run (any height) */
  p0: Vector3;
  /** the outward normal (horizontal) */
  n: Vector3;
  length: number;
  y0: number;
  y1: number;
  kit: string;
  alpha: string;
  seed: number;
  /** how far blocks may step out (m) */
  maxOut?: number;
  /** attachment density 0..1 */
  dress?: number;
  /** perch glazed roofs on some block tops */
  roofs?: boolean;
  /** a ruled ledge with a railing every `ledgeEvery` metres of height (the Well's balconies) */
  ledges?: number[];
  reflective?: boolean;
  /** darker washes (the deep strata) */
  tone?: number;
}

export const up = new Vector3(0, 1, 0);

/** the (u, up, n) frame of a wall: u runs along it so that u × up = n */
export function frame(n: Vector3): { u: Vector3; n: Vector3 } {
  const nn = n.clone().setY(0).normalize();
  return { u: new Vector3().crossVectors(up, nn).normalize(), n: nn };
}

function tint(hex: number, t: number): number {
  const r = ((hex >> 16) & 255) * t, g = ((hex >> 8) & 255) * t, b = (hex & 255) * t;
  return (Math.min(255, Math.round(r)) << 16) | (Math.min(255, Math.round(g)) << 8) | Math.min(255, Math.round(b));
}

export function buildWall(ctx: Ctx, s: WallSpec, rng: Rng): void {
  const k = ctx.kit(s.kit, s.reflective === true);
  const ka = ctx.alpha(s.alpha);
  const { u, n } = frame(s.n);
  const dress = s.dress ?? 0.6;
  const maxOut = s.maxOut ?? 1.6;
  const tone = s.tone ?? 1;
  let x = 0;
  while (x < s.length - 0.5) {
    const bw = Math.min(s.length - x, rng.range(5.5, 11));
    let y = s.y0;
    const colP = rng.pick([1.6, 1.9, 2.1, 2.4, 2.7]);
    let lastOut = 0;
    while (y < s.y1 - 0.5) {
      const floors = rng.int(2, 7);
      const bh = Math.min(s.y1 - y, floors * 3.2);
      const out = rng.chance(0.25) ? 0 : rng.range(0.2, maxOut);
      const wash = tint(rng.pick(WALL), tone * rng.range(0.9, 1.06));
      const look: Look = { wash, kind: K.facade, row: 3.0, col: colP, seed: rng.range(0, 99), line: 1 };
      const depth = 6 + out;
      const c = s.p0.clone().addScaledVector(u, x + bw / 2).addScaledVector(n, out - depth / 2).setY(y + bh / 2);
      const topLook: Look = { wash: tint(wash, 0.85), line: 1 };
      k.boxAxes(c, u, up, n, bw / 2, bh / 2, depth / 2, look, { top: topLook, bottom: topLook, sides: 1 | 2 | 4 });
      // a slab lip at every block joint: the heavier ground line of each floor you could stand on
      if (Math.abs(out - lastOut) > 0.15) {
        const lc = s.p0.clone().addScaledVector(u, x + bw / 2).addScaledVector(n, Math.max(out, lastOut) / 2 + 0.1).setY(y - 0.12);
        k.boxAxes(lc, u, up, n, bw / 2 + 0.1, 0.12, Math.max(out, lastOut) / 2 + 0.2, { wash: tint(wash, 0.8), line: 1.6 });
      }
      lastOut = out;
      // perched glazed roof
      if (s.roofs === true && rng.chance(0.13) && bh > 6) {
        const rc = s.p0.clone().addScaledVector(u, x + bw / 2).addScaledVector(n, out - 2.2);
        const tile = rng.pick([0x2f7d5e, 0x2e5fa3, 0x3d6f8f, 0x2f7d5e]);
        const alongX = Math.abs(u.x) > 0.5;
        hipRoof(ctx, k, rc.x, y + bh + 0.1, rc.z, alongX ? bw + 0.8 : 4.8, alongX ? 4.8 : bw + 0.8, 1.6, 0.35, tile, null);
      }
      // dressing per floor and window column
      const face = out + 0.001;
      for (let f = 0; f < floors; f++) {
        const fy = y + f * 3.0;
        if (fy > s.y1 - 1) break;
        const cols = Math.max(1, Math.floor(bw / colP));
        for (let ci = 0; ci < cols; ci++) {
          const cu = x + (ci + 0.5) * (bw / cols);
          const r = rng.next();
          const at = s.p0.clone().addScaledVector(u, cu).addScaledVector(n, face).setY(fy);
          if (r < 0.13 * dress) {
            // balcony: slab + ruled railing (+ laundry)
            const bwid = Math.min(bw / cols * rng.range(1.0, 1.9), bw);
            const bd = rng.range(0.9, 1.4);
            k.boxAxes(at.clone().addScaledVector(n, bd / 2).setY(fy + 0.07), u, up, n, bwid / 2, 0.08, bd / 2, { wash: tint(wash, 0.9), line: 1.4 });
            const rail: Look = { wash: 0x2a2c31, kind: K.bars, row: 1, col: 0.14, line: 1 };
            ka.quad(at.clone().addScaledVector(n, bd).addScaledVector(u, -bwid / 2).setY(fy + 0.15), u, up, bwid, 1.0, rail);
            ka.quad(at.clone().addScaledVector(u, -bwid / 2).setY(fy + 0.15), n, up, bd, 1.0, rail);
            ka.quad(at.clone().addScaledVector(n, bd).addScaledVector(u, bwid / 2).setY(fy + 0.15), n.clone().negate(), up, bd, 1.0, rail);
            if (rng.chance(0.45)) {
              const la = at.clone().addScaledVector(n, bd - 0.1).addScaledVector(u, -bwid / 2 + 0.1).setY(fy + 2.4);
              laundry(k, rng, la, la.clone().addScaledVector(u, bwid - 0.2));
            }
          } else if (r < 0.25 * dress) {
            // window cage: a ruled box of bars
            const cw = bw / cols * 0.72, cd = rng.range(0.45, 0.75), ch = rng.range(1.6, 2.2);
            const cage: Look = { wash: 0x33363c, kind: K.bars, row: 0, col: 0.11, line: 1 };
            const base = at.clone().setY(fy + 0.55);
            ka.quad(base.clone().addScaledVector(n, cd).addScaledVector(u, -cw / 2), u, up, cw, ch, cage);
            ka.quad(base.clone().addScaledVector(u, -cw / 2), n, up, cd, ch, cage);
            ka.quad(base.clone().addScaledVector(n, cd).addScaledVector(u, cw / 2), n.clone().negate(), up, cd, ch, cage);
            k.boxAxes(base.clone().addScaledVector(n, cd / 2).setY(fy + 0.5), u, up, n, cw / 2 + 0.03, 0.05, cd / 2 + 0.03, { wash: 0x4a4d53, line: 1 });
            k.boxAxes(base.clone().addScaledVector(n, cd / 2).setY(fy + 0.55 + ch), u, up, n, cw / 2 + 0.05, 0.04, cd / 2 + 0.05, { wash: 0x4a4d53, line: 1 });
          } else if (r < 0.45 * dress) {
            const acAt = at.clone().addScaledVector(u, rng.range(-0.4, 0.4)).setY(fy + rng.range(0.1, 2.2));
            ctx.ac(acAt.x, acAt.y, acAt.z, Math.atan2(n.x, n.z));
          }
        }
      }
      y += bh;
    }
    // a drain pipe at the bay seam
    if (rng.chance(0.5 * dress)) {
      const px = s.p0.clone().addScaledVector(u, x + 0.2).addScaledVector(n, maxOut + 0.25);
      k.beam(px.clone().setY(s.y0), px.clone().setY(s.y1), 0.14, 0.14, { wash: 0x6b6f76, line: 0.8 }, new Vector3(n.x, 0, n.z));
    }
    x += bw;
  }
}

/** a shopfront band along the bottom of a wall: dark recess, a warm interior, an awning, a sign board over each shop */
export function shopfronts(ctx: Ctx, kitName: string, p0: Vector3, nIn: Vector3, length: number, y: number, rng: Rng,
  words: readonly string[], colors: readonly number[]): void {
  const k = ctx.kit(kitName, true);
  const { u, n } = frame(nIn);
  // the building mass behind the shops and the fascia band the signs hang on
  k.boxAxes(p0.clone().addScaledVector(u, length / 2).addScaledVector(n, -3.4).setY(y + 2.6), u, up, n, length / 2, 2.6, 3.0, { wash: 0x3a3d44, line: 1 }, { top: null, bottom: null, sides: 4 });
  k.boxAxes(p0.clone().addScaledVector(u, length / 2).addScaledVector(n, 0.12).setY(y + 4.85), u, up, n, length / 2, 0.3, 0.12, { wash: 0x6d727a, line: 1.5 });
  let x = 0.3;
  while (x < length - 2) {
    const w = Math.min(length - x - 0.3, rng.range(3.2, 5.5));
    const c = p0.clone().addScaledVector(u, x + w / 2);
    // pillar
    k.boxAxes(c.clone().addScaledVector(u, -w / 2).addScaledVector(n, 0.3).setY(y + 2.3), u, up, n, 0.22, 2.3, 0.3, { wash: 0x8f949b, line: 1 });
    // warm interior
    const lit = rng.chance(0.8);
    k.boxAxes(c.clone().addScaledVector(n, -0.2).setY(y + 1.6), u, up, n, w / 2 - 0.25, 1.6, 0.2,
      { wash: lit ? rng.pick([0xd9a868, 0xe0b47a, 0x9fc4c0, 0xd49a5c]) : 0x2c2f35, emit: lit ? 0.42 : 0, kind: K.facade, row: 0.55, col: 0.7, seed: rng.next() * 50, line: 1, accent: true, edges: E.all });
    // shelves / counter silhouettes
    k.boxAxes(c.clone().addScaledVector(n, 0.25).setY(y + 0.5), u, up, n, w / 2 - 0.5, 0.5, 0.3, { wash: 0x4a3a2c, kind: K.panel, line: 1 });
    // awning
    if (rng.chance(0.6)) {
      const aw = rng.pick([0xc23b22, 0x2e5fa3, 0x2f8a6a, 0xd9a441]);
      const a0 = c.clone().addScaledVector(u, -w / 2 + 0.2).addScaledVector(n, 0.4).setY(y + 3.4);
      k.quad4(a0.clone().addScaledVector(n, 1.5).setY(y + 2.9), a0.clone().addScaledVector(n, 1.5).addScaledVector(u, w - 0.4).setY(y + 2.9),
        a0.clone().addScaledVector(u, w - 0.4), a0.clone(), w - 0.4, 1.6, { wash: aw, kind: K.cloth, row: 1, col: 0.5, line: 1, accent: true });
    }
    // sign board over the shop
    const word = rng.pick(words);
    const col = rng.pick(colors);
    const hexs = `#${col.toString(16).padStart(6, '0')}`;
    const style = rng.chance(0.55) ? 'tube' : 'box';
    ctx.signs.place({
      at: c.clone().addScaledVector(n, 0.45).setY(y + 3.95), normal: n.clone(), size: Math.min(0.62, (w - 0.6) / (chars(word).length + 0.62)),
      spec: style === 'tube' ? { text: word, color: hexs, vertical: false, style: 'tube' } : { text: word, color: hexs, vertical: false, style: 'box' },
      flicker: rng.chance(0.1) ? rng.range(0.1, 1) : 0,
    }, k);
    x += w;
  }
}
