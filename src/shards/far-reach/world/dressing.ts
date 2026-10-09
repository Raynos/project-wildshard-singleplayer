import { Color, ConeGeometry, DoubleSide, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { paintIsleMaterial } from './isle';
import { skyBakedGeometry } from './baked';
import { meadowHoles, meadowPaths } from './meadow';
import { DECK, FALLEN_BRIDGE, HIGH, ISLES, SPANS, STEP, UPDRAFT, type Isle, type Span } from '../data/layout';
import { apothem, knollHeight } from '../layout';

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
/** `handoff`: the camera distance (m) over which a clump grows back in, where the near meadow's blades thin out (MEADOW.range); `flowerHandoff` the same for a flower; `rockGroupsPerM2` the meadow's scattered rock groups (`meadowRocks`). */
export const DRESS = { clumpsPerM2: 1.6, flowersPerM2: 0.07, stonesPerIsle: 9, rootsPerM: 0, lipPerM: 0.9, cragsPerIsle: 0, bridgeClear: 0.3, handoff: [15, 22], flowerHandoff: [9, 13], rockGroupsPerM2: 0.006 } as const;

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Every lane a walker or a rider crosses: the bridges, the updraft and the fallen bridge (its walk once raised). */
const LANES: readonly Span[] = [...SPANS, UPDRAFT, FALLEN_BRIDGE];

/**
 * True when a boulder of radius `r` at (x, z) keeps clear of every walk: a metre off each lane (and 3 m past its ends),
 * off the worn paths in from the landings, and outside every structure's clearing.
 */
export function clearOfWalks(x: number, z: number, r: number): boolean {
  for (const s of LANES) {
    const dx = s.x1 - s.x0, dz = s.z1 - s.z0, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
    const along = (x - s.x0) * ux + (z - s.z0) * uz, across = Math.abs((x - s.x0) * -uz + (z - s.z0) * ux);
    if (along > -3 - r && along < len + 3 + r && across < s.width / 2 + 1 + r) return false;
  }
  for (const s of meadowPaths()) {
    const ax = s.z - s.x, az = s.w - s.y, t = Math.max(0, Math.min(1, ((x - s.x) * ax + (z - s.y) * az) / Math.max(1e-6, ax * ax + az * az)));
    if (Math.hypot(x - s.x - ax * t, z - s.y - az * t) < 1.2 + r) return false;
  }
  for (const h of meadowHoles()) if (h.w < 0.5 && Math.hypot(x - h.x, z - h.y) < h.z + 0.5 + r) return false;
  return true;
}

/**
 * The hero spots' foreground boulders (E392, mockups A-D: mossy grey rocks embedded at the screen's edges): world x, z,
 * the deck they sit on, their scale and how far they stand above the grass (≤ 0.5 m, so no collider: you step over).
 * Each is checked against `clearOfWalks`; one that fails is dropped.
 */
export const HERO_STONES: readonly (readonly [number, number, number, number, number])[] = [
  // the spawn bridge head (E399, mockup A: mossy boulders at the posts' feet, either side of the lane)
  // (just outside the keeper's clearing and the bridge lane's 1 m margin, which dropped the first spots)
  [-4.2, -11.0, DECK, 1.15, 0.5], [2.6, -9.4, DECK, 0.7, 0.32], [-3.1, -8.9, DECK, 0.6, 0.26],
  // the spawn meadow, looking west (H1 left): a big rock left of centre, a low outcrop at your feet
  [-4.2, -7.9, DECK, 1.1, 0.5], [-2.6, -8.5, DECK, 0.75, 0.3], [-3.3, -10.1, DECK, 0.5, 0.22],
  // looking east (H1 right): an outcrop on the left edge, a rock in the bottom middle
  [2.5, -8.9, DECK, 0.6, 0.28],
  // the windmill isle's west lip (H2 left): rocks bottom left and a ledge on the right
  [-10.8, -54.6, DECK, 0.8, 0.3], [-9.8, -55.3, DECK, 0.55, 0.25], [-12.6, -58.1, DECK, 1.0, 0.45],
  // the high step (H3 front): right of the walk from the updraft to the crown bridge
  [STEP.x + 3.8, STEP.z + 1.7, HIGH, 0.9, 0.42], [STEP.x + 3.1, STEP.z + 3.4, HIGH, 0.55, 0.25],
  // the crown's south lip (H4 left): either side of the view, beyond the walk in from the bridge
  [-5.8, -172.6, HIGH, 0.9, 0.42], [-5.8, -175.9, HIGH, 1.1, 0.5],
  // ahead of the entrance, either side of the walk to the dais (E399 mockup D: mossy rocks in the meadow's foreground)
  [-3.6, -181.4, HIGH, 1.0, 0.45], [-4.8, -183.2, HIGH, 0.6, 0.28], [3.9, -182.0, HIGH, 0.8, 0.36],
  // round 6 (seat A: 'lichened arena rocks'; mockup D's lower left and right): down the crown rise's north slope, in the
  // frame from its top (the rocks above sat outside it once D stood on the rise)
  // (round 7, seats B and C: at 6-8 m out they sat under the fan and the bottom HUD; mockup D's are 9-15 m ahead, left of the
  // walk and at the right edge)
  [-2.4, -186.0, HIGH, 1.15, 0.5], [-3.6, -188.8, HIGH, 0.8, 0.38], [3.2, -188.5, HIGH, 0.95, 0.45],
  // and mockup B's lower left: rocks in the spawn meadow below the keeper, 3-4 m ahead of the quest-start view
  // (round 8: 2.6-3.9 m from B's camera they swamped the frame; mockup B's are 4-6 m out, smaller, lit on top)
  [-2.4, -9.6, DECK, 0.75, 0.36], [-1.0, -10.6, DECK, 0.5, 0.24],
];

/**
 * The meadow's scattered rocks (E407 row 4; mockups A-D: grey lichened rocks stand out of the grass all through the
 * meadow, not only at the hero spots): small groups placed by noise over every walkable island, each ≤ 0.4 m above the
 * grass (no collider), clear of every walk and of each other. World x, z, the deck, scale, height over the grass.
 */
export function meadowRocks(isles: readonly Isle[] = ISLES): (readonly [number, number, number, number, number])[] {
  const rnd = seeded(9137), out: [number, number, number, number, number][] = [];
  const taken = HERO_STONES.map(([x, z, , sc]) => [x, z, sc] as const);
  for (const isle of isles) {
    const ap = apothem(isle), groups = Math.round(Math.PI * ap * ap * DRESS.rockGroupsPerM2);
    for (let g = 0; g < groups; g++) {
      const gr = ap * (0.25 + 0.6 * Math.sqrt(rnd())), ga = rnd() * Math.PI * 2, gx = isle.x + Math.cos(ga) * gr, gz = isle.z + Math.sin(ga) * gr;
      const n = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const x = gx + (rnd() - 0.5) * 2.4, z = gz + (rnd() - 0.5) * 2.4, sc = (i === 0 ? 0.45 : 0.28) + rnd() * 0.3, top = Math.min(0.4, sc * (0.3 + 0.25 * rnd()));
        if (Math.hypot(x - isle.x, z - isle.z) > ap * 0.88 || !clearOfWalks(x, z, sc * 1.2)) continue;
        if (taken.some(([tx, tz, ts]) => Math.hypot(x - tx, z - tz) < (sc + ts) * 1.1)) continue;
        taken.push([x, z, sc]); out.push([x, z, isle.y, sc, top]);
      }
    }
  }
  return out;
}

/**
 * The hero boulders and the meadow's larger rocks that are placed (clear of every walk), as discs for the meadow's short
 * grass round them (each disc is a loop step for every blade in the meadow's vertex shader: the small rocks go without).
 */
export function heroStoneDiscs(): [number, number, number][] {
  return [...HERO_STONES.filter(([x, z, , sc]) => clearOfWalks(x, z, sc * 1.2)), ...meadowRocks().filter((rock) => rock[3] >= 0.55)].map(([x, z, , sc]) => [x, z, sc * 0.75]);
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
/** A boulder's height to width (they are low, lumped mounds). */
const STONE_SQUASH = 0.68;

export interface Dressing { readonly group: Group; readonly meshes: readonly InstancedMesh[] }

/** `density` scales the clumps and flowers (the far sky isles take less: they are seen from afar). */
export function dressIslands(isles: readonly Isle[] = ISLES, seed = 6417, landings = true, density = 1): Dressing {
  const rnd = seeded(seed), m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), s = new Vector3(), p = new Vector3();
  const clumps: Place[] = [], flowers: (Place & { c: number })[] = [], stones: Place[] = [], roots: Place[] = [];
  // no clump in a clearing or a short-grass disc (round 13, seat A 6: clumps grew across the crown dais' compass and paving)
  const clearings = meadowHoles(), cleared = (x: number, z: number): boolean => clearings.some((h) => Math.hypot(x - h.x, z - h.y) < h.z);
  for (const isle of isles) {
    const ap = apothem(isle), area = Math.PI * ap * ap;
    const inside = (k: number): [number, number] => { const r = ap * Math.sqrt(rnd()) * k, a = rnd() * Math.PI * 2; return [isle.x + Math.cos(a) * r, isle.z + Math.sin(a) * r]; };
    for (let i = 0; i < area * DRESS.clumpsPerM2 * density; i++) {
      const [x, z] = inside(0.95); if (onLane(x, z) && rnd() < 0.85) continue;
      // on the rises too (round 7: placed at the deck's height they sat buried inside the rises, which read bald from afar)
      const clump = { x, y: isle.y + knollHeight(x, z), z, s: 0.45 + rnd() * 0.5, yaw: rnd() * 6.28 };
      if (!cleared(x, z)) clumps.push(clump);
    }
    // drifts: flowers cluster round a few seeds per island, each drift mostly daisies or mostly buttercups
    const seeds = Array.from({ length: 6 }, () => { const [x, z] = inside(0.85); return { x, z, gold: rnd() < 0.35 }; });
    for (let i = 0; i < area * DRESS.flowersPerM2 * density; i++) {
      const drift = seeds[i % seeds.length]; if (drift === undefined) continue;
      const rr = 2.8 * Math.sqrt(-Math.log(1 - rnd() * 0.95)), aa = rnd() * Math.PI * 2, x = drift.x + Math.cos(aa) * rr, z = drift.z + Math.sin(aa) * rr;
      if (Math.hypot(x - isle.x, z - isle.z) > ap * 0.92 || onLane(x, z)) continue;
      flowers.push({ x, y: isle.y + knollHeight(x, z), z, s: 0.8 + rnd() * 0.5, yaw: rnd() * 6.28, c: (rnd() < 0.8) === drift.gold ? 0xf2c43a : 0xffffff });
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
  const holes = meadowHoles().filter((h) => h.w < 0.5); // the true clearings, not the short-grass discs
  for (const sp of landings ? SPANS : []) {
    if (sp.kind !== 'rope') continue;
    const dx = sp.x1 - sp.x0, dz = sp.z1 - sp.z0, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
    // each landing: inward into its own island (back along the span at the start, on past it at the end), either side
    for (const [ex, ez, ey, inward] of [[sp.x0, sp.z0, sp.y, -1], [sp.x1, sp.z1, sp.y1, 1]] as const) {
      for (const side of [-1, 1]) {
        const lat = side * (sp.width / 2 + 1.1 + rnd() * 0.8), back = inward * (1.6 + rnd() * 1.4);
        const x = ex + ux * back - uz * lat, z = ez + uz * back + ux * lat, sc = 0.55 + rnd() * 0.3;
        // never under the keeper, his stand or a structure's clearing (E399: the keeper stood up on one)
        if (holes.some((h) => Math.hypot(x - h.x, z - h.y) < h.z + sc + 0.3)) continue;
        // (E399 round 6: at 0.95-1.45, sunk 0.15 m, the one right of Sunrest's landing was a 4 m mossy mound that the meadow
        // paint turned into a bald dome across mock-C's foreground; mockup C's rock is a rough boulder about a metre across)
        stones.push({ x, y: ey, z, s: sc, yaw: rnd() * 6.28 });
        flowers.push({ x: x + (rnd() - 0.5) * 1.2, y: ey, z: z + (rnd() - 0.5) * 1.2, s: 1, yaw: rnd() * 6.28, c: 0xf6f1e4 });
      }
    }
  }
  // the hero spots' foreground boulders, embedded so each stands its own height above the grass
  const stone = skyBakedGeometry('boulder'); stone.computeBoundingBox();
  const stoneTop = (stone.boundingBox?.max.y ?? 1) * STONE_SQUASH;
  if (landings) for (const [x, z, deck, sc, top] of [...HERO_STONES, ...meadowRocks(isles)]) {
    if (!clearOfWalks(x, z, sc * 1.2)) continue;
    stones.push({ x, y: deck + knollHeight(x, z) + top - stoneTop * sc, z, s: sc, yaw: rnd() * 6.28 });
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
  place(new InstancedMesh(skyBakedGeometry('clump'), clumpMaterial, clumps.length), clumps);
  // the lip clumps: each turned so its blades lean out over the edge (yaw = the rim angle, then tipped about the tangent)
  // (E407 row 4: they shrink away near the camera like the clumps, where the near meadow's blades own the rim: up close
  // their wide lime blades stood out of a shorter sward by the bridge heads)
  const lipMesh = new InstancedMesh(skyBakedGeometry('clump'), clumpMaterial, lips.length);
  const tq = new Quaternion(), ax = new Vector3();
  lips.forEach((it, i) => {
    ax.set(-Math.sin(it.yaw), 0, Math.cos(it.yaw)); tq.setFromAxisAngle(ax, -it.tilt);
    m.compose(p.set(it.x, it.y, it.z), tq, s.set(it.s * 1.3, it.s, it.s * 1.3)); lipMesh.setMatrixAt(i, m);
  });
  lipMesh.computeBoundingSphere(); group.add(lipMesh); meshes.push(lipMesh);
  // the near meadow draws its own flowers (world/meadow.ts): these grow in past it, a little larger far off so a drift
  // still reads as white and gold flecks across an island
  const flowerMaterial = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 1, metalness: 0, emissive: 0x2a2418 });
  patchShader(flowerMaterial, 'far.flower-handoff', PATCH_ORDER.decorate, (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      { vec3 farAt = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float farD = distance(farAt.xz, cameraPosition.xz);
        transformed *= smoothstep(${DRESS.flowerHandoff[0].toFixed(1)}, ${DRESS.flowerHandoff[1].toFixed(1)}, farD) * clamp(farD / 12.0, 1.0, 2.2); }
      #endif`);
  }, { key: (prior) => `${prior}|far.flower-handoff` });
  const flowerMesh = new InstancedMesh(skyBakedGeometry('flower'), flowerMaterial, flowers.length);
  place(flowerMesh, flowers); const fc = new Color(); flowers.forEach((f, i) => { flowerMesh.setColorAt(i, fc.setHex(f.c)); });
  // the boulders wear the islands' painted rock and moss (E392: flat olive blobs up close)
  const stoneMaterial = paintIsleMaterial(new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }));
  // the near detail over the islands' paint (E392 foreground: the paint's 8 m rock tile read as a smooth grey blob at
  // 2 m): cracks, lichen flecks and a fuzzy-edged moss cap on the upward facets, at a boulder's own scale
  patchShader(stoneMaterial, 'far.boulder-detail', PATCH_ORDER.decorate + 10, (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `{
      vec3 bw = (inverse(viewMatrix) * vec4(-vViewPosition, 1.0)).xyz;
      vec3 bn = normalize(cross(dFdx(bw), dFdy(bw)));
      vec3 bq = bw * 2.6;
      float n1 = sin(bq.x * 1.7 + bq.z * 2.9) * sin(bq.y * 3.3 - bq.x * 1.1) * 0.5 + 0.5;
      float n2 = sin(bw.x * 7.3 + bw.y * 5.1) * sin(bw.z * 6.7 - bw.y * 4.3) * 0.5 + 0.5;
      float n3 = sin(bw.x * 19.0 - bw.z * 13.0 + bw.y * 7.0) * sin(bw.z * 17.0 + bw.x * 11.0) * 0.5 + 0.5;
      float crack = 1.0 - smoothstep(0.0, 0.07, abs(sin(bw.x * 3.1 + bw.z * 2.3 + sin(bw.y * 4.0) * 1.5)));
      // grey stone from the paint's light and dark (its tint dropped: the paint's moss covers every up face), darker below
      float bl = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
      // (linear values: a mid grey is 0.2, not 0.5)
      vec3 rockC = vec3(0.2, 0.195, 0.185) * (0.55 + 0.9 * bl) * (0.75 + 0.4 * n2) * (0.92 + 0.16 * n1) * (1.0 - 0.5 * crack);
#ifdef FAR_ROCK_TEX
      // the painted cliff rock again, triplanar at a boulder's scale (a 1.4 m tile, not the cliffs' 8 m)
      vec3 btw = pow(abs(bn), vec3(4.0)); btw /= (btw.x + btw.y + btw.z);
      vec3 bt = texture2D(farRock, bw.zy * 0.7).rgb * btw.x + texture2D(farRock, bw.xz * 0.7).rgb * btw.y + texture2D(farRock, bw.xy * 0.7).rgb * btw.z;
      rockC = vec3(dot(bt, vec3(0.3, 0.59, 0.11))) * vec3(1.0, 0.98, 0.94) * (0.8 + 0.4 * n2) * (1.0 - 0.5 * crack);
#endif
      rockC *= 1.0 - 0.35 * smoothstep(0.0, -0.6, bn.y);
      // pale lichen flecks (round 6, seat A: 'lichened rocks'; the mockups' boulders are grey with pale lichen, little moss)
      // (E407 row 4: grey rocks with pale lichen patches standing out of the green; a dark moss cap read as more grass)
      rockC = mix(rockC, vec3(0.42, 0.4, 0.3), smoothstep(0.8, 0.93, n3 * (0.7 + 0.6 * n1)) * 0.4);
      // a moss cap on the flattest tops, its edge broken by noise
      float mossK = smoothstep(0.88, 0.99, bn.y + 0.35 * (n2 - 0.5) + 0.2 * (n1 - 0.5)) * 0.3;
      vec3 mossC = vec3(0.1, 0.12, 0.05) * (0.75 + 0.5 * n3);
      diffuseColor.rgb = mix(rockC, mossC, mossK);
    }
    #include <roughnessmap_fragment>`);
  }, { key: (prior) => `${prior}|far.boulder-detail` });
  place(new InstancedMesh(stone, stoneMaterial, stones.length), stones, STONE_SQUASH);
  // a strand 1 m long, tip down: its wide end at y 0 hangs from the rim band; instances stretch it to their length
  const strand = new ConeGeometry(0.16, 1, 5, 1, true); strand.rotateX(Math.PI); strand.translate(0, -0.5, 0);
  // roots and vines: dark roots with moss-green vine strands among them
  const rootMesh = new InstancedMesh(strand, new MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, side: DoubleSide }), roots.length);
  place(rootMesh, roots, 1, true);
  const rc = new Color(); roots.forEach((_, i) => { rootMesh.setColorAt(i, rc.setHex(i % 5 < 2 ? 0x55703a : (i % 2 ? 0x5b4a33 : 0x6a5640))); });
  return { group, meshes };
}
