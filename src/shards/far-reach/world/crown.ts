import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, TorusGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CROWN, DAIS } from '../layout';

/**
 * The storm crown's arena (loop 4; mockup D, `art/far-reach/round-11-review/mockup-D-crown-arena.jpg`): a ring of seven
 * weathered standing stones carved with pale wind glyphs, a gap facing the crown bridge (the arena's way in, +z), sagging
 * pennant ropes between their tops, and a low round dais of fitted stone with a compass rose inlaid in its top. It
 * replaces the loop-1 hexagonal pillars that read as one stray post from the arena's entrance.
 */
/** The ring stands round the dais (loop 5: at the crown's centre and 12.5 m out, the arena's entrance framed one stone). */
export const CROWN_RING = { radius: 9.5, stones: 7, width: 1.5, depth: 0.85 } as const;
/** Stone heights (metres), one per stone round the ring; tallest opposite the entrance, framing the dais. */
const HEIGHTS = [3.4, 4.1, 4.8, 5.2, 4.7, 4.0, 3.5] as const;

export interface Stone { readonly x: number; readonly z: number; readonly h: number; readonly yaw: number }
/** The stones in world space (the colliders and the meadow's holes read the same list). */
export function crownStones(): Stone[] {
  const n = CROWN_RING.stones, step = (Math.PI * 2) / n;
  // the gap is centred on +z (the bridge side): the first stone half a step past it
  return Array.from({ length: n }, (_, i) => {
    const a = Math.PI / 2 + step * (i + 0.5), x = DAIS.x + Math.cos(a) * CROWN_RING.radius, z = DAIS.z + Math.sin(a) * CROWN_RING.radius;
    // each stone's carved face turns to the dais
    return { x, z, h: HEIGHTS[i] ?? 4, yaw: Math.atan2(DAIS.x - x, DAIS.z - z) };
  });
}

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
  const stone = rgb(0x8e8695), warm = rgb(0xb3a28f), lichen = rgb(0x9a9a52), dark = rgb(0x5f5868);
  return paint(g, (x, y, z) => {
    const t = y / h, n = hash(Math.round(x * 6) + seed * 3, Math.round(y * 5) + Math.round(z * 6) * 3);
    let c = lerp3(dark, stone, Math.min(1, 0.45 + t)); c = lerp3(c, warm, n * 0.45);
    if (n > 0.72 && (t < 0.25 || t > 0.85)) c = lerp3(c, lichen, 0.75);
    return c;
  });
}

/** The carved wind glyph on a stone's face: a ring, a stroke through it and a dot, pale and faintly lit. */
function glyphGeometry(h: number): BufferGeometry {
  const ring = new TorusGeometry(0.26, 0.035, 4, 24); ring.translate(0, h * 0.52, 0);
  const inner = new TorusGeometry(0.11, 0.03, 4, 16); inner.translate(0, h * 0.52, 0);
  const stroke = new BoxGeometry(0.06, h * 0.38, 0.05); stroke.translate(0, h * 0.5, 0);
  const tick = new BoxGeometry(0.22, 0.05, 0.05); tick.translate(0, h * 0.73, 0);
  const merged = mergeGeometries([ring.toNonIndexed(), inner.toNonIndexed(), stroke.toNonIndexed(), tick.toNonIndexed()]);
  for (const g of [ring, inner, stroke, tick]) g.dispose();
  return merged;
}

/** The dais's top: a disc of fitted stone with a compass rose (eight points, light and shaded halves) and two inlaid rings. */
function daisGeometry(): BufferGeometry {
  const R = DAIS.r, H = DAIS.h;
  const pos: number[] = [], col: number[] = [];
  const tri = (a: number[], b: number[], c: number[], color: [number, number, number]): void => { pos.push(...a, ...b, ...c); col.push(...color, ...color, ...color); };
  const slab = rgb(0xa79c95), joint = rgb(0x7c7078), rim = rgb(0x8d8189), light = rgb(0xe6dccb), shade = rgb(0x6e6273), inlay = rgb(0xcdb38a);
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
    const a0 = (i / n) * Math.PI * 2 + 0.01, a1 = ((i + 1) / n) * Math.PI * 2 - 0.01, r0 = R - 0.45, r1 = R, top = H + 0.08;
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
  const colors = [rgb(0x3f8f9a), rgb(0xf1e7d2), rgb(0x2f4f7a), rgb(0xd9a441)];
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

/** The arena, in world space (add it to the level root); the dais at DAIS, the stones round the crown's centre. */
export function crownArena(): Group {
  const group = new Group(); group.name = 'far.crown.arena';
  const stones = crownStones();
  const stoneParts: BufferGeometry[] = [], glyphParts: BufferGeometry[] = [];
  stones.forEach((s, i) => {
    const g = stoneGeometry(s.h, i * 13 + 5); g.rotateY(s.yaw); g.translate(s.x, CROWN.y - 0.15, s.z); stoneParts.push(g);
    // the glyph sits proud of the face that turns to the dais
    const gl = glyphGeometry(s.h); gl.translate(0, 0, CROWN_RING.depth / 2 * 0.86); gl.rotateY(s.yaw); gl.translate(s.x, CROWN.y - 0.15, s.z); glyphParts.push(gl);
  });
  const stoneMesh = new Mesh(mergeGeometries(stoneParts), new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true }));
  const glyphMesh = new Mesh(mergeGeometries(glyphParts), new MeshStandardMaterial({ color: 0xeee3c8, emissive: 0x9fe6f2, emissiveIntensity: 0.35, roughness: 0.8, metalness: 0 }));
  for (const g of [...stoneParts, ...glyphParts]) g.dispose();
  const dais = new Mesh(daisGeometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: DoubleSide, flatShading: true }));
  dais.position.set(DAIS.x, CROWN.y, DAIS.z);
  const { rope, flags } = pennants(stones);
  const ropeMesh = new Mesh(rope, new MeshStandardMaterial({ color: 0xd6c095, roughness: 1, metalness: 0, side: DoubleSide }));
  const flagMesh = new Mesh(flags, new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: DoubleSide }));
  group.add(stoneMesh, glyphMesh, dais, ropeMesh, flagMesh);
  return group;
}
