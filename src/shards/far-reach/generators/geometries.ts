import { BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Vector3 } from 'three';
import { bakeKinds, type PieceBake } from '@wildshard/sdk/bake/kinds';
import { PALETTE } from '../world/shapes';

/**
 * Build-time only (SHARD-PLATFORM SF72): baked by scripts/bake-sky-world.mjs into baked/geometries.glb + data/geometries.json;
 * the client takes each kind's geometry (world/baked.ts skyBakedGeometry) and places its own instances of it.
 *
 * The shared one-geometry shapes Sky Reach instances at runtime: the meadow's grass clump, daisy and boulder (world/dressing.ts
 * places them over the islands), the code pine (world/shapes.ts, the last fallback for the trees) and the card-branch fir
 * (world/fir.ts, the trees' fallback while the branch sheet loaded). Each is one kind with one identity instance.
 */

/** One clump: five bent blades fanned round the centre, 1 m tall before scaling. */
function clumpGeometry(): BufferGeometry {
  // E392 foreground: thin blades in the near meadow's ramp (dark root, yellow-green body, gold tip), not lime cards
  const pos: number[] = [], col: number[] = [], nor: number[] = [], root = new Color(0x2c4030), mid = new Color(0x6a8a40), tip = new Color(0xd8b878);
  const push = (x: number, y: number, z: number, c: Color): void => { pos.push(x, y, z); col.push(c.r, c.g, c.b); nor.push(0, 1, 0); };
  // twelve blades over a patch about 0.6 m across (fewer, fuller instances: the instance matrices are the GPU cost)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + i * 0.4, dx = Math.cos(a), dz = Math.sin(a), w = 0.032, lean = 0.22 + (i % 3) * 0.14, h = 0.5 + (i % 4) * 0.16;
    const ox = Math.cos(i * 2.4) * 0.3 * ((i % 4) / 3), oz = Math.sin(i * 2.4) * 0.3 * ((i % 4) / 3);
    const px = -dz * w, pz = dx * w, mx = ox + dx * lean * 0.45, mz = oz + dz * lean * 0.45;
    // two quads up the blade, then the tip triangle: root → mid → tip, leaning outward
    push(ox + px, 0, oz + pz, root); push(ox - px, 0, oz - pz, root); push(mx + px * 0.7, h * 0.5, mz + pz * 0.7, mid);
    push(ox - px, 0, oz - pz, root); push(mx - px * 0.7, h * 0.5, mz - pz * 0.7, mid); push(mx + px * 0.7, h * 0.5, mz + pz * 0.7, mid);
    push(mx + px * 0.7, h * 0.5, mz + pz * 0.7, mid); push(mx - px * 0.7, h * 0.5, mz - pz * 0.7, mid); push(ox + dx * lean, h, oz + dz * lean, tip);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  return g;
}
/**
 * A daisy (E392 foreground): eight white petals round a gold eye, 0.1 m across, facing up on a short stem. Vertex-coloured,
 * so an instance colour tints it: white keeps the daisy, yellow makes a buttercup (its eye a deeper gold).
 */
function flowerGeometry(): BufferGeometry {
  const pos: number[] = [], col: number[] = [], y = 0.3, r = 0.05, eye = new Color(0xe8b52a), petal = new Color(0xffffff), stem = new Color(0x4e6a22);
  const push = (x: number, py: number, z: number, c: Color): void => { pos.push(x, py, z); col.push(c.r, c.g, c.b); };
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, b = a + Math.PI / 4, m = a + Math.PI / 8, w = 0.16;
    // the eye: an octagon fan, a hair above the petals
    push(0, y + 0.006, 0, eye); push(Math.cos(b) * r * 0.32, y + 0.006, Math.sin(b) * r * 0.32, eye); push(Math.cos(a) * r * 0.32, y + 0.006, Math.sin(a) * r * 0.32, eye);
    // a petal: a narrow kite from the eye out to the rim, its tip cupped up a little
    const px = Math.cos(m), pz = Math.sin(m), qx = -pz * w * r, qz = px * w * r;
    push(px * r * 0.25, y, pz * r * 0.25, petal); push(px * r * 0.62 - qx, y + 0.003, pz * r * 0.62 - qz, petal); push(px * r, y + 0.012, pz * r, petal);
    push(px * r * 0.25, y, pz * r * 0.25, petal); push(px * r, y + 0.012, pz * r, petal); push(px * r * 0.62 + qx, y + 0.003, pz * r * 0.62 + qz, petal);
  }
  push(-0.005, 0, 0, stem); push(0.005, 0, 0, stem); push(0, y, 0, stem);
  const nor = pos.map((_, i) => (i % 3 === 1 ? 1 : 0));
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  return g;
}

/**
 * A boulder: a subdivided icosahedron lumped by three octaves of noise, its underside flattened (it sits embedded), all
 * grey: the islands' rock paint gives it the cliff texture and moss on every facet that faces up (E392: a green vertex
 * colour took the painted meadow, a flat olive slab with daisies on it).
 */
function stoneGeometry(): BufferGeometry {
  const g = new IcosahedronGeometry(1, 1).toNonIndexed(), p = g.getAttribute('position'), col: number[] = [];
  const grey = new Color(0x8a8580), warm = new Color(0x9a8f84), dark = new Color(0x5c5856), c = new Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 2.3 + z * 1.7 + 0.4) * 0.5 + Math.sin(y * 3.1 - x * 1.3) * 0.3 + Math.sin(z * 6.7 + y * 5.3 - x * 4.1) * 0.2;
    // chunky facets: big lumps, a low crown, a flat bottom where it sits in the ground
    const k = 1 + 0.28 * n;
    p.setXYZ(i, x * k * (1 + 0.18 * Math.sin(z * 1.9)), Math.max(-0.35, y * k > 0.7 ? 0.7 + (y * k - 0.7) * 0.4 : y * k), z * k);
    c.copy(grey).lerp(warm, 0.5 + 0.5 * n).lerp(dark, Math.max(0, -y) * 0.7);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}


type Tri = (a: Vector3, b: Vector3, c: Vector3, color: number, vary?: number) => void;
/** Macro colour noise (Gilded Air: painted variation, not one flat colour per facet): a soft value field over world metres. */
const macro = (x: number, z: number): number => Math.sin(x * 0.31 + Math.sin(z * 0.23) * 1.7) * 0.5 + Math.sin(z * 0.37 - x * 0.11) * 0.5;
function builder(): { tri: Tri; geometry: () => BufferGeometry } {
  const pos: number[] = [], col: number[] = [], c = new Color();
  const tri: Tri = (a, b, d, color, vary = 0) => {
    for (const p of [a, b, d]) {
      c.setHex(color); const k = 1 + vary * macro(p.x, p.z), warm = vary * Math.max(0, macro(p.z * 0.7, p.x * 0.7));
      pos.push(p.x, p.y, p.z); col.push(c.r * k + warm * 0.05, c.g * k + warm * 0.03, c.b * k * (1 - warm * 0.4));
    }
  };
  return { tri, geometry: () => { const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g; } };
}

/**
 * One pine (loop 4; the targets' wind-bent conifers, not two cones): a tapered trunk and six drooping tiers, each a ring
 * of jagged branch tips hanging below its collar, dark blue-green inside, lighter gold-lit green at the tips, the crown
 * leaning a little downwind. One vertex-coloured geometry for instancing.
 */
function pineGeometry(): BufferGeometry {
  const { tri, geometry } = builder(), up = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
  const trunk = new CylinderGeometry(0.12, 0.3, 2.4, 6).toNonIndexed(); trunk.translate(0, 1.2, 0);
  const p = trunk.getAttribute('position'), a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (let i = 0; i < p.count; i += 3) { a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2); tri(a, b, c, PALETTE.trunk); }
  trunk.dispose();
  const tiers = 6, height = 7.4, inner = 0x22402f, mid = 0x355a3a, tip = 0x6f8a45, n = 9;
  for (let t = 0; t < tiers; t++) {
    const f = t / tiers, y = 1.5 + f * (height - 2.2), r = 2.0 * (1 - f * 0.82), drop = 1.15 - f * 0.45, lean = f * f * 0.35;
    const collar = up(lean, y + drop * 0.9, 0);
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2 + t * 0.7, a1 = ((k + 1) / n) * Math.PI * 2 + t * 0.7, am = (a0 + a1) / 2;
      const jag = 0.75 + 0.25 * Math.sin(k * 2.3 + t * 1.7);
      const p0 = up(Math.cos(a0) * r * 0.62 + lean, y + 0.12, Math.sin(a0) * r * 0.62), p1 = up(Math.cos(a1) * r * 0.62 + lean, y + 0.12, Math.sin(a1) * r * 0.62);
      const pt = up(Math.cos(am) * r * jag + lean, y - drop * 0.25, Math.sin(am) * r * jag);
      tri(collar, p1, p0, mid); tri(p0, p1, pt, tip, 0.12);
      // the underside, so a low view under the branches sees shade, not sky
      tri(p0, pt, up(lean, y - 0.1, 0), inner);
    }
  }
  tri(up(0.35 - 0.12, height - 0.3, -0.12), up(0.35 + 0.12, height - 0.3, 0.12), up(0.4, height + 0.6, 0), tip);
  return geometry();
}

/** The fir's size: base at y 0, about 8 m tall before the instance's scale (the code pine's height). */
const FIR = { height: 6.6, tiers: 12, perTier: 10, base: 2.7, cell: 2 } as const;

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function firGeometry(): BufferGeometry {
  const rnd = seeded(4417), pos: number[] = [], uv: number[] = [], nor: number[] = [], col: number[] = [];
  const c = new Color(), shade = new Color(0x4a6656), sun = new Color(0xd6f0d2), bark = new Color(0x6b4a34);
  const quad = (p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, u0: number, v0: number, u1: number, v1: number, n: Vector3, tint: Color): void => {
    const v = [[p0, u0, v0], [p1, u1, v0], [p2, u1, v1], [p0, u0, v0], [p2, u1, v1], [p3, u0, v1]] as const;
    for (const [p, u, w] of v) { pos.push(p.x, p.y, p.z); uv.push(u, w); nor.push(n.x, n.y, n.z); col.push(tint.r, tint.g, tint.b); }
  };
  // the trunk: an 8-sided taper, mapped to a bark-coloured corner of nothing (u, v outside the cards: the shader skips
  // the alpha test when the vertex colour says bark), a plain vertex colour
  const sides = 8, h = FIR.height * 0.92;
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2, r0 = 0.32, r1 = 0.06;
    const p0 = new Vector3(Math.cos(a0) * r0, 0, Math.sin(a0) * r0), p1 = new Vector3(Math.cos(a1) * r0, 0, Math.sin(a1) * r0);
    const p2 = new Vector3(Math.cos(a1) * r1, h, Math.sin(a1) * r1), p3 = new Vector3(Math.cos(a0) * r1, h, Math.sin(a0) * r1);
    const n = new Vector3(Math.cos((a0 + a1) / 2), 0.1, Math.sin((a0 + a1) / 2)).normalize();
    quad(p0, p1, p2, p3, -1, -1, -1, -1, n, bark);
  }
  // the tiers: boughs radiating out and drooping, longer low down; two crossed cards per bough for volume
  const cellW = 1 / FIR.cell;
  for (let t = 0; t < FIR.tiers; t++) {
    const f = t / (FIR.tiers - 1), y = 1.1 + f * (FIR.height - 1.8), len = FIR.base * (1 - f * 0.78) + 0.35, droop = 0.5 + (1 - f) * 0.45;
    const n = FIR.perTier - Math.round(f * 2);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + t * 0.9 + rnd() * 0.5, dir = new Vector3(Math.cos(a), 0, Math.sin(a));
      const side = new Vector3(-dir.z, 0, dir.x), w = len * 0.85;
      const cell = Math.floor(rnd() * FIR.cell * FIR.cell), cu = (cell % FIR.cell) * cellW, cv = 1 - (Math.floor(cell / FIR.cell) + 1) * cellW;
      const root = new Vector3(0, y, 0), tip = dir.clone().multiplyScalar(len).add(new Vector3(0, y - droop * len * 0.45, 0));
      c.copy(shade).lerp(sun, 0.35 + 0.65 * f);
      // flat card (the bough seen from above) and a vertical one (its depth), the sheet's left edge at the trunk
      const lift = new Vector3(0, w * 0.3, 0);
      quad(root.clone().addScaledVector(side, -w * 0.5), tip.clone().addScaledVector(side, -w * 0.5), tip.clone().addScaledVector(side, w * 0.5), root.clone().addScaledVector(side, w * 0.5),
        cu, cv, cu + cellW, cv + cellW, new Vector3(0, 1, 0), c);
      quad(root.clone().sub(lift), tip.clone().sub(lift), tip.clone().add(lift), root.clone().add(lift), cu, cv, cu + cellW, cv + cellW, side, c.clone().multiplyScalar(0.85));
    }
  }
  // the leader: a small upright card cross at the top
  const top = new Vector3(0, FIR.height - 0.6, 0);
  for (const s of [new Vector3(0.45, 0, 0), new Vector3(0, 0, 0.45)]) {
    quad(top.clone().sub(s), top.clone().add(s), top.clone().add(s).add(new Vector3(0, 1.3, 0)), top.clone().sub(s).add(new Vector3(0, 1.3, 0)), 0, 1 - cellW, cellW, 1, new Vector3(s.z, 0, s.x).normalize(), sun);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g;
}

/** The shapes as named kinds (one identity instance each), in plain standard materials: the client draws them in its own. */
export function buildGeometries(): (readonly [string, InstancedMesh])[] {
  const one = (geometry: BufferGeometry): InstancedMesh => { const mesh = new InstancedMesh(geometry, new MeshStandardMaterial({ vertexColors: true }), 1); mesh.setMatrixAt(0, new Matrix4()); return mesh; };
  return [['clump', one(clumpGeometry())], ['flower', one(flowerGeometry())], ['boulder', one(stoneGeometry())], ['pine', one(pineGeometry())], ['fir', one(firGeometry())]];
}

/** The shapes baked (no colliders). */
export function bakeSkyGeometries(): PieceBake { return bakeKinds('far.geometries', buildGeometries(), []); }
