import { BufferGeometry, Color, ConeGeometry, DoubleSide, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { ISLES, SPANS, apothem, type Isle } from '../layout';

/**
 * The island dressing (Gilded Air, review items 6 / 7, loop 2): what makes an island top read as a meadow and its
 * underside as old rock, not felt and a cone. All instanced, no colliders (you walk through grass and flowers; the stones
 * are ankle-high), one draw each:
 *
 * - **grass clumps**: twelve bent blades per clump, olive at the root to gold at the tip, up-facing normals so a clump is lit
 *   like the meadow under it (no black back faces against the low sun);
 * - **flowers**: white and yellow four-petal stars just over the grass;
 * - **stones**: low warm-grey rocks, mostly near the rims;
 * - **hanging roots**: tapered strands from the dirt band under every rim, swaying nowhere (a later FX pass).
 *
 * Placement uses its own seeded generator, not the level's cosmetic stream (whose order the islands already consume).
 */
export const DRESS = { clumpsPerM2: 0.5, flowersPerM2: 0.08, stonesPerIsle: 9, rootsPerM: 0.55, bridgeClear: 0.3 } as const;

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** One clump: five bent blades fanned round the centre, 1 m tall before scaling. */
export function clumpGeometry(): BufferGeometry {
  const pos: number[] = [], col: number[] = [], nor: number[] = [], root = new Color(0x667f36), mid = new Color(0xa0ab4c), tip = new Color(0xdcc068);
  const push = (x: number, y: number, z: number, c: Color): void => { pos.push(x, y, z); col.push(c.r, c.g, c.b); nor.push(0, 1, 0); };
  // twelve blades over a patch about 0.6 m across (fewer, fuller instances: the instance matrices are the GPU cost)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + i * 0.4, dx = Math.cos(a), dz = Math.sin(a), w = 0.07, lean = 0.28 + (i % 2) * 0.12, h = 0.75 + (i % 3) * 0.15;
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
/** A flower: a flat four-petal star 0.16 m across on a short stem, facing up. */
export function flowerGeometry(): BufferGeometry {
  const pos: number[] = [], nor: number[] = [], y = 0.42, r = 0.08;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2, b = a + 0.5, c = a - 0.5;
    pos.push(0, y, 0, Math.cos(c) * r * 0.45, y, Math.sin(c) * r * 0.45, Math.cos(a) * r, y + 0.01, Math.sin(a) * r);
    pos.push(0, y, 0, Math.cos(a) * r, y + 0.01, Math.sin(a) * r, Math.cos(b) * r * 0.45, y, Math.sin(b) * r * 0.45);
  }
  pos.push(-0.008, 0, 0, 0.008, 0, 0, 0, y, 0);
  for (let i = 0; i < pos.length / 3; i++) nor.push(0, 1, 0);
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  return g;
}

/** True when (x, z) on `isle` lies on a bridge's landing lane (kept clear so the walkway reads). */
function onLane(x: number, z: number): boolean {
  for (const s of SPANS) {
    const alongX = s.z0 === s.z1;
    if (alongX ? Math.abs(z - s.z0) < s.width / 2 + DRESS.bridgeClear && x > Math.min(s.x0, s.x1) - 3 && x < Math.max(s.x0, s.x1) + 3
      : Math.abs(x - s.x0) < s.width / 2 + DRESS.bridgeClear && z > Math.min(s.z0, s.z1) - 3 && z < Math.max(s.z0, s.z1) + 3) return true;
  }
  return false;
}

interface Place { x: number; y: number; z: number; s: number; yaw: number }

export interface Dressing { readonly group: Group; readonly meshes: readonly InstancedMesh[] }

export function dressIslands(isles: readonly Isle[] = ISLES, seed = 6417): Dressing {
  const rnd = seeded(seed), m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), s = new Vector3(), p = new Vector3();
  const clumps: Place[] = [], flowers: (Place & { c: number })[] = [], stones: Place[] = [], roots: Place[] = [];
  for (const isle of isles) {
    const ap = apothem(isle), area = Math.PI * ap * ap;
    const inside = (k: number): [number, number] => { const r = ap * Math.sqrt(rnd()) * k, a = rnd() * Math.PI * 2; return [isle.x + Math.cos(a) * r, isle.z + Math.sin(a) * r]; };
    for (let i = 0; i < area * DRESS.clumpsPerM2; i++) {
      const [x, z] = inside(0.96); if (onLane(x, z) && rnd() < 0.85) continue;
      clumps.push({ x, y: isle.y, z, s: 0.45 + rnd() * 0.5, yaw: rnd() * 6.28 });
    }
    for (let i = 0; i < area * DRESS.flowersPerM2; i++) {
      const [x, z] = inside(0.94); if (onLane(x, z)) continue;
      // drifts: flowers cluster round a few seeds per island
      flowers.push({ x, y: isle.y, z, s: 0.8 + rnd() * 0.6, yaw: rnd() * 6.28, c: rnd() < 0.6 ? 0xf6f1e4 : 0xf2cf55 });
    }
    for (let i = 0; i < DRESS.stonesPerIsle; i++) {
      const a = rnd() * Math.PI * 2, r = ap * (0.7 + rnd() * 0.26), x = isle.x + Math.cos(a) * r, z = isle.z + Math.sin(a) * r;
      if (onLane(x, z)) continue;
      stones.push({ x, y: isle.y - 0.05, z, s: 0.25 + rnd() * 0.45, yaw: rnd() * 6.28 });
    }
    const ring = Math.round(2 * Math.PI * isle.r * DRESS.rootsPerM);
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2 + rnd() * 0.2, r = isle.r * (0.9 + rnd() * 0.06);
      roots.push({ x: isle.x + Math.cos(a) * r, y: isle.y - 1.1, z: isle.z + Math.sin(a) * r, s: 1.5 + rnd() * 4.5, yaw: rnd() * 6.28 });
    }
  }
  const group = new Group(), meshes: InstancedMesh[] = [];
  /** `long`: the item's scale is its length only (roots); otherwise uniform, `squash` flattening y */
  const place = (mesh: InstancedMesh, list: readonly Place[], squash = 1, long = false): void => {
    list.forEach((it, i) => { q.setFromAxisAngle(up, it.yaw); m.compose(p.set(it.x, it.y, it.z), q, long ? s.set(1, it.s, 1) : s.set(it.s, it.s * squash, it.s)); mesh.setMatrixAt(i, m); });
    mesh.computeBoundingSphere(); mesh.computeBoundingBox(); group.add(mesh); meshes.push(mesh);
  };
  place(new InstancedMesh(clumpGeometry(), new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 1, metalness: 0 }), clumps.length), clumps);
  const flowerMesh = new InstancedMesh(flowerGeometry(), new MeshStandardMaterial({ side: DoubleSide, roughness: 1, metalness: 0, emissive: 0x2a2418 }), flowers.length);
  place(flowerMesh, flowers); const fc = new Color(); flowers.forEach((f, i) => { flowerMesh.setColorAt(i, fc.setHex(f.c)); });
  place(new InstancedMesh(new IcosahedronGeometry(1, 0), new MeshStandardMaterial({ color: 0x9a8a7e, flatShading: true, roughness: 0.95, metalness: 0 }), stones.length), stones, 0.55);
  // a strand 1 m long, tip down: its wide end at y 0 hangs from the rim band; instances stretch it to their length
  const strand = new ConeGeometry(0.11, 1, 4, 1, true); strand.rotateX(Math.PI); strand.translate(0, -0.5, 0);
  place(new InstancedMesh(strand, new MeshStandardMaterial({ color: 0x5b4a33, roughness: 1, metalness: 0, side: DoubleSide }), roots.length), roots, 1, true);
  return { group, meshes };
}
