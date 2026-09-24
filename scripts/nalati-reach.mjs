#!/usr/bin/env node
// nalati-reach.mjs — is every Nalati POI reachable on foot? (NALATI-MERGE P4)
//
// Reads the baked navmesh (public/assets/baked/nalati-grasslands/navmesh.bin — scripts/bake-navmesh.mjs: the terrain +
// every registered collider, recast at the motor's slope and step, the water left out) and plans a path from the spawn
// on the N road to each POI. A POI is reached when the path ends within 1.5 m of it (across and up); otherwise the
// report says how close the reachable mesh gets. The navmesh's agent is a 0.3 m capsule on ground ≤ ~38.7° (recast's
// ledge rule at a 0.4 m climb); the player's is 0.38 m, 40°, a 0.35 m step — close, and on the strict side.
//
// Stairs are the navmesh's blind spot: recast walks no flight steeper than ~39°, and the watchtower's stair and Eagle
// Rock's scramble are steeper; for those the check is the stair's foot, and the walk route (scripts/physics-route.json,
// `physics-baseline --mode=walk`) climbs the flight itself. Snow lotus clusters are scenery on the valley walls: one
// reachable spot within the cluster's radius counts.
//
//   node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/nalati-reach.mjs [--json=out.json]
//     [--map=out.bmp [--region=x0,z0,x1,z1] [--px=0.5] [--stuck=walk.json,…]]
//
// --map draws the shard (or the region; +x = west is on the LEFT, north up, as the game's map) at `px` m a pixel: the
// ground by slope (green < 30°, olive 30–40°, grey past 40°, blue = water), the navmesh reachable from the spawn in
// cyan, walkable-but-cut-off navmesh in red, the POIs as white squares (black = missed), and every stuck point of the
// physics-baseline results given in --stuck as a magenta cross. A 24-bit BMP (sips / PIL turn it into a JPEG).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
Object.assign(globalThis, { location: new URL('http://localhost/') });
const src = (p) => import(pathToFileURL(resolve(ROOT, 'src', p)).href);
const { parseNavmesh } = await src('physics/navmesh.ts');
const { createFindNearestPolyResult, DEFAULT_QUERY_FILTER, findNearestPoly, getNodeRefIndex } = await import('navcat');
const L = await src('chunks/nalatiLayout.ts');
const registry = await src('chunks/registry.ts');
const HF = await src('world/Heightfield.ts');
const BT = await src('world/BakedTerrain.ts');
registry.setActiveChunk('nalati-grasslands');
const read = (p) => { const b = readFileSync(resolve(ROOT, 'public/assets/baked/nalati-grasslands', p)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
HF._installBakedTerrain(BT.bakedSamplers(BT.parseBakedTerrain(read('terrain.bin'))));
const nav = parseNavmesh(read('navmesh.bin'));
if (nav === null) throw new Error('navmesh.bin did not parse');
const R = 0.3;

/** the walkable point at (x, z) nearest height `y` (scanned from y + 6 down) — the spawn */
function at(x, z, y) {
  let best = null;
  for (let h = y + 6; h > y - 30; h -= 1.5) {
    const p = nav.closestWalkable({ x, y: h, z }, R);
    if (p === null) continue;
    const d = Math.hypot(p.x - x, p.z - z) + Math.abs(p.y - y) * 0.2;
    if (best === null || d < best.d) best = { x: p.x, y: p.y, z: p.z, d };
  }
  return best;
}

/** ground height, for the POIs that stand on the terrain */
const g = (x, z) => HF.heightAt(x, z);
/** where the scramble is stepped onto: the footpath's end (before P4: the scramble's own foot) */
const eagleFoot = L.EAGLE_TRAIL?.at(-1) ?? [172.9, 71.9];
const POIS = [
  { name: 'bridge (deck)', x: L.BRIDGE_XZ.x, z: L.BRIDGE_XZ.z, y: L.BRIDGE_XZ.deckY },
  { name: 'camp', x: L.CAMP.x, z: L.CAMP.z - 10, y: g(L.CAMP.x, L.CAMP.z - 10) },
  { name: 'camp spur end', x: L.CAMP_SPUR.at(-1)[0], z: L.CAMP_SPUR.at(-1)[1], y: g(...L.CAMP_SPUR.at(-1)) },
  { name: 'pasture', x: L.PASTURE.x, z: L.PASTURE.z, y: g(L.PASTURE.x, L.PASTURE.z) },
  { name: 'sky road rim', x: L.SKY_ROAD.at(-1)[0], z: L.SKY_ROAD.at(-1)[1], y: g(...L.SKY_ROAD.at(-1)) },
  { name: 'horse plains', x: L.HORSE_PLAINS.x, z: L.HORSE_PLAINS.z, y: g(L.HORSE_PLAINS.x, L.HORSE_PLAINS.z) },
  { name: 'kokpar', x: L.KOKPAR.x, z: L.KOKPAR.z, y: g(L.KOKPAR.x, L.KOKPAR.z) },
  // (the third mound straddles the north rim's lip: its top is 3 m south of its centre)
  ...L.KURGANS.map((k, i) => ({ name: `kurgan ${i}${k.great ? ' (great)' : ''} top`, x: k.x, z: k.z, y: g(k.x, k.z), r: Math.min(5, k.r * 0.6) })),
  { name: 'summer camp', x: L.SUMMER_YURTS.x, z: L.SUMMER_YURTS.z + 8, y: g(L.SUMMER_YURTS.x, L.SUMMER_YURTS.z + 8) },
  { name: 'eagle rock (scramble foot)', x: eagleFoot[0], z: eagleFoot[1], y: g(eagleFoot[0], eagleFoot[1]), stair: 'eagle-rock' },
  { name: 'watchtower (stair foot)', x: -179, z: -33.8, y: g(-179, -33.8), stair: 'watchtower' },
  { name: 'wind cairn', x: L.CAIRN.x, z: L.CAIRN.z + 3, y: L.CAIRN.y },
  { name: 'leopard cave porch', x: L.LEOPARD_CAVE.x, z: L.LEOPARD_CAVE.z, y: L.LEOPARD_CAVE.y },
  { name: 'argymaq pasture', x: L.ARGYMAQ_PASTURE.x, z: L.ARGYMAQ_PASTURE.z, y: L.ARGYMAQ_PASTURE.y },
  { name: 'kokbori den', x: L.KOKBORI_DEN.x, z: L.KOKBORI_DEN.z, y: g(L.KOKBORI_DEN.x, L.KOKBORI_DEN.z), r: 4 },
  { name: 'qara cairn', x: L.QARA_CAIRN.x, z: L.QARA_CAIRN.z, y: g(L.QARA_CAIRN.x, L.QARA_CAIRN.z), r: 3 },
  ...L.SNOW_LOTUS.map((s, i) => ({ name: `snow lotus ${i}`, x: s.x, z: s.z, y: g(s.x, s.z), r: s.r, scenery: true })),
  { name: 'glacier (the snout\'s foot)', x: L.GLACIER.x1 + 11, z: L.GLACIER.z1, y: g(L.GLACIER.x1 + 11, L.GLACIER.z1), r: 4 },
  { name: 'W road gate', x: 246, z: 0, y: 0 },
  { name: 'E road gate', x: -246, z: 0, y: 0 },
  { name: 'S road gate', x: 0, z: -246, y: 0 },
];

const spawn = at(0, 232, -8);
if (spawn === null) throw new Error('the spawn is off the mesh');
// the polys reachable from the spawn: a flood over the mesh's links
const { mesh } = nav.layerFor(R);
const hit = createFindNearestPolyResult();
const start = findNearestPoly(hit, mesh, [spawn.x, spawn.y, spawn.z], [2, 3, 2], DEFAULT_QUERY_FILTER);
const reach = new Set([getNodeRefIndex(start.nodeRef)]);
for (const queue = [...reach]; queue.length > 0;) {
  const n = mesh.nodes[queue.pop()];
  for (const li of n.links) { const l = mesh.links[li]; if (l?.allocated && !reach.has(l.toNodeIndex)) { reach.add(l.toNodeIndex); queue.push(l.toNodeIndex); } }
}
/** the reachable mesh nearest (x, y, z) within `r` m across (± 2 m up): sampled on a 0.5 m grid round it */
function reachable(x, y, z, r) {
  let best = null;
  for (let dx = -r; dx <= r; dx += 0.5) for (let dz = -r; dz <= r; dz += 0.5) {
    if (dx * dx + dz * dz > r * r) continue;
    const q = findNearestPoly(hit, mesh, [x + dx, y, z + dz], [0.3, 2, 0.3], DEFAULT_QUERY_FILTER);
    if (!q.success || !reach.has(getNodeRefIndex(q.nodeRef))) continue;
    const d = Math.hypot(q.position[0] - x, q.position[2] - z);
    if (best === null || d < best.d) best = { x: q.position[0], y: q.position[1], z: q.position[2], d };
  }
  return best;
}
const rows = [];
let missed = 0;
for (const p of POIS) {
  const got = reachable(p.x, p.y, p.z, p.r ?? 1.5);
  const reached = got !== null;
  if (!reached && p.scenery !== true) missed++;
  // how close the reachable mesh gets (within 40 m), for a miss
  const near = reached ? null : reachable(p.x, p.y, p.z, 12) ?? null;
  rows.push({ ...p, reached, at: got ? { x: Number(got.x.toFixed(1)), y: Number(got.y.toFixed(1)), z: Number(got.z.toFixed(1)) } : null, nearest: near ? Number(near.d.toFixed(1)) : null });
}
for (const r of rows) {
  const tag = r.reached ? 'ok  ' : r.scenery ? 'scn ' : 'MISS';
  const note = r.reached ? (r.stair ? `(the flight above: the walk route's '${r.stair}' leg)` : '') : r.nearest !== null ? `reachable mesh ${r.nearest} m away` : 'no reachable mesh within 12 m';
  console.log(`${tag} ${r.name.padEnd(28)} (${r.x}, ${r.y.toFixed(1)}, ${r.z}) ${note}`);
}
console.log(`${rows.filter((r) => r.reached).length} / ${rows.length} reachable on foot from the spawn (${missed} missed that must not be; scenery aside)`);
const out = arg('json');
if (out) writeFileSync(out, `${JSON.stringify(rows, null, 1)}\n`);

const mapFile = arg('map');
if (mapFile) {
  const [x0, z0, x1, z1] = (arg('region') ?? '-250,-250,250,250').split(',').map(Number);
  const px = Number(arg('px') ?? 0.5);
  const W = Math.round((x1 - x0) / px), H = Math.round((z1 - z0) / px);
  const img = new Uint8Array(W * H * 3);
  const wet = (await src('nalati/wet.ts')).nalatiWetAt;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = x1 - (i + 0.5) * px, z = z1 - (j + 0.5) * px; // +x (west) on the left, north up
    const h = HF.heightAt(x, z), ny = HF.normalAt(x, z)[1], deg = Math.acos(Math.min(1, ny)) * 180 / Math.PI;
    let c = wet(x, z) ? [70, 110, 170] : deg < 30 ? [96, 140, 70] : deg < 40 ? [150, 150, 70] : [120, 116, 112];
    const shade = 0.75 + 0.25 * Math.sin(h * 0.9); // contour banding: the height reads
    c = c.map((v) => v * shade);
    const r = findNearestPoly(hit, mesh, [x, h + 1, z], [px * 0.5, 4, px * 0.5], DEFAULT_QUERY_FILTER);
    if (r.success && Math.hypot(r.position[0] - x, r.position[2] - z) < px * 0.5) {
      const tint = reach.has(getNodeRefIndex(r.nodeRef)) ? [60, 210, 230] : [230, 50, 40];
      c = c.map((v, k) => v * 0.45 + tint[k] * 0.55);
    }
    img.set(c.map((v) => Math.max(0, Math.min(255, Math.round(v)))), (j * W + i) * 3);
  }
  const dot = (x, z, rgb, r, cross = false) => {
    const ci = Math.round((x1 - x) / px), cj = Math.round((z1 - z) / px);
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (cross && Math.abs(di) !== Math.abs(dj)) continue;
      const i = ci + di, j = cj + dj;
      if (i >= 0 && j >= 0 && i < W && j < H) img.set(rgb, (j * W + i) * 3);
    }
  };
  for (const r of rows) dot(r.x, r.z, r.reached ? [255, 255, 255] : [0, 0, 0], 3);
  for (const t of [L.EAGLE_TRAIL, L.CAVE_TRAIL, L.ARGYMAQ_TRAIL]) for (const [x, z] of t ?? []) dot(x, z, [255, 200, 0], 1);
  for (const f of (arg('stuck') ?? '').split(',').filter(Boolean)) {
    const res = JSON.parse(readFileSync(f, 'utf8'));
    for (const leg of res.walk ?? []) for (const s of leg.stuck ?? []) dot(s.x, s.z, [255, 0, 255], 5, true);
  }
  // a 24-bit BMP, bottom-up rows padded to 4 bytes
  const row = Math.ceil(W * 3 / 4) * 4, size = 54 + row * H, bmp = Buffer.alloc(size);
  bmp.write('BM', 0); bmp.writeUInt32LE(size, 2); bmp.writeUInt32LE(54, 10); bmp.writeUInt32LE(40, 14);
  bmp.writeInt32LE(W, 18); bmp.writeInt32LE(H, 22); bmp.writeUInt16LE(1, 26); bmp.writeUInt16LE(24, 28); bmp.writeUInt32LE(row * H, 34);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const s = (j * W + i) * 3, d = 54 + (H - 1 - j) * row + i * 3;
    bmp[d] = img[s + 2] ?? 0; bmp[d + 1] = img[s + 1] ?? 0; bmp[d + 2] = img[s] ?? 0;
  }
  writeFileSync(mapFile, bmp);
  console.log(`map → ${mapFile} (${W}×${H}, ${px} m/px, ${reach.size} polys reachable of ${mesh.nodes.filter((n) => n.allocated).length})`);
}
process.exit(missed > 0 ? 1 : 0);
