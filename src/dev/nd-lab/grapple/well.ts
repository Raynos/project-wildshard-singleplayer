// Lab P9 "grapple" (E169): the demo's set — a Well at Lantern Square's stratum in Jiehua Neon, laid out like comp-B:
// you stand at the south end on a stone overlook and look NORTH down the Well's 86 m length (the strata fall away into
// silk fog, bridges and cables cross it), and the dragon hook hangs off a timber veranda on the EAST wall, up and to
// your right, ≈ 14 m away.
// The shaft walls are the facade lab's Kowloon grammar (./world/, a snapshot copy of src/dev/nd-lab/facade/); on top of
// it, with the same kit:
//  - the overlook: flagstones, a kerb, a carved granite balustrade — in the wet-stone program (./wetstone.ts) that
//    mirrors the neon;
//  - the veranda (built in its own frame, turned onto the east wall): deck, barred rail, red lacquer pillars, a glazed
//    eave, lanterns, a lattice door with couplets — and on its middle pillar the brass DRAGON HOOK (./hook.ts);
//  - three bridges and a lattice of cables / laundry / lantern strings across the Well for depth;
//  - neon calligraphy (./neon.ts): the jade 旅館 blade sign by the hook, 麵 / 牙科 / 火鍋 / 茶 / 藥房 down the walls.
import { Color, Group, Matrix4, Mesh, Vector3 } from 'three';
import { buildFacade } from './world/batch';
import { Builder, K, type Look, X, Z } from './world/geo';
import { Dressing, type DressOptions, dressTower, spanStreet, type TowerSpec } from './world/grammar';
import { jiehuaMaterial, type Uniforms } from './world/material';
import { Rng } from './world/rng';
import { neonSign, type NeonSign } from './neon';
import { wetStoneMaterial } from './wetstone';

const V = { D: 2.7, L: 13, y: 2.6, pillars: [-4.4, 0, 4.4] as const, pr: 0.19 };
/** the veranda's frame: local +z out of the east wall (world −x), local +x along it (world +z), centred at z = −4 */
const VM = new Matrix4().makeTranslation(9, 0, -4).multiply(new Matrix4().makeRotationY(-Math.PI / 2));
const toW = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z).applyMatrix4(VM);

/** the set's numbers (world metres) */
export const SET = {
  well: { x0: -9, x1: 9, z0: -70, z1: 16 },
  terrace: { y: 0, zEdge: 7.5 },
  veranda: V,
  /** where the hook's plate meets its pillar (the pillar's outer face), and the way it faces */
  hookAt: toW(0, V.y + 2.05, V.D - 0.15 + V.pr),
  hookFace: new Vector3(-1, 0, 0),
  /** the eye at the start (at the balustrade) and after the landing (on the veranda) */
  start: new Vector3(-1.2, 1.62, 8.12),
  landing: toW(1.7, V.y + 1.62, 1.35),
  /** a warm lantern under the eave, near the hook (its spill on the brass) */
  lantern: toW(-2.2, V.y + 3.1, V.D - 0.2),
} as const;

const STONE: Look = { wash: 0x4c4d53, line: 1 };
const STONE_CAP: Look = { wash: 0x58595f, line: 1.8 };
const LACQUER: Look = { wash: 0x9c3627, line: 1 };
const TIMBER: Look = { wash: 0x5e4430, line: 1 };
const RAIL: Look = { wash: 0x2a2620, line: 1 };

export interface WellSet {
  group: Group;
  signs: NeonSign[];
  tris: number;
  draws: number;
}

function towers(): { t: TowerSpec; o: DressOptions; seed: number }[] {
  const W = SET.well;
  const near: DressOptions = { gallery: 0.42, street: 0, setbacks: false, timber: 0.75, lit: 0.62, detailY: [-30, 40] };
  const far: DressOptions = { ...near, lod: 1 };
  const zm = -28;
  return [
    // the long walls: the near half dressed in full, the far half without small clutter
    { t: { x: W.x0 - 8, z: (W.z1 + zm) / 2, w: 16, d: W.z1 - zm, y0: -60, h: 124, faces: 4 }, o: near, seed: 513 },
    { t: { x: W.x0 - 8, z: (zm + W.z0) / 2, w: 16, d: zm - W.z0, y0: -60, h: 112, faces: 4 }, o: far, seed: 523 },
    { t: { x: W.x1 + 8, z: (W.z1 + zm) / 2, w: 16, d: W.z1 - zm, y0: -60, h: 106, faces: 8 }, o: near, seed: 514 },
    { t: { x: W.x1 + 8, z: (zm + W.z0) / 2, w: 16, d: zm - W.z0, y0: -60, h: 118, faces: 8 }, o: far, seed: 524 },
    // the two ends
    { t: { x: 0, z: W.z0 - 8, w: 34, d: 16, y0: -60, h: 118, faces: 1 }, o: far, seed: 511 },
    { t: { x: 0, z: W.z1 + 8, w: 34, d: 16, y0: -60, h: 112, faces: 2 }, o: near, seed: 512 },
  ];
}

/** the overlook: slab, flagstones, kerb, the carved balustrade along its Well edge */
function terrace(b: Builder): void {
  const y = SET.terrace.y, ze = SET.terrace.zEdge, x0 = -7, x1 = 7, zb = SET.well.z1;
  b.box(0, y - 0.7, (ze + zb) / 2, x1 - x0, 0.7, zb - ze, { wash: 0x5f6066, line: 1.2 }, { top: null, bottom: { wash: 0x4a4b51, line: 1 } });
  const r = new Rng(31);
  for (let z = ze + 0.35; z < zb - 0.01; z += 0.9) {
    const off = r.chance(0.5) ? 0.6 : 0;
    for (let x = x0 - off; x < x1 - 0.01; x += 1.2) {
      const xa = Math.max(x, x0), xb = Math.min(x + 1.2, x1), zb2 = Math.min(z + 0.9, zb);
      if (xb - xa < 0.05) continue;
      const c = new Color(0x4a4b51).multiplyScalar(0.85 + r.range(0, 0.2));
      b.quad(new Vector3(xa, y, zb2), X, Z.clone().negate(), xb - xa, zb2 - z, { wash: c.getHex(), line: 0.8 });
    }
  }
  b.box(0, y, ze + 0.17, x1 - x0, 0.14, 0.34, { wash: 0x66676d, line: 2.0 });
  const H = 0.84;
  const posts: number[] = [];
  for (let x = x0 + 0.15; x <= x1 - 0.14; x += 1.6) posts.push(x);
  for (const px of posts) {
    b.box(px, y + 0.14, ze + 0.17, 0.26, H - 0.02, 0.26, STONE);
    b.box(px, y + 0.14 + H - 0.02, ze + 0.17, 0.32, 0.08, 0.32, STONE_CAP);
    b.box(px, y + 0.14 + H + 0.06, ze + 0.17, 0.2, 0.12, 0.2, STONE_CAP);
    b.box(px, y + 0.14 + H + 0.18, ze + 0.17, 0.1, 0.08, 0.1, STONE_CAP);
  }
  b.box(0, y + 0.14 + H - 0.2, ze + 0.17, x1 - x0, 0.14, 0.24, STONE_CAP);
  b.box(0, y + 0.14, ze + 0.17, x1 - x0, 0.16, 0.2, STONE);
  for (let i = 0; i + 1 < posts.length; i++) {
    const a = posts[i] ?? 0, c = posts[i + 1] ?? 0;
    b.box((a + c) / 2, y + 0.3, ze + 0.17, c - a - 0.26, H - 0.5, 0.12, { wash: 0x46474d, kind: K.panel, line: 1 });
  }
}

/** the veranda in its own frame: wall face at z = 0, the deck out to z = D, x along the wall */
function veranda(): Builder {
  const b = new Builder();
  const { D, L, y } = V;
  const hl = L / 2;
  b.box(0, y - 0.32, D / 2, L, 0.32, D, { wash: 0x7d7d82, line: 1.8 }, { bottom: { wash: 0x505259, line: 1 } });
  b.quad(new Vector3(-hl, y + 0.002, D), X, Z.clone().negate(), L, D, { wash: 0x6a513b, kind: K.slats, p1: 0.16, line: 0.8 });
  const rz = D - 0.04;
  b.box(0, y + 0.98, rz, L, 0.07, 0.1, TIMBER);
  b.box(0, y + 0.08, rz, L, 0.08, 0.08, TIMBER);
  for (let x = -hl + 0.1; x < hl; x += 0.14) b.flatBar(new Vector3(x, y + 0.16, rz), new Vector3(x, y + 0.98, rz), 0.03, Z, RAIL);
  const pz = D - 0.15;
  for (const px of V.pillars) {
    b.box(px, y, pz, 0.5, 0.18, 0.5, STONE_CAP);
    b.box(px, y + 0.18, pz, V.pr * 2, 4.3, V.pr * 2, LACQUER);
    b.box(px, y + 4.3, pz, 0.5, 0.2, 0.9, { wash: 0x2f6f62, line: 1 });
  }
  b.box(0, y + 4.1, pz, L + 0.6, 0.34, 0.3, LACQUER);
  b.box(0, y + 3.9, pz + 0.02, L + 0.4, 0.2, 0.32, { wash: 0x2f6f62, line: 1 });
  const e0 = new Vector3(-hl - 0.8, y + 5.25, 0);
  const sv = new Vector3(0, -1.05, D + 0.9);
  const len = sv.length();
  sv.normalize();
  b.quad(e0, X, sv, L + 1.6, len, { wash: 0x2e5fa3, kind: K.tiles, line: 1 });
  b.quad(e0.clone().addScaledVector(sv, len), X, new Vector3(0, -1, 0), L + 1.6, 0.14, { wash: 0x7e1e1a, line: 1.4 });
  // the back wall: a lattice door, red couplets, a lit shop window
  b.box(1.6, y, 0.05, 2.0, 2.4, 0.1, { wash: 0x5a3d2a, kind: K.bars, p1: 0.2, p2: 0.2, line: 1 });
  b.box(0.35, y + 0.4, 0.08, 0.34, 1.8, 0.04, { wash: 0xb3261a, line: 1 });
  b.box(2.85, y + 0.4, 0.08, 0.34, 1.8, 0.04, { wash: 0xb3261a, line: 1 });
  b.box(-3.0, y + 0.9, 0.05, 2.4, 1.4, 0.06, { wash: 0xb07a45, kind: K.bars, p1: 0.3, p2: 0.35, emit: 0.35, line: 1 });
  for (const lx of [-2.2, 2.2]) {
    b.box(lx, y + 3.1, D - 0.2, 0.36, 0.5, 0.36, { wash: 0xff4a3a, kind: K.sign, emit: 1.6, line: 1 });
    b.beam(new Vector3(lx, y + 3.6, D - 0.2), new Vector3(lx, y + 3.9, D - 0.2), 0.02, 0.02, RAIL);
  }
  return b;
}

/** a footbridge across the Well at z, y: a deck with its fascia, barred rails both sides */
function bridge(b: Builder, z: number, y: number, w: number): void {
  const W = SET.well;
  const span = W.x1 - W.x0;
  b.box(0, y - 0.35, z, span, 0.35, w, { wash: 0x5a5b61, line: 1.6 }, { bottom: { wash: 0x44464c, line: 1 } });
  for (const s of [-1, 1]) {
    const rz = z + s * (w / 2 - 0.05);
    b.box(0, y + 1.0, rz, span, 0.06, 0.08, RAIL);
    b.quad(new Vector3(W.x0, y, rz), X, new Vector3(0, 1, 0), span, 1.0, { wash: 0x2a2620, kind: K.bars, p1: 0.16, p2: 0, line: 1, edges: 0 });
  }
}

export function buildWell(shared: Uniforms): WellSet {
  const group = new Group();
  const d = new Dressing();
  for (const e of towers()) dressTower(e.t, e.seed, e.o, d);
  const r = new Rng(78);
  const W = SET.well;
  // cables, laundry and lantern strings across the Well (west–east), north of the veranda
  for (let i = 0; i < 26; i++) {
    const high = i % 3 === 0;
    const ya = high ? r.range(12, 34) : r.range(-40, 9);
    const z = r.range(W.z0 + 4, -10);
    spanStreet(d, new Vector3(W.x0 + 0.5, ya, z), new Vector3(W.x1 - 0.5, ya + r.range(-3, 3), z + r.range(-4, 4)), 3000 + i);
  }
  const { group: fac, stats } = buildFacade(d, shared);
  group.add(fac);
  const b = new Builder();
  b.append(veranda(), VM);
  bridge(b, -22, 9, 2.4);
  bridge(b, -38, -3, 2.8);
  bridge(b, -55, 15, 2.2);
  group.add(new Mesh(b.build(), jiehuaMaterial(shared)));
  const west = X, east = X.clone().negate();
  const signs: NeonSign[] = [
    neonSign('旅館', true, 0x33f0b0, toW(-3.5, V.y + 2.5, V.D + 0.35), east, 1.9, shared, 3.4),
    neonSign('麵', false, 0xff3fa4, new Vector3(W.x0 + 0.06, 8.5, -13), west, 2.1, shared, 3.6),
    neonSign('牙科', true, 0x3fe6ff, new Vector3(W.x0 + 0.06, 3.4, -6), west, 2.85, shared, 3.4),
    neonSign('火鍋', true, 0xff3b30, new Vector3(W.x1 - 0.06, 6.5, -19), east, 3.3, shared, 3.2),
    neonSign('茶', false, 0xffb347, new Vector3(W.x1 - 0.06, 12, -11), east, 1.8, shared, 3.0),
    neonSign('藥房', false, 0x33f0b0, new Vector3(0, 13, W.z0 + 0.06), Z, 3.9, shared, 3.2),
    neonSign('九龍', true, 0xff3b30, new Vector3(W.x1 - 0.06, 10.5, 2.2), east, 4.2, shared, 3.4),
    neonSign('藥房', true, 0x33f0b0, new Vector3(W.x0 + 0.06, 6.5, -24), west, 3.3, shared, 3.2),
    neonSign('麻雀', true, 0xff3fa4, new Vector3(W.x1 - 0.06, 3.2, -31), east, 3, shared, 3.4),
    neonSign('旅館', true, 0x3fe6ff, new Vector3(W.x0 + 0.06, 12.5, -36), west, 3.6, shared, 3.2),
    neonSign('按摩', true, 0xffb347, new Vector3(W.x1 - 0.06, 9.5, -44), east, 3.6, shared, 3.0),
  ];
  for (const s of signs) group.add(s.mesh);
  // the overlook in wet granite, mirroring the four nearest signs
  const tb = new Builder();
  terrace(tb);
  const wet = wetStoneMaterial(shared, signs.slice(0, 4).map((s) => ({ p: s.mesh.position.clone(), c: s.color.clone().multiplyScalar(0.35) })));
  group.add(new Mesh(tb.build(), wet));
  return { group, signs, tris: stats.tris + b.triangleCount + tb.triangleCount + signs.length * 2, draws: stats.draws + 2 + signs.length };
}
