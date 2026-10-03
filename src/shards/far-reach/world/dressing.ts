import { BufferGeometry, Color, ConeGeometry, DoubleSide, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { PATCH_ORDER, patchShader } from '#engine';
import { paintIsleMaterial } from './isle';
import { DECK, ISLES, SPANS, SPAWN, apothem, type Isle } from '../layout';

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
/** `handoff`: the camera distance (m) over which a clump grows back in, where the near meadow's blades thin out (MEADOW.range). */
export const DRESS = { clumpsPerM2: 1.1, flowersPerM2: 0.14, stonesPerIsle: 9, rootsPerM: 2.2, lipPerM: 0.9, cragsPerIsle: 4, bridgeClear: 0.3, handoff: [15, 22] } as const;

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

/** A boulder: a subdivided icosahedron, lumped by noise, warm grey with moss on its top and lichen spots. */
export function stoneGeometry(): BufferGeometry {
  const g = new IcosahedronGeometry(1, 1).toNonIndexed(), p = g.getAttribute('position'), col: number[] = [];
  const grey = new Color(0x857b78), warm = new Color(0x9f8e7c), moss = new Color(0x5f6e32), dark = new Color(0x5a5060), c = new Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = Math.sin(x * 3.1 + z * 2.3) * 0.5 + Math.sin(y * 4.7 - x * 1.9) * 0.5;
    const k = 1 + 0.16 * n; p.setXYZ(i, x * k, y * k, z * k);
    c.copy(grey).lerp(warm, 0.5 + 0.5 * n).lerp(dark, Math.max(0, -y) * 0.6);
    if (y > 0.45) c.lerp(moss, Math.min(1, (y - 0.45) * 2.2));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}

/** True when (x, z) lies on a bridge's lane, or within 3 m past either end of it (kept clear so the walkway reads). */
function onLane(x: number, z: number): boolean {
  for (const s of SPANS) {
    const dx = s.x1 - s.x0, dz = s.z1 - s.z0, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
    const along = (x - s.x0) * ux + (z - s.z0) * uz, across = Math.abs((x - s.x0) * -uz + (z - s.z0) * ux);
    if (along > -3 && along < len + 3 && across < s.width / 2 + DRESS.bridgeClear) return true;
  }
  return false;
}

interface Place { x: number; y: number; z: number; s: number; yaw: number }

export interface Dressing { readonly group: Group; readonly meshes: readonly InstancedMesh[] }

/** `density` scales the clumps and flowers (the far sky isles take less: they are seen from afar). */
export function dressIslands(isles: readonly Isle[] = ISLES, seed = 6417, landings = true, density = 1): Dressing {
  const rnd = seeded(seed), m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), s = new Vector3(), p = new Vector3();
  const clumps: Place[] = [], flowers: (Place & { c: number })[] = [], stones: Place[] = [], roots: Place[] = [];
  for (const isle of isles) {
    const ap = apothem(isle), area = Math.PI * ap * ap;
    const inside = (k: number): [number, number] => { const r = ap * Math.sqrt(rnd()) * k, a = rnd() * Math.PI * 2; return [isle.x + Math.cos(a) * r, isle.z + Math.sin(a) * r]; };
    for (let i = 0; i < area * DRESS.clumpsPerM2 * density; i++) {
      const [x, z] = inside(0.95); if (onLane(x, z) && rnd() < 0.85) continue;
      clumps.push({ x, y: isle.y, z, s: 0.45 + rnd() * 0.5, yaw: rnd() * 6.28 });
    }
    for (let i = 0; i < area * DRESS.flowersPerM2 * density; i++) {
      const [x, z] = inside(0.94); if (onLane(x, z)) continue;
      // drifts: flowers cluster round a few seeds per island
      flowers.push({ x, y: isle.y, z, s: 0.8 + rnd() * 0.6, yaw: rnd() * 6.28, c: rnd() < 0.6 ? 0xf6f1e4 : 0xf2cf55 });
    }
    for (let i = 0; i < DRESS.stonesPerIsle; i++) {
      const a = rnd() * Math.PI * 2, r = ap * (0.7 + rnd() * 0.26), x = isle.x + Math.cos(a) * r, z = isle.z + Math.sin(a) * r;
      if (onLane(x, z)) continue;
      stones.push({ x, y: isle.y - 0.05, z, s: 0.25 + rnd() * 0.45, yaw: rnd() * 6.28 });
    }
    // rim crags (council R1C-9): big lumped rocks sitting on and over the lip, breaking the rim's silhouette
    for (let i = 0; i < DRESS.cragsPerIsle; i++) {
      const a = rnd() * Math.PI * 2, r = ap * (0.88 + rnd() * 0.1), x = isle.x + Math.cos(a) * r, z = isle.z + Math.sin(a) * r;
      if (onLane(x, z)) continue;
      stones.push({ x, y: isle.y - 0.35, z, s: 0.8 + rnd() * 0.8, yaw: rnd() * 6.28 });
    }
    const ring = Math.round(2 * Math.PI * isle.r * DRESS.rootsPerM);
    for (let i = 0; i < ring; i++) {
      // just outside the lip, so they drape down the outside of the keel instead of inside its bulge
      const a = (i / ring) * Math.PI * 2 + rnd() * 0.2, r = isle.r * (0.99 + rnd() * 0.06);
      roots.push({ x: isle.x + Math.cos(a) * r, y: isle.y - 0.9, z: isle.z + Math.sin(a) * r, s: 1.2 + rnd() ** 2.2 * isle.keel * 0.2, yaw: rnd() * 6.28 });
    }
  }
  // boulders at every rope landing (mockup A: rocks and flowers round the bridge posts), either side of the lane
  for (const sp of landings ? SPANS : []) {
    if (sp.kind !== 'rope') continue;
    const dx = sp.x1 - sp.x0, dz = sp.z1 - sp.z0, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
    // each landing: inward into its own island (back along the span at the start, on past it at the end), either side
    for (const [ex, ez, ey, inward] of [[sp.x0, sp.z0, sp.y, -1], [sp.x1, sp.z1, sp.y1, 1]] as const) {
      for (const side of [-1, 1]) {
        const lat = side * (sp.width / 2 + 1.1 + rnd() * 0.8), back = inward * (1.6 + rnd() * 1.4);
        const x = ex + ux * back - uz * lat, z = ez + uz * back + ux * lat;
        stones.push({ x, y: ey - 0.15, z, s: 0.95 + rnd() * 0.5, yaw: rnd() * 6.28 });
        flowers.push({ x: x + (rnd() - 0.5) * 1.2, y: ey, z: z + (rnd() - 0.5) * 1.2, s: 1, yaw: rnd() * 6.28, c: 0xf6f1e4 });
      }
    }
  }
  // the spawn meadow's boulders (E392, mockup A): a few mossy rocks in the lower third, off the walk to the bridge
  if (landings) for (const [dx, dz, sc] of [[-3.4, -6.4, 1.3], [-5.2, -4.8, 1.0], [3.7, -6.0, 1.15], [5.6, -4.2, 1.4], [-6.4, -7.6, 0.8]] as const) {
    stones.push({ x: SPAWN.x + dx, y: DECK - 0.2, z: SPAWN.z + dz, s: sc, yaw: rnd() * 6.28 });
    flowers.push({ x: SPAWN.x + dx + 0.8, y: DECK, z: SPAWN.z + dz + 0.6, s: 1, yaw: rnd() * 6.28, c: 0xf2cf55 });
  }
  // the grassy lip (E392, the aerial targets: tops roll over their rim in a fringe of grass): clumps leaning outward
  // round every rim, a little below the deck, tilted over the edge
  const lips: (Place & { tilt: number })[] = [];
  for (const isle of isles) {
    const n = Math.round(2 * Math.PI * isle.r * DRESS.lipPerM * density);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.15, r = apothem(isle) * (0.94 + rnd() * 0.04);
      const x = isle.x + Math.cos(a) * r, z = isle.z + Math.sin(a) * r;
      if (onLane(x, z)) continue;
      lips.push({ x, y: isle.y - 0.2, z, s: 0.5 + rnd() * 0.35, yaw: a, tilt: 0.45 + rnd() * 0.3 });
    }
  }
  const group = new Group(), meshes: InstancedMesh[] = [];
  /** `long`: the item's scale is its length only (roots); otherwise uniform, `squash` flattening y */
  const place = (mesh: InstancedMesh, list: readonly Place[], squash = 1, long = false): void => {
    list.forEach((it, i) => { q.setFromAxisAngle(up, it.yaw); m.compose(p.set(it.x, it.y, it.z), q, long ? s.set(1, it.s, 1) : s.set(it.s, it.s * squash, it.s)); mesh.setMatrixAt(i, m); });
    mesh.computeBoundingSphere(); mesh.computeBoundingBox(); group.add(mesh); meshes.push(mesh);
  };
  // the clumps carry the meadow beyond the near field (world/meadow.ts); inside it they shrink away so the fine blades own the foreground
  const clumpMaterial = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 1, metalness: 0 });
  patchShader(clumpMaterial, 'far.clump-handoff', PATCH_ORDER.decorate, (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      { vec3 farAt = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        transformed *= smoothstep(${DRESS.handoff[0].toFixed(1)}, ${DRESS.handoff[1].toFixed(1)}, distance(farAt.xz, cameraPosition.xz)); }
      #endif`);
  }, { key: (prior) => `${prior}|far.clump-handoff` });
  place(new InstancedMesh(clumpGeometry(), clumpMaterial, clumps.length), clumps);
  // the lip clumps: each turned so its blades lean out over the edge (yaw = the rim angle, then tipped about the tangent)
  const lipMesh = new InstancedMesh(clumpGeometry(), new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 1, metalness: 0 }), lips.length);
  const tq = new Quaternion(), ax = new Vector3();
  lips.forEach((it, i) => {
    ax.set(-Math.sin(it.yaw), 0, Math.cos(it.yaw)); tq.setFromAxisAngle(ax, -it.tilt);
    m.compose(p.set(it.x, it.y, it.z), tq, s.set(it.s * 1.3, it.s, it.s * 1.3)); lipMesh.setMatrixAt(i, m);
  });
  lipMesh.computeBoundingSphere(); group.add(lipMesh); meshes.push(lipMesh);
  const flowerMesh = new InstancedMesh(flowerGeometry(), new MeshStandardMaterial({ side: DoubleSide, roughness: 1, metalness: 0, emissive: 0x2a2418 }), flowers.length);
  place(flowerMesh, flowers); const fc = new Color(); flowers.forEach((f, i) => { flowerMesh.setColorAt(i, fc.setHex(f.c)); });
  // the boulders wear the islands' painted rock and moss (E392: flat olive blobs up close)
  place(new InstancedMesh(stoneGeometry(), paintIsleMaterial(new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 })), stones.length), stones, 0.55);
  // a strand 1 m long, tip down: its wide end at y 0 hangs from the rim band; instances stretch it to their length
  const strand = new ConeGeometry(0.16, 1, 5, 1, true); strand.rotateX(Math.PI); strand.translate(0, -0.5, 0);
  // roots and vines: dark roots with moss-green vine strands among them
  const rootMesh = new InstancedMesh(strand, new MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, side: DoubleSide }), roots.length);
  place(rootMesh, roots, 1, true);
  const rc = new Color(); roots.forEach((_, i) => { rootMesh.setColorAt(i, rc.setHex(i % 5 < 2 ? 0x55703a : (i % 2 ? 0x5b4a33 : 0x6a5640))); });
  return { group, meshes };
}
