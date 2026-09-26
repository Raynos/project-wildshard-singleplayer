// The Kowloon wall generator: a wall plane filled with bays of stacked blocks at random setbacks, each ruled with its
// windows, then dressed with balconies, window cages, air-con boxes, pipes and laundry. Used for the towers around the
// square and for the four walls of the Yamen Well, top to bottom.
import { Color, Vector3 } from 'three';
import type { Ctx } from './ctx';
import { E, K, type Look } from './kit';
import { hipRoof } from './square';
import { Y0 } from './layout';
import { SIGN_WORDS } from './words';
import { NEON, WALL, chars, type Rng } from './util';

const AWNINGS = [0xc23b22, 0x2e5fa3, 0x2f8a6a, 0xd9a441, 0xe8dfc9, 0x8a3a6a, 0xc23b22] as const;
const SIGNCOLS = [NEON.magenta, NEON.cyan, NEON.jade, NEON.red, NEON.amber, NEON.red, 0xff7a2a] as const;
const hexOf = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

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
  /** shacks, tanks and antennas on the bays' top blocks (off for a band that is not the tower's top) */
  rooftop?: boolean;
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
      if (s.roofs === true && rng.chance(0.26) && bh > 6) {
        const rc = s.p0.clone().addScaledVector(u, x + bw / 2).addScaledVector(n, out - 2.2);
        const tile = rng.pick([0x2f7d5e, 0x2e5fa3, 0x3d6f8f, 0x2f7d5e]);
        const alongX = Math.abs(u.x) > 0.5;
        hipRoof(ctx, k, rc.x, y + bh + 0.1, rc.z, alongX ? bw + 0.8 : 4.8, alongX ? 4.8 : bw + 0.8, 1.6, 0.35, tile, null);
      }
      // dressing per floor and window column: every bay gets something (the Kowloon density), as instanced pieces
      const face = out + 0.001;
      const top = y + bh >= s.y1 - 0.5;
      for (let f = 0; f < floors; f++) {
        const fy = y + f * 3.0;
        if (fy > s.y1 - 1) break;
        const dz = dress * (fy < Y0 - 70 ? 0.45 : 1);
        const cols = Math.max(1, Math.floor(bw / colP));
        const cw = bw / cols;
        for (let ci = 0; ci < cols; ci++) {
          const cu = x + (ci + 0.5) * cw;
          const r = rng.next();
          const at = s.p0.clone().addScaledVector(u, cu).addScaledVector(n, face).setY(fy);
          if (r < 0.17 * dz) {
            const bwid = Math.min(cw * rng.range(1.0, 1.9), bw), bd = rng.range(0.9, 1.4);
            ctx.put('balcony', at.clone().setY(fy + 0.02), n, new Vector3(bwid, 1, bd), new Color(tint(wash, 1.05)));
            if (rng.chance(0.55)) ctx.put('plant', at.clone().addScaledVector(n, bd - 0.28).addScaledVector(u, rng.range(-bwid / 3, bwid / 3)).setY(fy + 0.14), n, new Vector3(1, rng.range(0.8, 1.3), 1));
            if (rng.chance(0.5)) ctx.put('laundry', at.clone().addScaledVector(u, rng.range(-bwid / 3, bwid / 3)).setY(fy + 2.45), n, new Vector3(1, 1, bd / 1.4));
            if (rng.chance(0.12) && fy > Y0 - 40) ctx.lantern(at.x + n.x * (bd - 0.2), fy + 2.6, at.z + n.z * (bd - 0.2), 0.6);
          } else if (r < 0.32 * dz) {
            ctx.put('cage', at.clone().setY(fy + 0.45), n, new Vector3(cw * rng.range(0.7, 0.9), rng.range(0.85, 1.1), rng.range(0.8, 1.3)));
            if (rng.chance(0.3)) ctx.put('plant', at.clone().addScaledVector(n, 0.28).setY(fy + 0.52), n, new Vector3(0.8, 0.8, 0.8));
          } else if (r < 0.43 * dz) {
            ctx.put('awning', at.clone().setY(fy + 2.55), n, new Vector3(cw * 0.85, 1, rng.range(0.8, 1.2)), new Color(rng.pick(AWNINGS)));
          } else if (r < 0.52 * dz) {
            ctx.put('laundry', at.clone().addScaledVector(u, rng.range(-0.3, 0.3)).setY(fy + 2.35), n, new Vector3(1, 1, rng.range(0.7, 1.1)));
          } else if (r < 0.6 * dz) {
            ctx.put('plant', at.clone().addScaledVector(n, 0.2).addScaledVector(u, rng.range(-0.4, 0.4)).setY(fy + 0.75), n, new Vector3(0.75, 0.75, 0.75));
          } else if (r < 0.66 * dz && fy < s.y0 + 40) {
            ctx.put('lightbox', at.clone().addScaledVector(u, rng.range(-0.3, 0.3)).setY(fy + rng.range(0.4, 1.4)), n, new Vector3(rng.range(0.8, 1.3), rng.range(0.8, 1.5), 1), new Color(rng.pick(SIGNCOLS)));
          }
          if (rng.chance(0.3 * dz)) {
            const acAt = at.clone().addScaledVector(u, rng.range(-0.45, 0.45)).setY(fy + rng.range(0.1, 2.2));
            ctx.ac(acAt.x, acAt.y, acAt.z, Math.atan2(n.x, n.z));
          }
          // a big blade sign now and then near the street
          if (fy < s.y0 + 30 && fy > Y0 - 60 && rng.chance(0.035 * dz)) {
            const word = rng.pick(SIGN_WORDS);
            const size = rng.range(0.75, 1.25);
            const sw = size * 1.36;
            ctx.signs.place({ at: at.clone().addScaledVector(n, 0.9 + sw / 2).setY(fy + 1.2), normal: u.clone(), size,
              spec: rng.chance(0.75) ? { text: word, color: hexOf(rng.pick(SIGNCOLS)), vertical: true, style: 'tube' } : { text: word, color: hexOf(rng.pick(SIGNCOLS)), vertical: true, style: 'box' },
              blade: true, flicker: rng.chance(0.07) ? rng.next() : 0 }, k);
          }
        }
        // a cable bundle sagging along the facade
        if (rng.chance(0.18 * dz)) {
          const cy = fy + rng.range(2.6, 2.95);
          const a0 = s.p0.clone().addScaledVector(u, x).addScaledVector(n, face + 0.15).setY(cy);
          const a1 = a0.clone().addScaledVector(u, bw);
          const mid = a0.clone().lerp(a1, 0.5).add(new Vector3(0, -rng.range(0.3, 0.8), 0)).addScaledVector(n, 0.2);
          k.beam(a0, mid, 0.06, 0.06, { wash: 0x1d1e22, line: 0.4 });
          k.beam(mid, a1, 0.06, 0.06, { wash: 0x1d1e22, line: 0.4 });
        }
      }
      // rooftop clutter on the bay's top block: shacks, a water tank, an antenna
      if (top && s.rooftop !== false && y + bh > Y0 - 20) {
        const rp = s.p0.clone().addScaledVector(u, x + rng.range(1.5, Math.max(1.6, bw - 1.5))).addScaledVector(n, out - rng.range(2.2, 4)).setY(y + bh);
        if (rng.chance(0.55)) ctx.put('shack', rp, n, new Vector3(rng.range(0.8, 1.2), rng.range(0.9, 1.15), rng.range(0.8, 1.1)), new Color(tint(0xffffff, rng.range(0.85, 1.05))));
        if (rng.chance(0.45)) ctx.put('tank', rp.clone().addScaledVector(u, rng.range(-2.5, 2.5)), n, new Vector3(1, 1, 1));
        if (rng.chance(0.4)) k.beam(rp.clone().addScaledVector(u, 1.2), rp.clone().addScaledVector(u, 1.2).add(new Vector3(0, rng.range(4, 9), 0)), 0.08, 0.08, { wash: 0x2a2c31, line: 0.8 });
      }
      y += bh;
    }
    // drain pipes at the bay seams
    if (rng.chance(0.7 * dress)) {
      const px = s.p0.clone().addScaledVector(u, x + 0.25).addScaledVector(n, maxOut + 0.1).setY(s.y0);
      ctx.put('pipe', px, n, new Vector3(1, s.y1 - s.y0, 1));
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
    if (lit) ctx.emitters.push({ at: c.clone().addScaledVector(n, -0.1).setY(y + 1.6), color: new Color(0xffc48a), w: w - 0.5, h: 2.6, power: 0.24, spill: 0.3 });
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
    // a glazed pent roof over the shop, a lantern under it now and then
    const tile = rng.pick([0x2f7d5e, 0x2e5fa3, 0x2f7d5e, 0xb8321f]);
    const e0 = c.clone().addScaledVector(u, -w / 2).setY(y + 5.05), e1 = c.clone().addScaledVector(u, w / 2).setY(y + 5.05);
    k.quad4(e0.clone().addScaledVector(n, 1.45).setY(y + 4.45), e1.clone().addScaledVector(n, 1.45).setY(y + 4.45), e1.clone().addScaledVector(n, 0.1), e0.clone().addScaledVector(n, 0.1),
      w, 1.5, { wash: tile, kind: K.tiles, line: 1, accent: true });
    k.boxAxes(c.clone().addScaledVector(n, 1.45).setY(y + 4.38), u, up, n, w / 2, 0.09, 0.06, { wash: 0x7e1e1a, line: 1, accent: true });
    if (rng.chance(0.45)) ctx.lantern(c.x + n.x * 1.2 + u.x * rng.range(-w / 3, w / 3), y + 4.25, c.z + n.z * 1.2 + u.z * rng.range(-w / 3, w / 3), 0.75);
    // sign board over the shop
    const word = rng.pick(words);
    const col = rng.pick(colors);
    const hexs = `#${col.toString(16).padStart(6, '0')}`;
    const style = rng.chance(0.55) ? 'tube' : 'box';
    ctx.signs.place({
      at: c.clone().addScaledVector(n, 0.45).setY(y + 3.75), normal: n.clone(), size: Math.min(0.72, (w - 0.5) / (chars(word).length + 0.62)),
      spec: style === 'tube' ? { text: word, color: hexs, vertical: false, style: 'tube' } : { text: word, color: hexs, vertical: false, style: 'box' },
      flicker: rng.chance(0.1) ? rng.range(0.1, 1) : 0,
    }, k);
    x += w;
  }
}
