// Copied from the facade lab (src/dev/nd-lab/facade/pieces.ts, round-7-lab-facade) into the clean room.
// The facade kit: every piece that covers a Kowloon wall, built once at the origin in the wall's frame (x along the
// wall, y up, +z out of the wall, origin on the wall face) and then drawn as ONE InstancedMesh per piece for a whole
// street (the grammar scales them non-uniformly; the program keeps their ruling in metres). Railings and grilles are
// real bars (thin boxes), never cut-out cards (Jake: no cardboard in the playable space).
import { IcosahedronGeometry, Matrix4, Vector3 } from 'three';
import { Builder, E, K, type Look, X, Y, Z } from './geo';


/** the style bible's washes for the kit (sRGB hex) */
export const PAL = {
  slab: 0xa9abab, slabDark: 0x8f9294, rail: 0x23252b, metal: 0x3a3d44, ac: 0xd2d1c9, acDark: 0xa9aaa4, pipe: 0x7c8187,
  rust: 0x8a6650, tankBlue: 0x6f8fb5, tankGrey: 0x9aa0a6, shack: 0xaaa59b, timber: 0x6e5238, malachite: 0x2f8a6a,
  azurite: 0x2e5fa3, cinnabar: 0xc23b22, pot: 0xa4532e, leaf: 0x3f7e4e, leafLight: 0x5b9a5e, leafDark: 0x2e6443,
  clamshell: 0xf2eee4, ink: 0x2a2c31,
} as const;

const NX = X.clone().negate();
const ico0 = (() => {
  const g = new IcosahedronGeometry(1, 0);
  return Array.from(g.getAttribute('position').array);
})();

/** a row of real bars (flat bars, 4 tris each — never a cut-out card): from `p0` along `dir` for `len`, `h` tall,
 *  every `pitch`, facing `n` */
function barRow(o: Builder, p0: Vector3, dir: Vector3, len: number, h: number, pitch: number, look: Look, t = 0.024): void {
  const count = Math.max(1, Math.round(len / pitch));
  const n = new Vector3().crossVectors(dir, Y).normalize().negate();
  for (let i = 1; i < count; i++) {
    const b = p0.clone().addScaledVector(dir, (i / count) * len);
    o.flatBar(b, b.clone().add(new Vector3(0, h, 0)), t, n, look);
  }
}

/** a balcony: 3.6 m wide (the grammar scales it ±15 % to its bay), 1.1 m deep: slab + fascia, a real barred railing
 *  on three sides with a top rail and a mid rail */
export const BALCONY_W = 3.6;
function balcony(): Builder {
  const o = new Builder();
  const W = BALCONY_W, hw = W / 2, D = 1.1;
  o.box(0, -0.18, D / 2, W, 0.18, D, { wash: PAL.slab, line: 1.6 }, { bottom: { wash: PAL.slabDark, line: 1 } });
  o.box(0, -0.3, D - 0.03, W, 0.12, 0.06, { wash: PAL.slabDark, line: 1 });
  const rl: Look = { wash: PAL.rail, line: 0.7 };
  // a top rail (a real beam), a flat mid rail, corner posts, flat bars
  o.beam(new Vector3(-hw + 0.03, 1.0, D - 0.04), new Vector3(hw - 0.03, 1.0, D - 0.04), 0.05, 0.05, rl);
  o.beam(new Vector3(-hw + 0.03, 1.0, 0), new Vector3(-hw + 0.03, 1.0, D - 0.04), 0.05, 0.05, rl);
  o.beam(new Vector3(hw - 0.03, 1.0, 0), new Vector3(hw - 0.03, 1.0, D - 0.04), 0.05, 0.05, rl);
  o.flatBar(new Vector3(-hw + 0.03, 0.14, D - 0.04), new Vector3(hw - 0.03, 0.14, D - 0.04), 0.04, Y, rl);
  for (const x of [-hw + 0.03, hw - 0.03]) o.beam(new Vector3(x, 0, D - 0.04), new Vector3(x, 1.02, D - 0.04), 0.05, 0.05, rl);
  barRow(o, new Vector3(-hw + 0.03, 0.14, D - 0.04), X, W - 0.06, 0.86, 0.16, rl);
  barRow(o, new Vector3(-hw + 0.03, 0.14, 0), Z, D - 0.04, 0.86, 0.16, rl);
  barRow(o, new Vector3(hw - 0.03, 0.14, 0), Z, D - 0.04, 0.86, 0.16, rl);
  return o;
}

/** a timber veranda balcony (the Well's galleries in miniature): a lacquered top rail, turned balusters, a skirt */
function balconyTimber(): Builder {
  const o = new Builder();
  const W = BALCONY_W, hw = W / 2, D = 1.2;
  const tb: Look = { wash: PAL.timber, line: 0.8 };
  o.box(0, -0.2, D / 2, W, 0.2, D, { wash: 0x8a8580, line: 1.6 }, { bottom: { wash: 0x5e5048, kind: K.slats, p1: 0.3, line: 1 } });
  o.box(0, -0.42, D - 0.04, W, 0.22, 0.08, { wash: PAL.cinnabar, kind: K.panel, line: 1 });
  o.box(0, 0.98, D - 0.05, W + 0.04, 0.08, 0.1, tb);
  o.box(-hw + 0.04, 0.98, D / 2, 0.1, 0.08, D, tb);
  o.box(hw - 0.04, 0.98, D / 2, 0.1, 0.08, D, tb);
  o.box(0, 0.08, D - 0.05, W, 0.06, 0.08, tb);
  for (const x of [-hw + 0.04, hw - 0.04]) o.box(x, 0, D - 0.05, 0.1, 1.06, 0.1, tb);
  barRow(o, new Vector3(-hw, 0.14, D - 0.05), X, W, 0.84, 0.18, tb, 0.05);
  barRow(o, new Vector3(-hw + 0.04, 0.14, 0), Z, D - 0.05, 0.84, 0.18, tb, 0.05);
  barRow(o, new Vector3(hw - 0.04, 0.14, 0), Z, D - 0.05, 0.84, 0.18, tb, 0.05);
  return o;
}

/** a balcony with a solid parapet (carved panels) instead of a railing */
function balconySolid(): Builder {
  const o = new Builder();
  const W = BALCONY_W, hw = W / 2, D = 1.1;
  const pw: Look = { wash: 0xb3b2ac, kind: K.panel, line: 1 };
  o.box(0, -0.18, D / 2, W, 0.18, D, { wash: PAL.slab, line: 1.6 }, { bottom: { wash: PAL.slabDark, line: 1 } });
  for (let i = 0; i < 3; i++) o.box(-hw + W / 6 + (i * W) / 3, 0, D - 0.05, W / 3, 0.92, 0.1, pw, { sides: 4 | 8, top: null, bottom: null });
  o.box(-hw + 0.05, 0, D / 2, 0.1, 0.92, D - 0.1, { wash: 0xb3b2ac, line: 1 }, { top: null, bottom: null });
  o.box(hw - 0.05, 0, D / 2, 0.1, 0.92, D - 0.1, { wash: 0xb3b2ac, line: 1 }, { top: null, bottom: null });
  o.box(0, 0.92, D / 2, W + 0.04, 0.08, D + 0.04, { wash: PAL.slab, line: 1.2 });
  return o;
}

/** a window cage (security grille) around a window `w` wide: 1.75 m tall, 0.5 m deep, real bars in a grid, a tray
 *  and a lid, the junk kept inside */
export const CAGE_W = [1.5, 2.7] as const;
function cageOf(W: number): () => Builder {
  return () => {
    const o = new Builder();
    const hw = W / 2, D = 0.5, H = 1.75;
    const m: Look = { wash: PAL.metal, line: 0.7 };
    o.box(0, 0, D / 2, W, 0.06, D + 0.02, { wash: PAL.metal, line: 1 });
    o.box(0, H - 0.05, D / 2 + 0.01, W + 0.04, 0.05, D + 0.06, { wash: PAL.metal, line: 1 });
    for (const x of [-hw, hw]) o.beam(new Vector3(x, 0.06, D), new Vector3(x, H - 0.05, D), 0.035, 0.035, m);
    barRow(o, new Vector3(-hw, 0.06, D), X, W, H - 0.11, 0.12, m, 0.018);
    barRow(o, new Vector3(-hw, 0.06, 0), Z, D, H - 0.11, 0.12, m, 0.018);
    barRow(o, new Vector3(hw, 0.06, 0), Z, D, H - 0.11, 0.12, m, 0.018);
    for (const y of [0.45, 0.9, 1.35]) {
      o.flatBar(new Vector3(-hw, y, D), new Vector3(hw, y, D), 0.02, Y, m);
      o.flatBar(new Vector3(-hw, y, 0), new Vector3(-hw, y, D), 0.02, Y, m);
      o.flatBar(new Vector3(hw, y, 0), new Vector3(hw, y, D), 0.02, Y, m);
    }
    o.box(-hw * 0.45, 0.06, 0.26, 0.3, 0.26, 0.3, { wash: 0x8a6a3a, line: 0.8 }, { bottom: null });
    return o;
  };
}

/** a split AC condenser on two brackets: 0.86 × 0.56 × 0.32 */
function acUnit(): Builder {
  const o = new Builder();
  const body: Look = { wash: PAL.ac, line: 1 };
  o.boxAxes(new Vector3(0, 0.28, 0.2), X, Y, Z, 0.43, 0.28, 0.16, body, { sides: 1 | 2 | 8 });
  o.quad(new Vector3(-0.43, 0, 0.36), X, Y, 0.86, 0.56, { wash: PAL.ac, kind: K.ac, line: 1 });
  for (const x of [-0.3, 0.3]) {
    o.beam(new Vector3(x, -0.02, 0), new Vector3(x, -0.02, 0.4), 0.04, 0.04, { wash: PAL.metal, line: 0.6 });
    o.beam(new Vector3(x, -0.3, 0), new Vector3(x, -0.02, 0.36), 0.03, 0.03, { wash: PAL.metal, line: 0.5 });
  }
  return o;
}

/** a window-box AC poking through the wall: 0.62 × 0.42 × 0.5 */
function acBox(): Builder {
  const o = new Builder();
  o.boxAxes(new Vector3(0, 0.21, 0.24), X, Y, Z, 0.31, 0.21, 0.24, { wash: PAL.acDark, line: 1 }, { sides: 1 | 2 | 8 });
  o.quad(new Vector3(-0.31, 0, 0.48), X, Y, 0.62, 0.42, { wash: PAL.acDark, kind: K.slats, p1: 0.05, line: 1 });
  return o;
}

/** a unit length of drain pipe (scaled in y to the run), 0.14 m from the wall; brackets ruled every 1.5 m */
function pipe(): Builder {
  const o = new Builder();
  o.cyl(0, 0, 0.13, 0.075, 0.075, 1, 6, { wash: PAL.pipe, kind: K.pipe, p1: 1.5, line: 0.9 }, { caps: false, edges: E.sides });
  return o;
}

/** clothes along +x from the origin (a line or a pole), pegged at y = 0; both faces so they read from both sides */
function garments(o: Builder, x0: number, x1: number, z: number, seed: number): void {
  const cols = [0xeceae2, 0x4f78b5, 0xb8402a, 0xd9a441, 0x2f3a52, 0xe0d8c4, 0x5f9a72, 0x5a5f6a, 0xc8506a, 0x3f6f9a, 0xe8c070] as const;
  let x = x0 + 0.08, i = seed;
  while (x < x1 - 0.3) {
    const kind = i % 4;
    const c = cols[(i * 5 + 3) % cols.length] ?? 0xeceae2;
    const look: Look = { wash: c, kind: K.cloth, p1: kind === 3 && i % 3 === 0 ? 0.12 : 0, p2: 0.7, line: 0.8 };
    const put = (px: number, py: number, w: number, h: number): void => {
      o.quad(new Vector3(px, py - h, z + 0.004), X, Y, w, h, look);
      o.quad(new Vector3(px + w, py - h, z - 0.004), NX, Y, w, h, look);
    };
    let w: number;
    if (kind === 0) {
      // a shirt: body + two sleeves
      w = 0.46;
      put(x + 0.08, 0, 0.3, 0.62);
      put(x, 0, 0.1, 0.28);
      put(x + 0.38, 0, 0.1, 0.28);
    } else if (kind === 1) {
      // trousers: two legs + a waistband
      w = 0.36;
      put(x, 0, 0.36, 0.14);
      put(x, -0.14, 0.16, 0.74);
      put(x + 0.2, -0.14, 0.16, 0.74);
    } else if (kind === 2) {
      w = 0.34;
      put(x, 0, 0.34, 0.48);
    } else {
      w = 0.55;
      put(x, 0, 0.55, 0.7);
    }
    x += w + 0.07;
    i += 3;
  }
}

/** a bamboo pole straight out from the wall (1.7 m) with the wash hung under it: seen edge-on from the street */
function laundryOut(): Builder {
  const o = new Builder();
  o.beam(new Vector3(0, 0, 0), new Vector3(0, 0.08, 1.8), 0.04, 0.04, { wash: 0x8a7a55, line: 0.7 });
  // clothes along z: build along x then rotate by emitting in a sub-builder
  const g = new Builder();
  garments(g, 0.1, 1.75, 0, 3);
  o.append(g, new Matrix4().makeRotationY(-Math.PI / 2));
  return o;
}

/** a pole parallel to the wall on two brackets, 0.9 m out (1 m long, scaled), clothes hung face-on */
function laundryAlong(): Builder {
  const o = new Builder();
  o.beam(new Vector3(-0.5, 0, 0.9), new Vector3(0.5, 0, 0.9), 0.04, 0.04, { wash: 0x8a7a55, line: 0.7 });
  for (const x of [-0.45, 0.45]) o.beam(new Vector3(x, 0, 0), new Vector3(x, 0, 0.92), 0.035, 0.035, { wash: PAL.metal, line: 0.6 });
  const g = new Builder();
  garments(g, -0.5, 0.5, 0.9, 1);
  o.append(g, new Matrix4());
  return o;
}

/** the wash alone (1 m of it), pegged at y = 0 on a line strung across a street */
function washLine(): Builder {
  const o = new Builder();
  garments(o, -0.5, 0.5, 0, 5);
  return o;
}

/** a striped cloth awning: 1 m wide, sloping 0.8 m out and 0.42 m down, a valance; the instance colour dyes it */
function awning(): Builder {
  const o = new Builder();
  const cloth: Look = { wash: 0xf4f4f0, kind: K.cloth, p1: 0.24, p2: 0.85, line: 1 };
  const a0 = new Vector3(-0.5, 0, 0), a1 = new Vector3(0.5, 0, 0), b1 = new Vector3(0.5, -0.42, 0.8), b0 = new Vector3(-0.5, -0.42, 0.8);
  o.quad4(b0, b1, a1, a0, 1, 0.9, cloth);
  o.quad4(a0, a1, b1, b0, 1, 0.9, cloth);
  o.quad(new Vector3(-0.5, -0.62, 0.8), X, Y, 1, 0.2, cloth);
  o.quad(new Vector3(0.5, -0.62, 0.8), NX, Y, 1, 0.2, cloth);
  return o;
}

/** a potted plant (terracotta pot + two leaf masses), on a sill or a balcony: ~50 tris */
function plant(): Builder {
  const o = new Builder();
  o.cyl(0, 0, 0.18, 0.13, 0.17, 0.26, 5, { wash: PAL.pot, line: 1 }, { caps: false });
  o.blob(ico0, 0, 0.44, 0.18, 0.27, 0.26, 0.25, { wash: PAL.leaf, kind: K.leaf, line: 0 });
  o.blob(ico0, 0.12, 0.62, 0.2, 0.18, 0.2, 0.17, { wash: PAL.leafLight, kind: K.leaf, line: 0 });
  return o;
}

/** a long planter trough along a ledge (1 m, scaled) with a row of leaf masses spilling over */
function planter(): Builder {
  const o = new Builder();
  o.box(0, 0, 0.22, 1, 0.28, 0.36, { wash: 0x8d8a82, kind: K.panel, line: 1 });
  for (let i = 0; i < 4; i++) {
    const x = -0.38 + i * 0.25;
    o.blob(ico0, x, 0.36 + (i % 2) * 0.08, 0.24, 0.2, 0.22 + (i % 3) * 0.05, 0.2, { wash: i % 2 === 0 ? PAL.leaf : PAL.leafLight, kind: K.leaf, line: 0 });
  }
  o.blob(ico0, 0.1, 0.12, 0.44, 0.16, 0.26, 0.1, { wash: PAL.leafDark, kind: K.leaf, line: 0 });
  return o;
}

/** a lit sign box on a bracket arm, standing out from the wall (the instance colour is its glow) */
function signBox(): Builder {
  const o = new Builder();
  o.boxAxes(new Vector3(0, 0.6, 0.62), Z, Y, NX, 0.34, 0.6, 0.08, { wash: 0xffffff, kind: K.sign, emit: 1.6, line: 1.1 });
  o.beam(new Vector3(0, 1.28, 0), new Vector3(0, 1.28, 0.98), 0.05, 0.05, { wash: PAL.ink, line: 0.6 });
  o.beam(new Vector3(0, -0.06, 0), new Vector3(0, -0.06, 0.62), 0.04, 0.04, { wash: PAL.ink, line: 0.6 });
  return o;
}

/** a flat sign board on the wall (a shop's fascia board), lit */
function signFlat(): Builder {
  const o = new Builder();
  o.box(0, 0, 0.06, 1, 1, 0.12, { wash: 0xffffff, kind: K.sign, emit: 1.3, line: 1.1 });
  return o;
}

/** a red paper lantern (emissive) with gold caps and a tassel, hung from y = 0 */
function lantern(): Builder {
  const o = new Builder();
  const red: Look = { wash: 0xff4a32, emit: 1.5, line: 0.6 };
  o.cyl(0, -0.62, 0, 0.2, 0.26, 0.2, 8, red, { caps: false, edges: E.none });
  o.cyl(0, -0.42, 0, 0.26, 0.2, 0.2, 8, red, { caps: false, edges: E.none });
  o.cyl(0, -0.68, 0, 0.12, 0.12, 0.06, 6, { wash: 0xc9a24a, line: 0.6 });
  o.cyl(0, -0.22, 0, 0.12, 0.12, 0.06, 6, { wash: 0xc9a24a, line: 0.6 });
  o.beam(new Vector3(0, -0.16, 0), new Vector3(0, 0, 0), 0.015, 0.015, { wash: PAL.ink, line: 0.4 });
  o.beam(new Vector3(0, -0.9, 0), new Vector3(0, -0.68, 0), 0.03, 0.03, { wash: PAL.cinnabar, line: 0.4 });
  return o;
}

/** a red paper couplet (春聯) strip beside a door: 0.3 × 1.3 */
function couplet(): Builder {
  const o = new Builder();
  o.box(0, 0, 0.01, 0.3, 1.3, 0.02, { wash: PAL.cinnabar, kind: K.panel, line: 0.8 }, { bottom: null, top: null });
  return o;
}

/** a rooftop water tank on a steel stand */
function tank(): Builder {
  const o = new Builder();
  for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]] as const) o.box(dx, 0, dz, 0.09, 1.0, 0.09, { wash: PAL.metal, line: 0.8 });
  o.beam(new Vector3(-0.6, 0.5, 0.6), new Vector3(0.6, 0.9, 0.6), 0.04, 0.04, { wash: PAL.metal, line: 0.5 });
  o.box(0, 1.0, 0, 1.55, 0.1, 1.55, { wash: PAL.metal, line: 1 });
  o.cyl(0, 1.1, 0, 0.8, 0.8, 1.6, 10, { wash: 0xffffff, line: 1 });
  o.cyl(0, 2.7, 0, 0.8, 0.18, 0.28, 10, { wash: 0xe6e6e6, line: 1 });
  return o;
}

/** a glazed hip roof (tile courses in `tile`, cinnabar ridges), w × d at y, rising `rise` */
function hipRoof(o: Builder, y: number, w: number, d: number, rise: number, over: number, tile: number): void {
  const hw = w / 2 + over, hd = d / 2 + over;
  const ridge = Math.max(0.2, hw - hd);
  const tl: Look = { wash: tile, kind: K.tiles, line: 1 };
  const e0 = new Vector3(-hw, y, hd), e1 = new Vector3(hw, y, hd), e2 = new Vector3(hw, y, -hd), e3 = new Vector3(-hw, y, -hd);
  const r0 = new Vector3(-ridge, y + rise, 0), r1 = new Vector3(ridge, y + rise, 0);
  const slope = Math.hypot(hd, rise);
  o.quad4(e0, e1, r1, r0, 2 * hw, slope, tl, E.v0);
  o.quad4(e2, e3, r0, r1, 2 * hw, slope, tl, E.v0);
  o.tri(e1, e2, r1, tl);
  o.tri(e3, e0, r0, tl);
  // the ridge and hip beams in cinnabar, the eave fascia in ink
  const tr: Look = { wash: PAL.cinnabar, line: 0.9 };
  o.beam(r0, r1, 0.12, 0.12, tr);
  for (const [e, r] of [[e0, r0], [e1, r1], [e2, r1], [e3, r0]] as const) o.beam(e, r, 0.08, 0.08, tr);
  o.beam(r0.clone().add(new Vector3(0, 0.05, 0)), r0.clone().add(new Vector3(-0.2, 0.35, 0)), 0.1, 0.1, tr);
  o.beam(r1.clone().add(new Vector3(0, 0.05, 0)), r1.clone().add(new Vector3(0.2, 0.35, 0)), 0.1, 0.1, tr);
  const fas: Look = { wash: 0x3b3a36, line: 0.9 };
  o.beam(e0, e1, 0.06, 0.1, fas);
  o.beam(e2, e3, 0.06, 0.1, fas);
}

/** a rooftop shack: tin / board walls, a door, a lit window, a glazed hip roof (malachite; the instance tint may
 *  swap it toward azurite via a second variant) */
function shackOf(tile: number): () => Builder {
  return () => {
    const o = new Builder();
    o.box(0, 0, 0, 3.2, 2.4, 2.6, { wash: PAL.shack, kind: K.slats, p1: 0.3, line: 1 });
    o.box(0.7, 1.0, 1.31, 1.0, 0.8, 0.02, { wash: 0xffc27a, kind: K.sign, emit: 0.9, line: 1 });
    o.box(-0.8, 0, 1.31, 0.8, 1.9, 0.02, { wash: PAL.timber, kind: K.panel, line: 1 });
    o.box(0, 2.4, 0, 3.4, 0.14, 2.8, { wash: PAL.cinnabar, line: 1 });
    hipRoof(o, 2.54, 3.2, 2.6, 1.2, 0.45, tile);
    return o;
  };
}

/** an enclosed bay / bay window box: 1 m wide (scaled), 1 m tall (scaled), 0.6 deep; the grammar puts glass on it */
function bayBox(): Builder {
  const o = new Builder();
  const w: Look = { wash: 0xffffff, line: 1 };
  o.boxAxes(new Vector3(0, 0.5, 0.3), X, Y, Z, 0.5, 0.5, 0.3, w, { sides: 1 | 2 | 4, top: { wash: 0x9fa19f, line: 1.4 }, bottom: { wash: PAL.slabDark, line: 1 } });
  return o;
}

/** a thin ledge (window hood / sill / canopy): 1 m (scaled x), 0.1 thick, 0.35 deep */
function ledge(): Builder {
  const o = new Builder();
  o.box(0, 0, 0.18, 1, 0.1, 0.36, { wash: PAL.slab, line: 1.1 }, { bottom: { wash: PAL.slabDark, line: 1 } });
  return o;
}

/** a pent eave strip (腰檐) along a wall: 1 m (scaled x), glazed tiles sloping 1.2 m out, a cinnabar beam + brackets */
function eave(): Builder {
  const o = new Builder();
  const tl: Look = { wash: 0xffffff, kind: K.tiles, line: 1 };
  const a = new Vector3(-0.5, 0, 0), b = new Vector3(0.5, 0, 0), c2 = new Vector3(0.5, -0.55, 1.25), d = new Vector3(-0.5, -0.55, 1.25);
  o.quad4(d, c2, b, a, 1, 1.37, tl, E.u0 | E.u1 | E.v0);
  o.quad4(a, b, c2, d, 1, 1.37, { wash: 0x5b4a3a, kind: K.slats, p1: 0.22, line: 0.8 });
  o.box(0, -0.72, 1.2, 1.0, 0.16, 0.12, { wash: PAL.cinnabar, line: 1 });
  o.box(0, -0.05, 0.03, 1.0, 0.12, 0.06, { wash: PAL.cinnabar, line: 1 });
  return o;
}

/** a timber / concrete post (gallery columns): 1 m tall (scaled), 0.22 square */
function post(): Builder {
  const o = new Builder();
  o.box(0, 0, 0, 0.22, 1, 0.22, { wash: 0xb8321f, line: 1 });
  return o;
}

/** a roll shutter (a closed shop), 1 × 1 (scaled), with its box */
function shutter(): Builder {
  const o = new Builder();
  o.quad(new Vector3(-0.5, 0, 0.04), X, Y, 1, 1, { wash: 0x8d9298, kind: K.slats, p1: 0.08, line: 1 });
  o.box(0, 0.94, 0.12, 1.04, 0.2, 0.24, { wash: 0x6d7178, line: 1 });
  return o;
}

/** an antenna mast (1 m, scaled y) with two crossbars; the dishes of the Antenna Forest in miniature */
function antenna(): Builder {
  const o = new Builder();
  const k: Look = { wash: PAL.ink, line: 0.8 };
  o.beam(new Vector3(0, 0, 0), new Vector3(0, 1, 0), 0.05, 0.05, k);
  o.beam(new Vector3(-0.35, 0.72, 0), new Vector3(0.35, 0.72, 0), 0.03, 0.03, k);
  o.beam(new Vector3(-0.22, 0.88, 0), new Vector3(0.22, 0.88, 0), 0.03, 0.03, k);
  return o;
}

/** a satellite dish on a short bracket */
function dish(): Builder {
  const o = new Builder();
  o.beam(new Vector3(0, 0, 0), new Vector3(0, 0, 0.35), 0.04, 0.04, { wash: PAL.ink, line: 0.6 });
  o.blob(ico0, 0, 0, 0.4, 0.32, 0.32, 0.06, { wash: 0xd8d6cf, line: 0 });
  return o;
}

export const PIECES = {
  balcony, balconySolid, balconyTimber, cageS: cageOf(CAGE_W[0]), cageW: cageOf(CAGE_W[1]), acUnit, acBox, pipe, laundryOut, laundryAlong, awning, plant, planter, signBox, signFlat,
  tank, shackG: shackOf(PAL.malachite), shackB: shackOf(PAL.azurite), bayBox, ledge, eave, post, shutter, antenna, dish, lantern, couplet, washLine,
} as const satisfies Record<string, () => Builder>;

export type PieceId = keyof typeof PIECES;
