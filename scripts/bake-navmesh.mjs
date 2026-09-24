#!/usr/bin/env node
// bake-navmesh.mjs — every shard's navmesh, baked offline (project/archive/2026-09-23-physics.md P6b).
//
// Builds the shard's walkable world in Node exactly as the game builds it — the baked terrain grid (terrain.bin, with the
// sea cave's terrain cut) and the static builders' ColliderDescs (the ones src/main.ts / src/core/bootstrap.ts register:
// forest trunks, path walkways, and per shard the pier / jetties / hut / lookout / wreck / shrine / trailside / bridge /
// cove / palms / shore rocks, or the cabins and props) — triangulates it, and runs navcat's recast pipeline over it for
// each agent class in the shard's layers. Terrain under the water (the sea, the pond: `wetTest`) is left out, so it is
// not walkable. Moving pieces (the boat, the cabin doors) and the hand-made interactable boxes are not in it: the
// character motor still resolves every final move.
//
// Output: public/assets/baked/<slug>/navmesh.bin (format below; src/physics/navmesh.ts reads it) + navmesh.json (the
// input hash and stats). Idempotent by content hash of the input triangles and the options: an unchanged world writes
// nothing. Offline: run it after a builder / terrain change and commit the output.
//
//   node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake-navmesh.mjs [--force] [--check] [slug…]
//
// Format (little-endian): 'WSNM' u32 version=1 · u32 layers · then per layer:
//   f32 radius · f32 height · f32 climb · f32 cellSize · f32 cellHeight · f32 origin[3] · f32 tileSize · u32 tiles · per tile:
//     i32 tileX · i32 tileY · f32 bounds[6] · u32 nVerts · u32 nPolys · u32 nDetailVerts · u32 nDetailTris ·
//     u16[nVerts·3] vertices (1 cm steps above bounds.min) · per poly: u8 nv · u8 area · u16 flags · u16[nv] vertex · u16[nv] neis ·
//     per poly: u32 detail verticesBase · u16 verticesCount · u32 trianglesBase · u16 trianglesCount ·
//     u16[nDetailVerts·3] detail vertices (1 cm, same frame) · u8[nDetailTris·4] detail triangles (3 local indices + edge flags)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const ROOT = resolve(import.meta.dirname, '..');
const force = process.argv.includes('--force');
const check = process.argv.includes('--check');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const VERSION = 1;
const Q = 100; // vertex quantisation: 1 cm
const NEI_EXT = 248; // a one-byte neighbour ≥ this is a portal: 0x8000 | (byte − NEI_EXT)

/**
 * The agent classes per shard: a creature paths on the smallest layer whose radius covers its own (src/physics/navmesh.ts;
 * the largest when none does). Motor capsule radii (src/physics/creatures.ts: min(bodyRadius, bodyHalfLen) × scale): crab
 * 0.22, monkey 0.16, sailor 0.26, captain 0.3, deer / boar 0.33, bear 0.36, elk 0.52. The erosion is whole voxels
 * (cellSize 0.25): round(radius / cellSize) — 0.3 erodes 0.25 m, 0.5 erodes 0.5 m; the motor absorbs the rest. Climb and slope are the motor's (step 0.3 m, the plan's 40°); height is
 * the clearance a creature needs under a deck or a hold's beams. Pine Hollow's herds are all big: one layer — a second
 * would double its ~110 KB (the plan's budget: ≤ 150 KB per shard on the wire); its 1 770 trunks are most of its polys.
 */
const SHARD_LAYERS = {
  'driftwood-isle': [
    { name: 'small', radius: 0.3, height: 1.8, climb: 0.3, slope: 40 }, // crabs, monkeys, sailors, the captain
    { name: 'large', radius: 0.5, height: 1.8, climb: 0.3, slope: 40 }, // boar, deer, bear
  ],
  // Nalati (NALATI-MERGE P3): one layer — wolves 0.16–0.22, sheep, the dog, the leopards 0.17–0.26, the mares 0.29–0.31;
  // the stallion (0.32) and Kokbori (0.49) path on it too (a second 0.5 m layer is +88 KB brotli: 216 KB, past the
  // budget). Climb 0.4: recast calls a cell a ledge when its neighbours' floors span more than the climb, and across two
  // 0.25 m cells that caps the slope at atan(climb / 0.5) — 31° at 0.3, where Nalati's roads and knolls run 32–39°
  // (the bridge's own north approach is 34°); 0.4 walks to ~38.7°, 5 cm over the motors' step
  'nalati-grasslands': [{ name: 'small', radius: 0.3, height: 1.8, climb: 0.4, slope: 40 }],
  default: [{ name: 'large', radius: 0.5, height: 1.8, climb: 0.3, slope: 40 }],
};
const layersFor = (slug) => JSON.parse(process.env.NAVMESH_LAYERS ?? 'null') ?? SHARD_LAYERS[slug] ?? SHARD_LAYERS.default;
/** recast's knobs (navcat README's table); simplification and detail error are loose — the ground's height comes from
 *  heightAt / the motor, the navmesh only has to say where a creature can go */
const GEN = { cellSize: 0.25, cellHeight: 0.1, tileSizeVoxels: 128, minRegionArea: 24, mergeRegionArea: 64, maxSimplificationError: 2.0, maxEdgeLength: 24, maxVerticesPerPoly: 6, detailSampleDistance: 3, detailSampleMaxError: 0.8, ...JSON.parse(process.env.NAVMESH_GEN ?? '{}') };

// ── the game's modules in Node: a DOM that draws nothing, /assets read from public/ ──────────────────────────────────
const noop = () => undefined;
const ctx2d = new Proxy({}, { get: (_t, k) => k === 'createImageData' || k === 'getImageData' ? (w = 1, h = 1) => ({ data: new Uint8ClampedArray(4 * w * h), width: w, height: h }) : k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern' ? () => ({ addColorStop: noop }) : k === 'measureText' ? () => ({ width: 1 }) : noop, set: () => true });
const el = () => ({ width: 1, height: 1, style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, dataset: {},
  getContext: () => ctx2d, append: noop, appendChild: noop, remove: noop, insertBefore: noop, setAttribute: noop, addEventListener: noop, removeEventListener: noop,
  querySelector: () => el(), querySelectorAll: () => [], parentNode: null, textContent: '', innerHTML: '' });
const HOST = 'http://localhost/';
const NodeRequest = globalThis.Request, nodeFetch = globalThis.fetch;
Object.assign(globalThis, {
  location: new URL(HOST), self: globalThis,
  document: { createElement: el, createElementNS: el, getElementById: () => null, head: el(), body: el(), addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], pointerLockElement: null },
  window: { addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900, matchMedia: () => ({ matches: false, addEventListener: noop }), location: new URL(HOST) },
  // three's loaders build Requests from site-relative URLs
  Request: class extends NodeRequest { constructor(input, init) { super(typeof input === 'string' ? new URL(input, HOST).href : input, init); } },
  fetch: (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, HOST);
    if (url.origin !== new URL(HOST).origin) return nodeFetch(input, init);
    const file = resolve(ROOT, 'public', decodeURIComponent(url.pathname).replace(/^\//, ''));
    return Promise.resolve(existsSync(file) ? new Response(readFileSync(file)) : new Response(null, { status: 404 }));
  },
  createImageBitmap: () => Promise.resolve({ width: 1, height: 1, close: noop }), // textures are never drawn here
  ProgressEvent: class extends Event { constructor(type, init = {}) { super(type); Object.assign(this, init); } },
});
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', maxTouchPoints: 0, hardwareConcurrency: 8 }, configurable: true });
const src = (p) => import(pathToFileURL(resolve(ROOT, 'src', p)).href);

const THREE = await import('three');
const { ConvexHull } = await import('three/examples/jsm/math/ConvexHull.js');
const { generateTiledNavMesh } = await import('navcat/blocks');
const registry = await src('chunks/registry.ts');
const HF = await src('world/Heightfield.ts');
const BT = await src('world/BakedTerrain.ts');
const { CHUNK_HALF, ROAD_LENGTH, TERRAIN_RES, CHUNK_SIZE } = await src('core/config.ts');
const { terrainGrid } = await src('physics/terrain.ts');
const { treadBoxes } = await src('physics/pieces.ts');
const { pathRampDescs } = await src('physics/paths.ts');
const { placeForest, TREE_SPECS } = await src('world/placement.ts');
const { Forest } = await src('world/Forest.ts');

const sky = new Proxy({ setupMaterial: noop, csm: { lights: [] }, viewCamera: new THREE.PerspectiveCamera(), sunDir: new THREE.Vector3(0, 1, 0) },
  { get: (t, k) => k in t ? t[k] : typeof k === 'string' && k.endsWith('Color') ? new THREE.Color(1, 1, 1) : typeof k === 'string' && k.endsWith('Dir') ? new THREE.Vector3(0, 1, 0) : undefined });

// ── the shard's static colliders, as main.ts / bootstrap.ts register them ────────────────────────────────────────────
async function shardColliders(def) {
  const out = [], cuts = [], counts = {};
  let group = '';
  const add = (descs) => { for (const d of descs) out.push(d); counts[group] = (counts[group] ?? 0) + descs.length; };
  // bootstrap.ts: the forest's trunks and the path walkways
  const forest = def.trees.factory === 'none' ? { trees: [], grid: null } : placeForest(TREE_SPECS.map((s) => ({ trunkRadius: s.trunk, height: s.height })));
  group = 'trunks';
  add(Forest.prototype.colliderDescs.call({ trees: forest.trees }));
  if (def.style === 'painterly') return nalatiColliders(forest, { out, cuts, counts, add, setGroup: (g) => { group = g; } });
  group = 'paths';
  add(pathRampDescs(HF.TRAILS, (x, z) => HF.heightAt(x, z), (x, z) => HF.normalAt(x, z)[1]));
  const sea = def.ocean;
  group = 'builders';
  if (sea) {
    // main.ts's `edge` step (the boat rides the swell: a moving piece, not in the bake)
    const DI = await src('chunks/driftwood-isle.ts');
    const [{ Pier }, { Boulders }, { Hut }, { Lookout }, { Wreck }, { Shrine }, { Trailside }, { RopeBridge }, { Cove }, { Palms }] = await Promise.all(
      ['Pier', 'Boulders', 'Hut', 'Lookout', 'Wreck', 'Shrine', 'Trailside', 'RopeBridge', 'Cove', 'Palms'].map((m) => src(`world/${m}.ts`)));
    add(new Pier(sky, { x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckY: sea.level + 1.2, landing: true }).build().colliderDescs());
    add(new Boulders(sky).build(Boulders.scatterShore(def.seed)).colliderDescs());
    add(new Hut(sky, DI.HUT).build().colliderDescs());
    add(new Lookout(sky, DI.LOOKOUT).build().colliderDescs());
    add(new Wreck(sky, DI.WRECK).build().colliderDescs());
    add(new Shrine(sky, DI.SHRINE).build().colliderDescs());
    for (const j of DI.JETTIES) add(new Pier(sky, { x: j.x, z: j.z, rot: j.rot, length: j.length, width: 3, deckY: sea.level + 1.2 }).build().colliderDescs());
    const AVOID = [{ x: DI.HUT.x, z: DI.HUT.z, r: 11 }, { x: DI.LOOKOUT.x, z: DI.LOOKOUT.z, r: 12 }, { x: DI.SHRINE.x, z: DI.SHRINE.z, r: 13 }, { x: DI.WRECK.x, z: DI.WRECK.z, r: 14 }];
    add(new Trailside(sky).build(Trailside.forIsland()).colliderDescs());
    const bridge = new RopeBridge(sky, DI.BRIDGE).build();
    add([...bridge.colliderDescs(), ...bridge.deckDescs()]); // the deck is a RopeChain in the game; the bake walks it at rest
    const cove = new Cove(sky).build(Cove.forIsland());
    add(cove.colliderDescs());
    cuts.push(...cove.terrainCuts());
    add(new Palms(sky).build(Palms.scatterIsland(def.seed, undefined, AVOID)).colliderDescs());
  } else {
    // main.ts's `cabins` and `props` steps (the doors swing: moving pieces, not in the bake)
    const [{ Cabins }, { Props }] = await Promise.all([src('world/Cabin.ts'), src('world/Props.ts')]);
    const cabins = new Cabins(sky);
    await cabins.build();
    add(cabins.colliderDescs());
    const grid = forest.grid;
    const props = new Props(sky, { trees: forest.trees, nearby: (x, z, r) => grid ? grid.nearby(x, z, r) : [], onViewChange: noop });
    await props.build();
    add(props.colliderDescs());
  }
  return { colliders: out, cuts, counts };
}

/**
 * Nalati (NALATI-MERGE P3): src/nalati/index.ts's static world as it registers it — the granite outcrops, the crag rock,
 * every POI (src/world/nalati: the camp, the bridge's deck + ramps, the fences, the summer camp, the kurgans, Eagle Rock,
 * the cairn, the crags + the cave porch, the watchtower …) and the dressing (boulders, logs, the camp clutter) — into a
 * registry of its own, read back piece by piece; then main.ts's paths, laid where no deck carries them. Moving pieces
 * (the balbals, `follows`) and the kurgan dungeon (a sealed room at y 140 the boss walks by itself) are not in it.
 */
async function nalatiColliders(forest, { out, cuts, counts, add, setGroup }) {
  const { WorldRegistry } = await src('world/registry.ts');
  const { registerChunked } = await src('world/nalati/solid.ts');
  const [{ buildOutcrops }, { buildCragRock }, { NalatiPOIs }, { NalatiDressing }] = await Promise.all(
    ['nalati/outcrops.ts', 'nalati/cragRock.ts', 'world/nalati/index.ts', 'world/nalati/dressing/index.ts'].map((m) => src(m)));
  const reg = new WorldRegistry(), none = () => Promise.resolve();
  const outcrops = buildOutcrops(sky);
  await registerChunked(reg, { id: 'nalati-outcrops', name: 'Granite outcrops', category: 'nature', file: 'src/nalati/outcrops.ts', colliders: outcrops.descs, surface: 'rock' }, 200, none);
  const crags = buildCragRock(sky);
  await registerChunked(reg, { id: 'nalati-crag-rock', name: 'Crag rock', category: 'nature', file: 'src/nalati/cragRock.ts', colliders: crags.descs, surface: 'rock' }, 150, none);
  const pois = new NalatiPOIs(sky).build();
  pois.addTo(new THREE.Group(), {}, reg);
  const grid = forest.grid;
  const dressing = await new NalatiDressing(sky, { trees: forest.trees, nearby: (x, z, r) => grid ? grid.nearby(x, z, r) : [] }).build();
  dressing.addTo(new THREE.Group(), [...pois.colliders, ...outcrops.colliders, ...crags.colliders]);
  await dressing.place(reg, none);
  for (const p of reg.pieces) {
    if (p.follows || !p.colliders) continue;
    setGroup(p.id.replace(/^nalati-/, '').replace(/-\d+$/, ''));
    add(p.colliders);
  }
  setGroup('paths');
  add(pathRampDescs(HF.TRAILS, (x, z) => HF.heightAt(x, z), (x, z) => HF.normalAt(x, z)[1], { carried: (x, z) => reg.floorAt(x, z) !== undefined }));
  return { colliders: out, cuts, counts };
}

// ── triangles ────────────────────────────────────────────────────────────────────────────────────────────────────────
class Soup {
  positions = []; indices = [];
  vert(x, y, z) { this.positions.push(x, y, z); return this.positions.length / 3 - 1; }
  /** a triangle facing up (+Y normal) — recast's walkable test is the normal's y */
  tri(a, b, c) { this.indices.push(a, b, c); }
  /** a face of a convex solid, wound to face away from `centre` */
  solidTri(a, b, c, centre) {
    const P = this.positions, ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az, vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (ax + P[b * 3] + P[c * 3]) / 3 - centre.x, my = (ay + P[b * 3 + 1] + P[c * 3 + 1]) / 3 - centre.y, mz = (az + P[b * 3 + 2] + P[c * 3 + 2]) / 3 - centre.z;
    if (nx * mx + ny * my + nz * mz >= 0) this.indices.push(a, b, c); else this.indices.push(a, c, b);
  }
  /** a convex solid from its points (world space): the hull's faces */
  convex(points) {
    if (points.length < 4) return;
    const hull = new ConvexHull().setFromPoints(points);
    const centre = new THREE.Vector3();
    for (const p of points) centre.add(p);
    centre.divideScalar(points.length);
    for (const f of hull.faces) {
      const vs = []; let e = f.edge;
      do { vs.push(e.head().point); e = e.next; } while (e !== f.edge);
      const ids = vs.map((p) => this.vert(p.x, p.y, p.z));
      for (let i = 1; i + 1 < ids.length; i++) this.solidTri(ids[0], ids[i], ids[i + 1], centre);
    }
  }
}

const _q = new THREE.Quaternion();
function orient(d) {
  if (d.rot) return _q.set(d.rot.x, d.rot.y, d.rot.z, d.rot.w);
  return _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.yaw ?? 0);
}

/** One ColliderDesc into the soup, as a closed solid. */
function addDesc(soup, d) {
  if (d.kind === 'treads') { for (const b of treadBoxes(d)) addDesc(soup, b); return; }
  const q = orient(d).clone(), c = new THREE.Vector3(d.x, d.y, d.z);
  const at = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(c);
  switch (d.kind) {
    case 'box': {
      const pts = [];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) pts.push(at(sx * d.hx, sy * d.hy, sz * d.hz));
      soup.convex(pts);
      return;
    }
    case 'capsule': case 'ball': {
      // an octagonal prism round the axis, capped a radius past each end (a ball: the same, zero length)
      const hh = d.kind === 'capsule' ? d.halfHeight : 0, r = d.radius, pts = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
        pts.push(at(x, hh, z), at(x, -hh, z));
      }
      pts.push(at(0, hh + r, 0), at(0, -hh - r, 0));
      soup.convex(pts);
      return;
    }
    case 'hull': {
      const pts = [];
      for (let i = 0; i < d.points.length; i += 3) pts.push(at(d.points[i], d.points[i + 1], d.points[i + 2]));
      soup.convex(pts);
      return;
    }
    case 'trimesh': {
      // a floor you walk inside or over: every triangle faces up
      const base = soup.positions.length / 3;
      for (let i = 0; i < d.vertices.length; i += 3) { const p = at(d.vertices[i], d.vertices[i + 1], d.vertices[i + 2]); soup.vert(p.x, p.y, p.z); }
      for (let i = 0; i < d.indices.length; i += 3) {
        const a = base + d.indices[i], b = base + d.indices[i + 1], cc = base + d.indices[i + 2];
        const P = soup.positions;
        const ny = (P[cc * 3] - P[a * 3]) * (P[b * 3 + 2] - P[a * 3 + 2]) - (P[b * 3] - P[a * 3]) * (P[cc * 3 + 2] - P[a * 3 + 2]);
        if (ny >= 0) soup.tri(a, b, cc); else soup.tri(a, cc, b);
      }
      return;
    }
    default: throw new Error(`bake-navmesh: unknown collider kind ${d.kind}`);
  }
}

/**
 * Where the ground is under water: the sea (an ocean shard) or the pond — inside the square src/world/Water.ts draws
 * (2r + 30 m across) and below its surface; 0.25 m of margin, as AnimalManager's `isDry`. (A pond shard's valleys lower
 * than the pond elsewhere are dry land: no water is drawn there, though `isDry` still calls them wet.)
 */
async function wetTest(def) {
  const wl = HF.waterLevel() + 0.25;
  if (def.ocean) return (_x, _z, y) => y <= wl;
  if (def.style === 'painterly') {
    // Nalati: the Kunes' whole braided corridor (channels + gravel bars) and the plateau brook's bed — what the animals
    // call water (src/nalati/wet.ts, AnimalManager.wetAt) — but a road through the corridor's margin (the N road onto
    // the bridge) stays walkable above the water line, or the bridge's ends would stand in a hole
    const { nalatiWetAt } = await src('nalati/wet.ts');
    return (x, z, y) => y <= wl || (nalatiWetAt(x, z) && HF.trailDistance(x, z) > 3.5);
  }
  if (!HF.hasPond()) return () => false;
  const P = HF.POND, half = P.r + 15;
  return (x, z, y) => y <= wl && Math.abs(x - P.x) <= half && Math.abs(z - P.z) <= half;
}

/** The physics ground's triangles (src/physics/terrain.ts: the mesh's vertices, the (x0,z1)–(x1,z0) diagonal), dry ones only. */
function addTerrain(soup, cuts, wet) {
  const res = TERRAIN_RES, size = CHUNK_SIZE, d = size / (res - 1), half = size / 2;
  const grid = terrainGrid(res, size);
  for (const c of cuts) { // cutTerrain's rule: vertices inside the cut (grown by a cell) sit at or below `below`
    const cos = Math.cos(c.yaw), sin = Math.sin(c.yaw);
    for (let iz = 0; iz < res; iz++) for (let ix = 0; ix < res; ix++) {
      const dx = ix * d - half - c.x, dz = iz * d - half - c.z, lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
      if (Math.abs(lx) <= c.hw + d && Math.abs(lz) <= c.hd + d && grid[iz * res + ix] > c.below) grid[iz * res + ix] = c.below;
    }
  }
  const base = soup.positions.length / 3;
  for (let iz = 0; iz < res; iz++) for (let ix = 0; ix < res; ix++) soup.vert(ix * d - half, grid[iz * res + ix], iz * d - half);
  let dropped = 0;
  const tri = (a, b, c) => {
    const P = soup.positions, m = (k) => (P[(base + a) * 3 + k] + P[(base + b) * 3 + k] + P[(base + c) * 3 + k]) / 3;
    if (wet(m(0), m(2), m(1))) { dropped++; return; }
    soup.tri(base + a, base + b, base + c);
  };
  for (let iz = 0; iz < res - 1; iz++) for (let ix = 0; ix < res - 1; ix++) {
    const i00 = iz * res + ix, i10 = i00 + 1, i01 = i00 + res, i11 = i01 + 1;
    tri(i00, i01, i10); // up-facing: (x0,z0) → (x0,z1) → (x1,z0)
    tri(i10, i01, i11);
  }
  return dropped;
}

// ── generation (navcat/blocks' tiled preset) ─────────────────────────────────────────────────────────────────────────
function generate(soup, layer) {
  const { cellSize, cellHeight, tileSizeVoxels } = GEN;
  const walkableRadiusVoxels = Math.max(1, Math.round(layer.radius / cellSize));
  const opts = {
    cellSize, cellHeight, tileSizeVoxels, tileSizeWorld: tileSizeVoxels * cellSize,
    walkableRadiusVoxels, walkableRadiusWorld: layer.radius,
    walkableClimbVoxels: Math.floor(layer.climb / cellHeight + 1e-6), walkableClimbWorld: layer.climb,
    walkableHeightVoxels: Math.ceil(layer.height / cellHeight - 1e-6), walkableHeightWorld: layer.height,
    walkableSlopeAngleDegrees: layer.slope, borderSize: walkableRadiusVoxels + 3,
    minRegionArea: GEN.minRegionArea, mergeRegionArea: GEN.mergeRegionArea, maxSimplificationError: GEN.maxSimplificationError,
    maxEdgeLength: Math.round(GEN.maxEdgeLength / cellSize), maxVerticesPerPoly: GEN.maxVerticesPerPoly,
    detailSampleDistance: GEN.detailSampleDistance, detailSampleMaxError: GEN.detailSampleMaxError,
  };
  return generateTiledNavMesh({ positions: soup.positions, indices: soup.indices }, opts).navMesh;
}

// ── the file ─────────────────────────────────────────────────────────────────────────────────────────────────────────
class Writer {
  buf = new DataView(new ArrayBuffer(1 << 20)); at = 0;
  room(n) { if (this.at + n <= this.buf.byteLength) return; const next = new DataView(new ArrayBuffer(Math.max(this.buf.byteLength * 2, this.at + n))); new Uint8Array(next.buffer).set(new Uint8Array(this.buf.buffer, 0, this.at)); this.buf = next; }
  u8(...vs) { this.room(vs.length); for (const v of vs) { if (!(v >= 0 && v <= 0xff)) throw new Error(`bake-navmesh: ${v} is not a u8`); this.buf.setUint8(this.at++, v); } }
  u16(...vs) { this.room(vs.length * 2); for (const v of vs) { if (!(v >= 0 && v <= 0xffff)) throw new Error(`bake-navmesh: ${v} is not a u16`); this.buf.setUint16(this.at, v, true); this.at += 2; } }
  u32(...vs) { this.room(vs.length * 4); for (const v of vs) { this.buf.setUint32(this.at, v, true); this.at += 4; } }
  i32(...vs) { this.room(vs.length * 4); for (const v of vs) { this.buf.setInt32(this.at, v, true); this.at += 4; } }
  f32(...vs) { this.room(vs.length * 4); for (const v of vs) { this.buf.setFloat32(this.at, v, true); this.at += 4; } }
  bytes() { return new Uint8Array(this.buf.buffer, 0, this.at); }
}

/** `v` in `step`s above `min`, which must land on the grid (recast's vertices are voxel corners). */
function onGrid(v, min, step) {
  const q = Math.round((v - min) / step);
  if (Math.abs(min + q * step - v) > 1e-3) throw new Error(`bake-navmesh: vertex ${v} is off the ${step} m grid from ${min}`);
  return q;
}

function writeLayer(w, layer, nav) {
  const tiles = Object.values(nav.tiles);
  const { cellSize: cs, cellHeight: ch } = GEN;
  w.f32(layer.radius, layer.height, layer.climb, cs, ch, ...nav.origin, nav.tileWidth);
  w.u32(tiles.length);
  const stats = { tiles: tiles.length, polys: 0, verts: 0, detailVerts: 0, detailTris: 0 };
  for (const t of tiles) {
    const b = t.bounds, nv = t.vertices.length / 3, nd = t.detailVertices.length / 3;
    w.i32(t.tileX, t.tileY); w.f32(...b); w.u16(nv, t.polys.length, nd);
    const V = t.vertices;
    for (let i = 0; i < nv; i++) w.u8(onGrid(V[i * 3], b[0], cs));
    for (let i = 0; i < nv; i++) w.u8(onGrid(V[i * 3 + 2], b[2], cs));
    for (let i = 0; i < nv; i++) w.u16(onGrid(V[i * 3 + 1], b[1], ch));
    w.u8(...t.polys.map((p) => p.vertices.length)); w.u8(...t.polys.map((p) => p.area)); w.u8(...t.polys.map((p) => p.flags));
    const idx = t.polys.flatMap((p) => p.vertices);
    if (nv <= 256) w.u8(...idx); else w.u16(...idx);
    // neighbours: 0 none, i + 1 poly i of this tile, 0x8000 | side a portal to the next tile — one byte when the tile allows
    const neis = t.polys.flatMap((p) => p.neis);
    if (t.polys.length < NEI_EXT) w.u8(...neis.map((n) => (n & 0x8000 ? NEI_EXT + (n & 0xff) : n))); else w.u16(...neis);
    // the detail mesh only where recast added height samples; a poly without is fanned from its own vertices at load
    const keep = [];
    let vb = 0, tb = 0;
    for (const m of t.detailMeshes) {
      if (m.verticesBase !== vb || m.trianglesBase !== tb) throw new Error('bake-navmesh: detail meshes are not in poly order');
      vb += m.verticesCount; tb += m.trianglesCount;
      keep.push(m.verticesCount > 0);
    }
    w.u8(...t.detailMeshes.map((m) => m.verticesCount)); w.u8(...t.detailMeshes.map((m, i) => (keep[i] ? m.trianglesCount : 0)));
    const D = t.detailVertices;
    for (let i = 0; i < D.length; i++) w.u16(Math.round((D[i] - b[i % 3]) * Q));
    let kept = 0;
    t.detailMeshes.forEach((m, i) => { if (keep[i]) { w.u8(...t.detailTriangles.slice(m.trianglesBase * 4, (m.trianglesBase + m.trianglesCount) * 4)); kept += m.trianglesCount; } });
    stats.polys += t.polys.length; stats.verts += nv; stats.detailVerts += nd; stats.detailTris += kept;
  }
  return stats;
}

// ── main ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
let stale = 0;
for (const def of registry.CHUNKS) {
  if (only.length > 0 && !only.includes(def.slug)) continue;
  const bakedFile = resolve(ROOT, 'public/assets/baked', def.slug, 'terrain.bin');
  if (!existsSync(bakedFile)) { console.log(`[navmesh] ${def.slug}: no terrain.bin — skipped (run scripts/bake-chunk.mjs first)`); continue; }
  const t0 = performance.now();
  registry.setActiveChunk(def.slug);
  const buf = readFileSync(bakedFile);
  const grid = BT.parseBakedTerrain(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  if (!grid) throw new Error(`bake-navmesh: ${def.slug}/terrain.bin does not parse`);
  HF._installBakedTerrain(BT.bakedSamplers(grid)); // as loadBakedTerrain does at launch
  const { colliders, cuts, counts } = await shardColliders(def);
  if (process.env.NAVMESH_DUMP) { // debugging: NAVMESH_DUMP=x,z,r prints the colliders centred within r m of (x, z)
    const [dx, dz, dr] = process.env.NAVMESH_DUMP.split(',').map(Number);
    for (const d of colliders) { const c = d.kind === 'treads' ? d.from : d; if (Math.hypot(c.x - dx, c.z - dz) < dr) console.log(JSON.stringify(d, (k, v) => (v instanceof Float32Array ? `[${v.length / 3} points]` : typeof v === 'number' ? Math.round(v * 100) / 100 : v))); }
  }
  const soup = new Soup();
  const dropped = addTerrain(soup, cuts, await wetTest(def));
  for (const d of colliders) addDesc(soup, d);
  const hash = createHash('sha1');
  const LAYERS = layersFor(def.slug);
  hash.update(JSON.stringify({ VERSION, LAYERS, GEN, navcat: JSON.parse(readFileSync(resolve(ROOT, 'node_modules/navcat/package.json'), 'utf8')).version }));
  hash.update(readFileSync(import.meta.filename)); // this script: the triangulation and the file format
  hash.update(Float32Array.from(soup.positions)); hash.update(Uint32Array.from(soup.indices));
  const digest = hash.digest('hex');
  const dir = resolve(ROOT, 'public/assets/baked', def.slug), jsonFile = resolve(dir, 'navmesh.json'), binFile = resolve(dir, 'navmesh.bin');
  const prev = existsSync(jsonFile) ? JSON.parse(readFileSync(jsonFile, 'utf8')) : null;
  const tIn = performance.now() - t0;
  console.log(`[navmesh] ${def.slug}: ${colliders.length} colliders (${Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(', ')}), ${soup.indices.length / 3} triangles (${dropped} wet terrain triangles left out) in ${tIn.toFixed(0)} ms`);
  if (!force && prev?.hash === digest && existsSync(binFile)) { console.log(`[navmesh] ${def.slug}: up to date`); continue; }
  if (check) { console.log(`[navmesh] ${def.slug}: STALE`); stale++; continue; }
  const w = new Writer();
  w.u8(0x57, 0x53, 0x4e, 0x4d); w.u32(VERSION, LAYERS.length); // 'WSNM'
  const layers = [];
  for (const layer of LAYERS) {
    const t1 = performance.now();
    const nav = generate(soup, layer);
    const stats = writeLayer(w, layer, nav);
    layers.push({ ...layer, ...stats, ms: Math.round(performance.now() - t1) });
    console.log(`[navmesh] ${def.slug} ${layer.name} r=${layer.radius}: ${stats.tiles} tiles, ${stats.polys} polys, ${stats.detailTris} detail tris in ${((performance.now() - t1) / 1000).toFixed(1)} s`);
  }
  const bytes = w.bytes(), gz = gzipSync(bytes, { level: 9 }).byteLength, br = brotliCompressSync(bytes).byteLength;
  mkdirSync(dir, { recursive: true });
  writeFileSync(binFile, bytes);
  writeFileSync(jsonFile, `${JSON.stringify({ version: VERSION, hash: digest, bytes: bytes.byteLength, gzip: gz, brotli: br, layers }, null, 1)}\n`);
  console.log(`[navmesh] ${def.slug}: wrote navmesh.bin ${(bytes.byteLength / 1024).toFixed(1)} KB (${(gz / 1024).toFixed(1)} KB gzip, ${(br / 1024).toFixed(1)} KB brotli)`);
}
if (check && stale > 0) process.exit(1);
