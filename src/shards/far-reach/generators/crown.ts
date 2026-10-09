import { BoxGeometry, BufferGeometry, CatmullRomCurve3, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';
import { bakeKinds, type PieceBake } from '@wildshard/sdk/bake/kinds';
import { CROWN, DAIS } from '../data/layout';
import { CROWN_RING, crownStones, type Stone } from '../runtime/crownLayout';

/**
 * Build-time only (SHARD-PLATFORM SF72): baked by `scripts/bake-sky-world.mjs` into `baked/crown.glb` + `data/crown.json`;
 * the client draws the bake (`world/crown.ts`), the stones and the dais in the islands' painted rock (a kind's `paint` is
 * its `paintIsleMaterial` rock mix), and stands the modelled set in place of the code stones, glyphs and dais where it loaded.
 *
 * The storm crown's arena (loop 4, mockup D): the code-built standing stones with their wind glyphs, the compass-rose dais,
 * the pennant ropes and flags between the stone tops, and the arena's colliders (the dais and each stone).
 */

const hash = (x: number, y: number): number => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function paint(g: BufferGeometry, color: (x: number, y: number, z: number) => [number, number, number]): BufferGeometry {
  const p = g.getAttribute('position'), col: number[] = [];
  for (let i = 0; i < p.count; i++) col.push(...color(p.getX(i), p.getY(i), p.getZ(i)));
  g.setAttribute('color', new Float32BufferAttribute(col, 3)); return g;
}
const rgb = (hex: number): [number, number, number] => { const c = new Color(hex); return [c.r, c.g, c.b]; };
const lerp3 = (a: [number, number, number], b: [number, number, number], k: number): [number, number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/** A rough standing stone `h` tall: a subdivided slab, bulged and chipped by noise, its top sheared; lichen low and on the top. */
function stoneGeometry(h: number, seed: number): BufferGeometry {
  const g = new BoxGeometry(CROWN_RING.width, h, CROWN_RING.depth, 3, 8, 2).toNonIndexed(); g.translate(0, h / 2, 0);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = y / h;
    const n = hash(Math.round(x * 4) + seed, Math.round(y * 3) + Math.round(z * 4) * 7) - 0.5;
    const taper = 1 - 0.28 * t * t, shear = t > 0.97 ? (x / CROWN_RING.width) * 0.45 : 0;
    p.setXYZ(i, x * taper * (1 + n * 0.16), y - shear * h * 0.12, z * taper * (1 + n * 0.22));
  }
  g.computeVertexNormals();
  // weathered grey with lichen (E399 seat on mockup D: 'violet-tinted slabs'; the mockup's are grey, lichen-crusted)
  const stone = rgb(0x878478), warm = rgb(0xa8987f), lichen = rgb(0x9a9a52), dark = rgb(0x4e4b45);
  return paint(g, (x, y, z) => {
    const t = y / h, n = hash(Math.round(x * 6) + seed * 3, Math.round(y * 5) + Math.round(z * 6) * 3);
    let c = lerp3(dark, stone, Math.min(1, 0.45 + t)); c = lerp3(c, warm, n * 0.45);
    if (n > 0.72 && (t < 0.25 || t > 0.85)) c = lerp3(c, lichen, 0.75);
    return c;
  });
}

/**
 * The carved wind glyph on a stone's face (E399, mockup D: each stone bears a large spiral, pale and faintly lit): a
 * two-and-a-half-turn spiral 0.62 m across a little above the stone's middle, with a short tail running down the face.
 */
function glyphGeometry(h: number): BufferGeometry {
  const pts: Vector3[] = [], cy = h * 0.56;
  for (let k = 0; k <= 90; k++) { const t = k / 90, a = t * Math.PI * 5, r = 0.04 + 0.27 * t; pts.push(new Vector3(Math.cos(a) * r, cy + Math.sin(a) * r, 0)); }
  const last = pts[pts.length - 1] ?? new Vector3(0.31, cy, 0);
  for (let k = 1; k <= 8; k++) pts.push(new Vector3(last.x + 0.01 * k, last.y - 0.06 * k, 0));
  return new TubeGeometry(new CatmullRomCurve3(pts), 140, 0.03, 4, false).toNonIndexed();
}

/** The dais's top: a disc of fitted stone with a compass rose (eight points, light and shaded halves) and two inlaid rings. */
function daisGeometry(): BufferGeometry {
  const R = DAIS.r, H = DAIS.h;
  const pos: number[] = [], col: number[] = [];
  const tri = (a: number[], b: number[], c: number[], color: [number, number, number]): void => { pos.push(...a, ...b, ...c); col.push(...color, ...color, ...color); };
  const slab = rgb(0xa49d92), joint = rgb(0x6a655c), rim = rgb(0x8c867b), light = rgb(0xf0e4cc), shade = rgb(0x4e4a44), inlay = rgb(0xd9b878);
  // the top: 4 rings of fitted slabs, alternate slabs a shade apart
  const rings = [0, 1.4, 2.6, 3.8, R - 0.45], segs = [8, 12, 18, 24];
  for (let k = 0; k < 4; k++) {
    const r0 = rings[k] ?? 0, r1 = rings[k + 1] ?? R, n = segs[k] ?? 8;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, gap = 0.012;
      const c = lerp3(slab, joint, hash(i, k) * 0.35);
      const P = (r: number, a: number): number[] => [Math.cos(a) * r, H, Math.sin(a) * r];
      tri(P(r0 + gap, a0 + gap), P(r1 - gap, a1 - gap), P(r1 - gap, a0 + gap), c); tri(P(r0 + gap, a0 + gap), P(r0 + gap, a1 - gap), P(r1 - gap, a1 - gap), c);
    }
  }
  // the rim: a ring of kerb blocks standing a little proud, with the side face down to the grass
  const n = 28;
  for (let i = 0; i < n; i++) {
    // (round 7, seat A: 'a fractured raised rim'): every block its own height and set, a few chipped low, gaps between
    const h = hash(i, 5), chip = hash(i, 11) > 0.82;
    const a0 = (i / n) * Math.PI * 2 + 0.015 + 0.02 * h, a1 = ((i + 1) / n) * Math.PI * 2 - 0.015 - 0.02 * hash(i, 7), r0 = R - 0.45 - 0.08 * h, r1 = R + 0.06 * hash(i, 3), top = H + (chip ? 0.01 : 0.05 + 0.1 * h);
    const c = lerp3(rim, joint, hash(i, 9) * 0.4), P = (r: number, a: number, y: number): number[] => [Math.cos(a) * r, y, Math.sin(a) * r];
    tri(P(r0, a0, top), P(r1, a1, top), P(r1, a0, top), c); tri(P(r0, a0, top), P(r0, a1, top), P(r1, a1, top), c);
    tri(P(r1, a0, top), P(r1, a1, top), P(r1, a1, -0.1), lerp3(c, shade, 0.4)); tri(P(r1, a0, top), P(r1, a1, -0.1), P(r1, a0, -0.1), lerp3(c, shade, 0.4));
    tri(P(r0, a0, H), P(r0, a1, top), P(r0, a0, top), lerp3(c, shade, 0.25)); tri(P(r0, a0, H), P(r0, a1, H), P(r0, a1, top), lerp3(c, shade, 0.25));
  }
  // the compass rose: four long points, four short, each split into a light and a shaded half
  const y = H + 0.012;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2, len = i % 2 === 0 ? 3.4 : 2.1, w = i % 2 === 0 ? 0.42 : 0.3;
    const tip = [Math.cos(a) * len, y, Math.sin(a) * len], l = [Math.cos(a - Math.PI / 2) * w, y, Math.sin(a - Math.PI / 2) * w], r = [Math.cos(a + Math.PI / 2) * w, y, Math.sin(a + Math.PI / 2) * w];
    tri([0, y, 0], tip, l, light); tri([0, y, 0], r, tip, shade);
  }
  // two inlaid bronze-stone rings
  for (const [r0, r1] of [[1.0, 1.12], [3.55, 3.68]] as const) {
    const m = 48;
    for (let i = 0; i < m; i++) {
      const a0 = (i / m) * Math.PI * 2, a1 = ((i + 1) / m) * Math.PI * 2, P = (r: number, a: number): number[] => [Math.cos(a) * r, y + 0.002, Math.sin(a) * r];
      tri(P(r0, a0), P(r1, a1), P(r1, a0), inlay); tri(P(r0, a0), P(r0, a1), P(r1, a1), inlay);
    }
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  // the triangles above are wound both ways: draw double-sided and compute flat normals per face
  g.computeVertexNormals();
  return g;
}

/** Pennant ropes between neighbouring stone tops (not across the entrance): a sagging cord, triangular flags hanging off it. */
function pennants(stones: readonly Stone[]): { rope: BufferGeometry; flags: BufferGeometry } {
  const rope: number[] = [], flag: number[] = [], fcol: number[] = [];
  // muted navy, cream and faded teal and ochre (E399, mockup D's weathered pennants)
  const colors = [rgb(0x4f7a7c), rgb(0xd9cdb4), rgb(0x34405a), rgb(0xb08a4a)];
  let f = 0;
  for (let i = 0; i + 1 < stones.length; i++) {
    const a = stones[i], b = stones[i + 1]; if (a === undefined || b === undefined) continue;
    const ya = CROWN.y + a.h - 0.35, yb = CROWN.y + b.h - 0.35, len = Math.hypot(b.x - a.x, b.z - a.z), sag = len * 0.12, segs = 14;
    const at = (t: number): [number, number, number] => [a.x + (b.x - a.x) * t, ya + (yb - ya) * t - sag * 4 * t * (1 - t), a.z + (b.z - a.z) * t];
    for (let s = 0; s < segs; s++) {
      const p = at(s / segs), q = at((s + 1) / segs), w = 0.025;
      rope.push(p[0], p[1] + w, p[2], q[0], q[1] + w, q[2], q[0], q[1] - w, q[2], p[0], p[1] + w, p[2], q[0], q[1] - w, q[2], p[0], p[1] - w, p[2]);
    }
    const count = Math.floor(len / 0.85);
    for (let k = 1; k < count; k++) {
      const t0 = (k - 0.3) / count, t1 = (k + 0.3) / count, p = at(t0), q = at(t1), m = at((t0 + t1) / 2), drop = 0.55 + 0.1 * hash(i, k);
      flag.push(...p, ...q, m[0], m[1] - drop, m[2]);
      const c = colors[f++ % colors.length] ?? colors[0] ?? [1, 1, 1]; fcol.push(...c, ...c, ...c);
    }
  }
  const r = new BufferGeometry(); r.setAttribute('position', new Float32BufferAttribute(rope, 3)); r.computeVertexNormals();
  const fl = new BufferGeometry(); fl.setAttribute('position', new Float32BufferAttribute(flag, 3)); fl.setAttribute('color', new Float32BufferAttribute(fcol, 3)); fl.computeVertexNormals();
  return { rope: r, flags: fl };
}

/** A kind's `paint` (the islands' painted rock mix, `paintIsleMaterial`) rides its material to the rows. */
const painted = (material: MeshStandardMaterial, rockMix: number): MeshStandardMaterial => { material.userData['paint'] = rockMix; return material; };
const one = (geometry: BufferGeometry, material: MeshStandardMaterial, at = new Matrix4()): InstancedMesh => { const mesh = new InstancedMesh(geometry, material, 1); mesh.setMatrixAt(0, at); return mesh; };

export interface CrownSet { readonly kinds: (readonly [string, InstancedMesh])[]; readonly colliders: ColliderDesc[] }

/** The code arena in world space: the stones, the glyphs, the dais (at DAIS), the pennant ropes and flags, and its colliders. */
export function buildCrownSet(): CrownSet {
  const stones = crownStones(), stoneParts: BufferGeometry[] = [], glyphParts: BufferGeometry[] = [];
  stones.forEach((s, i) => {
    const g = stoneGeometry(s.h, i * 13 + 5); g.rotateY(s.yaw); g.translate(s.x, CROWN.y - 0.15, s.z); stoneParts.push(g);
    // the glyph sits proud of the face that turns to the dais
    // (round 8, the seats: 'proud spiral tubes'): flattened into the face, pale worn stone with the faintest glow (mockup D's
    // runes read pale on the dark stones)
    const gl = glyphGeometry(s.h); gl.scale(1, 1, 0.35); gl.translate(0, 0, CROWN_RING.depth / 2 * 0.97); gl.rotateY(s.yaw); gl.translate(s.x, CROWN.y - 0.15, s.z); glyphParts.push(gl);
  });
  // weathered rock (E399, the council: 'the stones and dais are clean; the mockup's rough and weathered'): the islands' painted rock
  const stone = one(mergeGeometries(stoneParts), painted(new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true }), 0.7));
  const glyph = one(mergeGeometries(glyphParts), new MeshStandardMaterial({ color: 0xb4ad9e, emissive: 0x9fe6f2, emissiveIntensity: 0.04, roughness: 0.95, metalness: 0 }));
  for (const g of [...stoneParts, ...glyphParts]) g.dispose();
  const dais = one(daisGeometry(), painted(new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: DoubleSide, flatShading: true }), 0.18),
    new Matrix4().makeTranslation(DAIS.x, CROWN.y, DAIS.z));
  const { rope, flags } = pennants(stones);
  const ropes = one(rope, new MeshStandardMaterial({ color: 0xd6c095, roughness: 1, metalness: 0, side: DoubleSide }));
  const flagMesh = one(flags, new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: DoubleSide }));
  const colliders = [boxDesc({ x: DAIS.x, z: DAIS.z, hw: DAIS.r * 0.9, hd: DAIS.r * 0.9, rot: 0, yBottom: CROWN.y, yTop: CROWN.y + DAIS.h }, 'stone'),
    ...stones.map((st) => boxDesc({ x: st.x, z: st.z, hw: CROWN_RING.width / 2, hd: CROWN_RING.depth / 2, rot: -st.yaw, yBottom: CROWN.y, yTop: CROWN.y + st.h }, 'stone'))];
  return { kinds: [['stone', stone], ['glyph', glyph], ['dais', dais], ['rope', ropes], ['flags', flagMesh]], colliders };
}

/** The arena's five kinds (one instance each, world space) and its colliders; a painted kind's row carries its `paint`. */
export function bakeSkyCrown(): PieceBake {
  const built = buildCrownSet();
  return bakeKinds('far.crown', built.kinds, built.colliders, { extra: (m) => { const rockMix: unknown = m.userData['paint']; return typeof rockMix === 'number' ? { paint: rockMix } : {}; } });
}
