#!/usr/bin/env node
// pine-hollow-walkcheck.mjs — proves every Pine Hollow POI is reachable on foot from the spawn (PINE-HOLLOW-REMASTER §4,
// layout v2). Runs the shard's pure terrain (src/chunks/pine-hollow.ts → pineHollowLayout.ts) in Node:
//
//   · a 1 m grid over the slab (±249 m), the analytic height at every node;
//   · a node is walkable when its ground's slope (the gradient by central differences, as the character controller
//     reads it from the surface normal — not the step direction, which would let a walker zig-zag up a 54° face) is no
//     steeper than --max-slope (default 44°); a flood fill from the spawn over 8-neighbour steps between walkable nodes;
//   · the pond is not walkable (its surface: pondMask > 0 and ground below the water line); the creek bed is dry ground;
//   · each POI with a `foot` spot must have a reached node within --reach m (default 3) of it.
//
// Also checks the zipline's cable (a straight chord from the lookout's deck to the landing's) clears the ground by
// --cable-clear m (default 3) everywhere but its last 10 m at each end, and prints each trail's steepest 1 m step.
// Exit 1 when a POI is unreachable or the cable scrapes. `--map=<file.ppm>` writes the reach map (north up, east
// right: green reached, dark red too steep / unreached, blue pond, cyan POIs).
//
//   node scripts/pine-hollow-walkcheck.mjs [--max-slope=44] [--reach=3] [--map=/tmp/walk.ppm]
import { writeFileSync } from 'node:fs';

await import('./bake-loader.mjs'); // lets Node import the game's TypeScript chunk modules
if (!('location' in globalThis)) Object.assign(globalThis, { location: new URL('http://localhost/') });
const { PINE_HOLLOW } = await import('../src/chunks/pine-hollow.ts');
const L = await import('../src/chunks/pineHollowLayout.ts');

const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const MAX_SLOPE = Number(flag('max-slope', '44'));
const REACH = Number(flag('reach', '3'));
const CABLE_CLEAR = Number(flag('cable-clear', '3'));
const MAP = flag('map', '');

const t = PINE_HOLLOW.terrain;
const wl = t.waterLevel();
const HALF = 249, N = HALF * 2 + 1; // nodes at x, z = −249 … +249
const idx = (ix, iz) => iz * N + ix;
const t0 = performance.now();
const H = new Float32Array(N * N), wet = new Uint8Array(N * N);
for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
  const x = ix - HALF, z = iz - HALF, h = t.heightAt(x, z), i = idx(ix, iz);
  H[i] = h;
  wet[i] = t.pondMask(x, z) > 0 && h < wl - 0.3 ? 1 : 0;
}
const tanMax = Math.tan((MAX_SLOPE * Math.PI) / 180);
const steep = new Uint8Array(N * N);
for (let iz = 1; iz < N - 1; iz++) for (let ix = 1; ix < N - 1; ix++) {
  const i = idx(ix, iz);
  const gx = (H[idx(ix + 1, iz)] - H[idx(ix - 1, iz)]) / 2, gz = (H[idx(ix, iz + 1)] - H[idx(ix, iz - 1)]) / 2;
  steep[i] = Math.hypot(gx, gz) > tanMax ? 1 : 0;
}
const reached = new Uint8Array(N * N);
const s0 = [Math.round(PINE_HOLLOW.spawn.x) + HALF, Math.round(PINE_HOLLOW.spawn.z) + HALF];
const queue = new Int32Array(N * N);
let qh = 0, qt = 0;
reached[idx(s0[0], s0[1])] = 1; queue[qt++] = idx(s0[0], s0[1]);
const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
while (qh < qt) {
  const i = queue[qh++], ix = i % N, iz = (i - ix) / N;
  for (const [dx, dz, d] of STEPS) {
    const jx = ix + dx, jz = iz + dz;
    if (jx < 0 || jz < 0 || jx >= N || jz >= N) continue;
    const j = idx(jx, jz);
    if (reached[j] || wet[j] || steep[j]) continue;
    if (Math.abs(H[j] - H[i]) > tanMax * d) continue;
    reached[j] = 1; queue[qt++] = j;
  }
}
const ms = performance.now() - t0;

// ── the POIs ──
let fail = 0;
const rows = [];
for (const p of L.PINE_HOLLOW_POIS) {
  if (!p.foot) { rows.push(`  ${p.id.padEnd(11)} ${p.name.padEnd(16)} — not on foot (by canoe)`); continue; }
  const [fx, fz] = p.foot;
  let best = Infinity;
  const r = Math.ceil(REACH);
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const ix = Math.round(fx) + HALF + dx, iz = Math.round(fz) + HALF + dz;
    if (ix < 0 || iz < 0 || ix >= N || iz >= N || !reached[idx(ix, iz)]) continue;
    best = Math.min(best, Math.hypot(ix - HALF - fx, iz - HALF - fz));
  }
  const ok = best <= REACH;
  if (!ok) fail++;
  rows.push(`  ${ok ? 'ok ' : 'NO '} ${p.id.padEnd(11)} ${p.name.padEnd(16)} (${fx}, ${fz}) y ${t.heightAt(fx, fz).toFixed(1).padStart(5)}${ok ? '' : '  ← unreachable'}`);
}

// ── the zipline's cable ──
const Z = L.ZIPLINE, gTop = t.heightAt(Z.from.x, Z.from.z), gEnd = t.heightAt(Z.to.x, Z.to.z);
const len = Math.hypot(Z.to.x - Z.from.x, Z.to.z - Z.from.z);
let minClear = Infinity, minAt = 0;
for (let s = 10; s <= len - 10; s += 1) {
  const p = L.ziplineAt(s / len, gTop, gEnd), c = p.y - t.heightAt(p.x, p.z);
  if (c < minClear) { minClear = c; minAt = s; }
}
const drop = gTop + Z.from.deck - (gEnd + Z.to.deck);
const cableOk = minClear >= CABLE_CLEAR;
if (!cableOk) fail++;

// ── each trail's steepest 1 m step (information: physics-baseline --trails walks them for real) ──
const trailRows = [];
const names = ['S road', 'N road', 'W road', 'E road', ...Object.keys(L.SPURS).map((k) => `${k} spur`)];
t.trails.forEach((poly, k) => {
  let worst = 0, at = [0, 0];
  for (let i = 0; i + 1 < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[i + 1], l = Math.hypot(bx - ax, bz - az);
    for (let s = 0; s + 1 <= l; s += 1) {
      const x0 = ax + ((bx - ax) * s) / l, z0 = az + ((bz - az) * s) / l, x1 = ax + ((bx - ax) * (s + 1)) / l, z1 = az + ((bz - az) * (s + 1)) / l;
      const g = Math.abs(t.heightAt(x1, z1) - t.heightAt(x0, z0));
      if (g > worst) { worst = g; at = [Math.round(x0), Math.round(z0)]; }
    }
  }
  trailRows.push(`  ${(names[k] ?? `trail ${k}`).padEnd(15)} steepest ${((Math.atan(worst) * 180) / Math.PI).toFixed(1).padStart(4)}° at (${at[0]}, ${at[1]})`);
});

let area = 0; for (let i = 0; i < N * N; i++) area += reached[i];
console.log(`pine-hollow walk check: 1 m grid ${N}² (${(ms / 1000).toFixed(1)} s), max slope ${MAX_SLOPE}°, water line ${wl.toFixed(2)}, reached ${((area / (N * N)) * 100).toFixed(1)} % of the slab`);
console.log(rows.join('\n'));
console.log(`  ${cableOk ? 'ok ' : 'NO '} zipline     ${len.toFixed(0)} m, drop ${drop.toFixed(1)} m (${((Math.atan(drop / len) * 180) / Math.PI).toFixed(1)}°), lowest clearance ${minClear.toFixed(1)} m at ${minAt} m from the lookout`);
console.log(trailRows.join('\n'));

if (MAP) {
  const px = new Uint8Array(N * N * 3);
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
    const i = idx(ix, iz), row = N - 1 - iz, col = N - 1 - ix, o = (row * N + col) * 3; // north up (+z), east right (−x)
    // hillshade, lit from the north-west (+x, +z)
    const hx = H[idx(Math.min(N - 1, ix + 1), iz)] - H[idx(Math.max(0, ix - 1), iz)];
    const hz = H[idx(ix, Math.min(N - 1, iz + 1))] - H[idx(ix, Math.max(0, iz - 1))];
    const lit = Math.max(0.25, Math.min(1.25, 0.8 + (hx + hz) * 0.25));
    const alt = Math.max(0, Math.min(1, (H[i] + 10) / 70));
    const c = wet[i] ? [30, 70, 160] : reached[i] ? [60 + alt * 120, 125 + alt * 90, 55 + alt * 90] : [150, 40, 35];
    px[o] = Math.min(255, c[0] * lit); px[o + 1] = Math.min(255, c[1] * lit); px[o + 2] = Math.min(255, c[2] * lit);
  }
  for (const p of L.PINE_HOLLOW_POIS) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const col = N - 1 - (Math.round(p.x) + HALF + dx), row = N - 1 - (Math.round(p.z) + HALF + dz);
    if (col < 0 || row < 0 || col >= N || row >= N) continue;
    const o = (row * N + col) * 3; px[o] = 120; px[o + 1] = 255; px[o + 2] = 255;
  }
  writeFileSync(MAP, Buffer.concat([Buffer.from(`P6\n${N} ${N}\n255\n`), Buffer.from(px)]));
  console.log(`  reach map → ${MAP}`);
}

if (fail > 0) { console.error(`FAIL: ${fail} check(s)`); process.exit(1); }
console.log('PASS');
