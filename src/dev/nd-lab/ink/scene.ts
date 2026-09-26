// Lab P1 "ink" (E169): a small street canyon to test the 界画 surface on — eight tower blocks with storey lips,
// balconies, air-con boxes, cage grilles and pipes, window grids with mullions, a carved stone balustrade over a
// fogged drop (the Well side), a flagstone street, a stair and a paifang silhouette. Every surface is kit quads, merged
// into one geometry: one program, one draw call for the whole city.
import { Vector3 } from 'three';
import { E, K, Kit, type Look } from './kit';

/** mulberry32 */
class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(arr: readonly T[]): T {
    const v = arr[Math.floor(this.next() * arr.length)];
    if (v === undefined) throw new Error('pick on empty');
    return v;
  }
}

/** pale cool concrete washes (round-4 A), a couple of warmer greys */
const WALL = [0x8f8c87, 0x86847f, 0x9a958d, 0x807f7c, 0x938b80, 0x878b90, 0x9c9891, 0x7d7b78, 0x8c8780] as const;
const STONE = 0xb0a591;
const STONE_DARK = 0x958c7c;
const CINNABAR = 0xb0301f;
const AZURITE = 0x2e5fa3;
const MALACHITE = 0x2f8a6a;
const GROUND = 0x857b6e;
const ROW = 3.2;

export interface Canyon { kit: Kit; groundY: number }

interface Tower { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number; seed: number; lips: boolean; near: boolean }

function tower(k: Kit, r: Rng, t: Tower): void {
  const w = t.x1 - t.x0, d = t.z1 - t.z0, h = t.y1 - t.y0;
  const wash = r.pick(WALL);
  const col = r.pick([2.4, 2.6, 2.8, 3.0]);
  const facade: Look = { wash, kind: K.facade, row: ROW, col, seed: t.seed };
  const roof: Look = { wash, kind: K.plain };
  k.box((t.x0 + t.x1) / 2, t.y0, (t.z0 + t.z1) / 2, w, h, d, facade, { top: roof, bottom: null });
  // parapet + a rooftop shed
  k.box((t.x0 + t.x1) / 2, t.y1, (t.z0 + t.z1) / 2, w + 0.3, 1.1, d + 0.3, { wash, kind: K.plain }, { bottom: null, walk: true });
  if (r.chance(0.6)) k.box(t.x0 + w * r.range(0.2, 0.6), t.y1 + 1.1, t.z0 + d * r.range(0.2, 0.6), 4, 3, 3.5, { wash: 0x98a0aa, kind: K.plain });
  // storey lips: a real slab edge every storey (or every other) all round — shelf silhouettes and a shaded soffit
  const every = t.lips ? 1 : 3;
  const nStoreys = Math.floor(h / ROW);
  for (let s = 1; s < nStoreys; s += every) {
    const y = t.y0 + s * ROW - 0.12;
    const o = 0.32;
    k.box((t.x0 + t.x1) / 2, y, (t.z0 + t.z1) / 2, w + 2 * o, 0.24, d + 2 * o, { wash, kind: K.plain }, { walk: false });
  }
  // balconies, air-con boxes, cage grilles, drain pipes on the faces that look at the street (±x faces)
  const faces: { nx: number; x: number }[] = [{ nx: -1, x: t.x0 }, { nx: 1, x: t.x1 }];
  const nCols = Math.floor(d / col);
  for (const f of faces) {
    for (let s = 0; s < nStoreys; s++) {
      const yb = t.y0 + s * ROW;
      if (yb < t.y0 + 3) continue;
      for (let cI = 0; cI < nCols; cI++) {
        const zc = t.z0 + (cI + 0.5) * col;
        const roll = r.next();
        const near = t.near && yb < 60;
        if (roll < 0.11 && near) {
          // a balcony: slab, a railing panel with ruled balusters, two cheeks
          const depth = 1.1, bw = col * 0.9;
          const xs = f.x + f.nx * depth / 2;
          k.box(xs, yb - 0.02, zc, depth, 0.16, bw, { wash, kind: K.plain }, { walk: true });
          k.box(f.x + f.nx * (depth - 0.04), yb + 0.14, zc, 0.08, 1.0, bw, { wash, kind: K.bars, col: 0.16, row: 1 }, { bottom: null });
          k.box(xs, yb + 0.14, zc - bw / 2 + 0.04, depth, 1.0, 0.08, { wash, kind: K.plain }, { bottom: null });
          k.box(xs, yb + 0.14, zc + bw / 2 - 0.04, depth, 1.0, 0.08, { wash, kind: K.plain }, { bottom: null });
          // laundry pole
          if (r.chance(0.5)) k.beam(new Vector3(f.x + f.nx * depth, yb + 2.0, zc - bw / 2), new Vector3(f.x + f.nx * depth, yb + 2.0, zc + bw / 2), 0.04, 0.04, { wash: 0x3a3d44 });
        } else if (roll < 0.26 && near) {
          // air-con box under the window, grille drawn as a carved panel
          const ax = f.x + f.nx * 0.28;
          k.box(ax, yb + 0.35, zc + col * 0.18, 0.55, 0.55, 0.8, { wash: 0xb4b8bd, kind: K.panel }, {});
        } else if (roll < 0.33 && near) {
          // a cage grille (铁笼) over the window
          k.box(f.x + f.nx * 0.3, yb + 0.6, zc, 0.6, ROW * 0.6, col * 0.8, { wash: 0x6a707a, kind: K.bars, col: 0.14, row: 1 }, { bottom: null });
        }
      }
    }
    // drain pipes
    if (t.near) {
      for (let p = 0; p < 2; p++) {
        const zp = t.z0 + d * r.range(0.1, 0.9);
        k.beam(new Vector3(f.x + f.nx * 0.18, t.y0, zp), new Vector3(f.x + f.nx * 0.18, Math.min(t.y1, t.y0 + 60), zp), 0.14, 0.14, { wash: 0x7d848f });
      }
    }
  }
}

function balustrade(k: Kit, x: number, z0: number, z1: number): void {
  const stone: Look = { wash: STONE, kind: K.stone };
  const bay = 2.3;
  // the curb you stand on (ground line on its lip)
  k.box(x, 0, (z0 + z1) / 2, 0.7, 0.28, z1 - z0, stone, { walk: true });
  for (let z = z0; z <= z1 + 1e-3; z += bay) {
    k.box(x, 0.28, z, 0.34, 1.05, 0.34, stone);
    // a lotus-bud cap: two stacked boxes, smaller up
    k.box(x, 1.33, z, 0.4, 0.1, 0.4, stone);
    k.box(x, 1.43, z, 0.26, 0.22, 0.26, { wash: STONE_DARK, kind: K.stone });
    if (z + bay <= z1 + 1e-3) {
      const zc = z + bay / 2;
      // carved panel + the top rail
      k.box(x, 0.36, zc, 0.12, 0.62, bay - 0.34, { wash: STONE, kind: K.panel });
      k.box(x, 0.98, zc, 0.2, 0.2, bay - 0.34, stone);
      // little posts between panel and rail
      k.box(x, 0.28, zc, 0.22, 0.08, bay - 0.34, stone);
    }
  }
}

function paifang(k: Kit, z: number, x0: number, x1: number): void {
  const red: Look = { wash: CINNABAR, kind: K.plain, accent: true };
  const beam: Look = { wash: 0x7e1e1a, kind: K.panel, accent: true };
  const span = x1 - x0;
  const posts = [x0, x0 + span * 0.3, x1 - span * 0.3, x1];
  posts.forEach((px, i) => {
    const tall = i === 1 || i === 2;
    k.box(px, 0, z, 0.9, 1.0, 1.4, { wash: STONE, kind: K.stone }, { walk: true });
    k.box(px, 1.0, z, 0.6, tall ? 8.5 : 6.2, 0.6, red);
  });
  // lintels and the name board
  k.box((x0 + x1) / 2, 7.2, z, span * 0.42, 0.7, 0.55, beam);
  k.box((x0 + x1) / 2, 8.1, z, span * 0.44, 0.45, 0.6, red);
  k.box((x0 + x0 + span * 0.3) / 2, 5.4, z, span * 0.34, 0.55, 0.5, beam);
  k.box((x1 + x1 - span * 0.3) / 2, 5.4, z, span * 0.34, 0.55, 0.5, beam);
  k.box((x0 + x1) / 2, 6.0, z + 0.05, 2.6, 1.1, 0.62, { wash: 0x1d2b4a, kind: K.panel, accent: true });
  // three hip roofs: azurite tiles, upturned by a raised ridge
  const roof = (cx: number, y: number, w: number, dep: number, ht: number): void => {
    const tiles: Look = { wash: AZURITE, kind: K.tiles, accent: true };
    const hw = w / 2, hd = dep / 2;
    const a = new Vector3(cx - hw, y, z + hd), b = new Vector3(cx + hw, y, z + hd);
    const cR = new Vector3(cx + hw * 0.8, y + ht, z), dR = new Vector3(cx - hw * 0.8, y + ht, z);
    const slope = Math.hypot(hd, ht);
    k.quad4(a, b, cR, dR, w, slope, tiles);
    const a2 = new Vector3(cx + hw, y, z - hd), b2 = new Vector3(cx - hw, y, z - hd);
    k.quad4(a2, b2, dR.clone(), cR.clone(), w, slope, tiles);
    k.tri(new Vector3(cx - hw, y, z - hd), new Vector3(cx - hw, y, z + hd), dR.clone(), tiles);
    k.tri(new Vector3(cx + hw, y, z + hd), new Vector3(cx + hw, y, z - hd), cR.clone(), tiles);
    k.beam(dR.clone().add(new Vector3(-0.3, 0.05, 0)), cR.clone().add(new Vector3(0.3, 0.05, 0)), 0.22, 0.22, { wash: MALACHITE, accent: true });
    // the eave board
    k.box(cx, y - 0.25, z, w * 0.96, 0.25, dep * 0.9, { wash: MALACHITE, kind: K.plain, accent: true });
  };
  roof((x0 + x1) / 2, 8.55, span * 0.5, 2.6, 1.3);
  roof((x0 + x0 + span * 0.3) / 2, 5.95, span * 0.36, 2.2, 1.0);
  roof((x1 + x1 - span * 0.3) / 2, 5.95, span * 0.36, 2.2, 1.0);
}

function stair(k: Kit, x0: number, x1: number, z0: number, steps: number): void {
  const rise = 0.18, tread = 0.36;
  const w = x1 - x0;
  for (let i = 0; i < steps; i++) {
    k.box((x0 + x1) / 2, 0, z0 - i * tread - tread / 2, w, rise * (i + 1), tread, { wash: GROUND, kind: K.plain }, { walk: true, bottom: null });
  }
  const topZ = z0 - steps * tread;
  const topY = steps * rise;
  // landing and the cheek walls
  k.box((x0 + x1) / 2, 0, topZ - 6, w, topY, 12, { wash: GROUND, kind: K.flag, wet: 0.6 }, { walk: true, bottom: null });
  k.box(x0 - 0.2, 0, z0 - (steps * tread) / 2 - 3, 0.4, topY + 1.0, steps * tread + 6, { wash: STONE, kind: K.stone }, { walk: true });
  k.box(x1 + 0.2, 0, z0 - (steps * tread) / 2 - 3, 0.4, topY + 1.0, steps * tread + 6, { wash: STONE, kind: K.stone }, { walk: true });
}

export function buildCanyon(): Canyon {
  const k = new Kit();
  const r = new Rng(4242);
  // the street: flagstones, x ∈ [-6.4, 7], a curb along the right-hand shopfronts
  k.quad(new Vector3(-6.4, 0, 6), new Vector3(1, 0, 0), new Vector3(0, 0, -1), 13.4, 82, { wash: GROUND, kind: K.flag, wet: 0.8, line: 0 }, E.none);
  k.box(6.6, 0, -30, 0.8, 0.16, 72, { wash: STONE, kind: K.stone }, { walk: true });
  // the Well side: the street slab's edge drops away under the balustrade
  k.box(-7.2, -3.5, -34, 1.6, 3.5, 82, { wash: STONE_DARK, kind: K.stone }, { top: null });
  balustrade(k, -6.1, -38, 5);
  // right-hand towers, flush on the street; shopfront awnings on their feet
  const right: Tower[] = [
    { x0: 7, x1: 22, z0: -16, z1: 6, y0: 0, y1: 96, seed: 1, lips: true, near: true },
    { x0: 7.5, x1: 20, z0: -34, z1: -19, y0: 0, y1: 118, seed: 2, lips: false, near: true },
    { x0: 7, x1: 24, z0: -58, z1: -37, y0: 0, y1: 84, seed: 3, lips: true, near: true },
  ];
  // across the drop: towers that stand in the fog bands, their feet 90 m below
  const left: Tower[] = [
    { x0: -40, x1: -22, z0: -14, z1: 4, y0: -90, y1: 88, seed: 4, lips: true, near: true },
    { x0: -44, x1: -26, z0: -46, z1: -24, y0: -90, y1: 104, seed: 5, lips: false, near: true },
    { x0: -38, x1: -21, z0: -80, z1: -58, y0: -90, y1: 72, seed: 6, lips: true, near: false },
  ];
  // the far end of the street, beyond the stair; two more deep in the silk
  const far: Tower[] = [
    { x0: -8, x1: 10, z0: -112, z1: -92, y0: 0, y1: 110, seed: 7, lips: true, near: false },
    { x0: 14, x1: 30, z0: -100, z1: -70, y0: 0, y1: 70, seed: 8, lips: false, near: false },
    { x0: -30, x1: -12, z0: -150, z1: -128, y0: -90, y1: 130, seed: 9, lips: false, near: false },
    { x0: 4, x1: 26, z0: -190, z1: -165, y0: 0, y1: 150, seed: 10, lips: false, near: false },
  ];
  for (const t of [...right, ...left, ...far]) tower(k, r, t);
  // shopfront awnings and the ground-floor band on the right
  for (const t of right) {
    k.box(t.x0 - 1.2, 3.1, (t.z0 + t.z1) / 2, 2.4, 0.18, t.z1 - t.z0 - 1, { wash: 0x6f7784, kind: K.plain }, { walk: false });
    k.box(t.x0 - 0.05, 0, (t.z0 + t.z1) / 2, 0.1, 3.1, t.z1 - t.z0 - 2, { wash: 0x505a68, kind: K.facade, row: 3.1, col: 2.2, seed: t.seed + 20 }, { bottom: null });
  }
  // a sky bridge across the street at +22 m, and one across the drop
  k.box(0.3, 22, -44, 13.4, 2.4, 4, { wash: 0x9a9894, kind: K.plain }, {});
  k.box(0.3, 24.4, -44, 13.4, 1.1, 0.1, { wash: 0x9a9894, kind: K.bars, col: 0.2, row: 1 }, { bottom: null });
  k.box(-14.5, 14, -33, 17, 1.8, 3.2, { wash: 0x9a9894, kind: K.plain }, {});
  // the gate across the street, the stair at the end
  paifang(k, -40, -5, 6);
  stair(k, -4, 6, -60, 16);
  return { kit: k, groundY: 0 };
}
