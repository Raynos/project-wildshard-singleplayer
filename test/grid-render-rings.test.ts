// oxlint-disable-next-line import/no-nodejs-modules -- SF18B_EVIDENCE=1 writes the drive numbers into progress/shard-platform/sf18b/.
import { writeFileSync, mkdirSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- reads the opt-in evidence switch.
import { env } from 'node:process';
import { afterAll, expect, it } from 'vitest';
import { CONTENT_CAPS as C } from '../src/engine/core/config';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { TileDecoder } from '../src/game/grid/tileDecoder';
import { decodeTerrainTile, encodeTerrainTile } from '../src/engine/world/terrainTileData';
import { RenderRings, type RingCell, type RingLevel, type RingTile, type RingView } from '../src/game/grid/rings';

/**
 * SF18b's deterministic drive: a scripted camera at 15 and 30 m/s across the 3 × 3 grid (a U-turn, a stall, a 10 s network
 * stall), a serial 5 Mbit/s link, caps-sized tiles and four whole sims + libraries charged in the same allocator. Every
 * frame checks that each patch of each visible cell is drawn by exactly one level and that the cost model stays inside
 * the 1.0 GB envelope (G65); the same path twice gives the same residency trace.
 */
const DT = 1 / 60, LINK = 5_000_000, LATENCY = 0.1;
const resident = { far: Math.round(C.far.resident), l1: C.l1.resident, l0: C.l0.resident } as const;
const wire = { far: C.far.compressed, l1: C.l1.compressed, l0: C.l0.compressed } as const;
const cells: RingCell[] = [];
for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) cells.push({ instance: `cell${x + 1}${z + 1}`, origin: { x: x * C.pitch, z: z * C.pitch } });

interface Drive { holes: number; overlaps: number; frames: number; peakMB: number; peakTiles: Record<RingLevel, number>; fineHere: number; refused: number; evictions: number; trace: string[]; bootFrames: number }

function fnv(text: string): string { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.codePointAt(i) ?? 0; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); }

/** Waypoint path at a constant speed, with optional holds (speed 0) given as repeated points with a duration. */
function path(speed: number): { at: (t: number) => { x: number; z: number; vx: number; vz: number }; duration: number } {
  const legs: { from: [number, number]; to: [number, number]; hold?: number }[] = [
    { from: [0, -100], to: [760, -100] }, // east across the strip into the east cell
    { from: [760, -100], to: [-760, -100] }, // U-turn: back west through the centre into the west cell
    { from: [-760, -100], to: [-760, -100], hold: 5 }, // stall in place
    { from: [-760, -100], to: [-760, 700] }, // north into the north-west cell
    { from: [-760, 700], to: [700, 700] }, // east along the north row
  ];
  const timed = legs.map((leg) => ({ ...leg, time: leg.hold ?? Math.hypot(leg.to[0] - leg.from[0], leg.to[1] - leg.from[1]) / speed }));
  const duration = timed.reduce((s, l) => s + l.time, 0);
  return { duration, at: (t) => {
    let left = t;
    for (const leg of timed) {
      if (left > leg.time) { left -= leg.time; continue; }
      if (leg.hold !== undefined) return { x: leg.from[0], z: leg.from[1], vx: 0, vz: 0 };
      const k = left / leg.time, dx = leg.to[0] - leg.from[0], dz = leg.to[1] - leg.from[1], len = Math.hypot(dx, dz);
      return { x: leg.from[0] + dx * k, z: leg.from[1] + dz * k, vx: dx / len * speed, vz: dz / len * speed };
    }
    const last = legs[legs.length - 1]; return { x: last?.to[0] ?? 0, z: last?.to[1] ?? 0, vx: 0, vz: 0 };
  } };
}

function drive(speed: number, options: { playing?: number; stall?: [number, number]; maskLie?: boolean } = {}): Drive {
  const allocator = new ResidencyAllocator(options.playing === undefined ? {} : { playing: options.playing });
  // the rest of the session's residency in the same allocator: four sims, four libraries and the commons
  for (let i = 0; i < 4; i++) {
    allocator.reserve({ id: `sim:cell${i}`, category: 'sim', bytes: C.sim.resident, owner: `cell${i}`, distance: 0, needed: true });
    allocator.reserve({ id: `library:cell${i}`, category: 'library', bytes: C.library.resident, owner: `cell${i}`, distance: 0, needed: true });
  }
  allocator.reserve({ id: 'commons:base', category: 'commons', bytes: 10_000_000, owner: 'platform', distance: 0, needed: true });
  const drawn = new Map<string, { tile: RingTile; mask: ReadonlySet<number> }>();
  let now = 0, linkFree = 0, seq = 0;
  const network: { at: number; seq: number; done: () => void }[] = [];
  const rings = new RenderRings<RingTile>(cells, allocator, (_instance, level) => resident[level], {
    fetch: (tile, done) => {
      const start = Math.max(now, linkFree) + LATENCY; linkFree = start + wire[tile.level] * 8 / LINK;
      network.push({ at: linkFree + 0.02, seq: seq++, done: () => { done(tile); } });
    },
    upload: (tile): RingView => {
      if (drawn.has(tile.key)) throw new Error(`double upload ${tile.key}`);
      drawn.set(tile.key, { tile, mask: new Set() });
      return { mask: (excluded) => { const entry = drawn.get(tile.key); if (entry !== undefined) entry.mask = options.maskLie === true && tile.level === 'l1' ? new Set([0, 1, 2, 3]) : new Set(excluded); }, shadow: () => undefined, dispose: () => { drawn.delete(tile.key); } };
    },
  });
  const route = path(speed), stall = options.stall ?? [20, 30];
  const result: Drive = { holes: 0, overlaps: 0, frames: 0, peakMB: 0, peakTiles: { far: 0, l1: 0, l0: 0 }, fineHere: 0, refused: 0, evictions: 0, trace: [], bootFrames: 0 };
  let booted = false;
  for (let frame = 0; now <= route.duration + 5; frame++, now += DT) {
    const pose = booted ? route.at(now - result.bootFrames * DT) : route.at(0);
    if (!(now >= stall[0] && now < stall[1])) {
      network.sort((a, b) => a.at - b.at || a.seq - b.seq);
      while (network.length > 0 && (network[0]?.at ?? Infinity) <= now) network.shift()?.done();
    } else linkFree = Math.max(linkFree, stall[1]);
    rings.step({ x: pose.x, z: pose.z, vx: booted ? pose.vx : 0, vz: booted ? pose.vz : 0 });
    const cost = allocator.cost();
    if (cost.playing > (options.playing ?? C.playing)) throw new Error(`envelope exceeded at frame ${frame}: ${cost.playing}`);
    result.peakMB = Math.max(result.peakMB, cost.playing / 1e6);
    const stats = rings.stats();
    for (const level of ['far', 'l1', 'l0'] as const) result.peakTiles[level] = Math.max(result.peakTiles[level], stats.resident[level]);
    result.trace.push(fnv(`${rings.resident().join('|')}#${cost.playing}`));
    if (!booted) { if (rings.ready()) { booted = true; result.bootFrames = frame; } continue; }
    expect(rings.ready()).toBe(true);
    result.frames++;
    for (const cell of rings.visible()) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      const l0 = drawn.has(`${cell.instance}:l0/${x}/${z}`) ? 1 : 0;
      const l1 = drawn.get(`${cell.instance}:l1/${Math.floor(x / 2)}/${Math.floor(z / 2)}`), far = drawn.get(`${cell.instance}:far`);
      const levels = l0 + (l1 !== undefined && !l1.mask.has(x % 2 + (z % 2) * 2) ? 1 : 0) + (far !== undefined && !far.mask.has(Math.floor(x / 2) + Math.floor(z / 2) * 4) ? 1 : 0);
      if (levels === 0) result.holes++; else if (levels > 1) result.overlaps++;
    }
    const here = cells.find((c) => Math.abs(pose.x - c.origin.x) < 250 && Math.abs(pose.z - c.origin.z) < 250);
    if (here !== undefined && drawn.has(`${here.instance}:l0/${Math.floor((pose.x - here.origin.x + 250) / 62.5)}/${Math.floor((pose.z - here.origin.z + 250) / 62.5)}`)) result.fineHere++;
  }
  const stats = rings.stats(); result.refused = stats.refused; result.evictions = stats.evictions;
  rings.dispose();
  expect(drawn.size).toBe(0);
  expect(allocator.entries().filter((e) => e.id.startsWith('render:'))).toEqual([]);
  return result;
}

const evidence: Record<string, Omit<Drive, 'trace'>> = {};
function summary(d: Drive): Omit<Drive, 'trace'> { const { trace: _trace, ...rest } = d; return rest; }
function record(name: string, d: Drive): void { evidence[name] = summary(d); }
// SF18B_EVIDENCE=1 writes the drive numbers next to the browser drive's (progress/shard-platform/sf18b/)
afterAll(() => {
  if (env['SF18B_EVIDENCE'] !== '1') return;
  mkdirSync('progress/shard-platform/sf18b', { recursive: true });
  writeFileSync('progress/shard-platform/sf18b/node-drive.json', `${JSON.stringify({ test: 'test/grid-render-rings.test.ts', link: '5 Mbit/s serial, 0.1 s latency, network stall 20-30 s', drives: evidence }, null, 2)}\n`);
});

it('drives the grid at 15 m/s with a U-turn, a stall and a 10 s network stall: no holes, inside the envelope', () => {
  const run = drive(15);
  record('15 m/s', run);
  expect(run.holes).toBe(0);
  expect(run.overlaps).toBe(0);
  expect(run.peakMB).toBeLessThanOrEqual(C.playing / 1e6);
  expect(run.fineHere / run.frames).toBeGreaterThan(0.5); // refinement really happens: not a far-proxy-only pass
}, 60_000); // The full 15 m/s fixed-step drive exceeds 20 s with coverage on the GitHub runner.

it('drives at 30 m/s: the link cannot keep up with L0, coarse levels hold, still no holes', () => {
  const run = drive(30);
  record('30 m/s', run);
  expect(run.holes).toBe(0);
  expect(run.overlaps).toBe(0);
  expect(run.peakMB).toBeLessThanOrEqual(C.playing / 1e6);
  expect(run.peakTiles.far).toBeLessThanOrEqual(C.farCount);
});

it('the same path gives the same residency trace', () => {
  expect(drive(30).trace).toEqual(drive(30).trace);
});

it('under a tight envelope the allocator refuses and evicts cache, and holes still never show', () => {
  const run = drive(30, { playing: 700_000_000 });
  record('30 m/s @ 700 MB envelope', run);
  expect(run.holes).toBe(0);
  expect(run.overlaps).toBe(0);
  expect(run.peakMB).toBeLessThanOrEqual(700);
  expect(run.refused + run.evictions).toBeGreaterThan(0);
});

it('the hole check is not vacuous: a parent that hides regions its children do not cover shows holes', () => {
  expect(drive(30, { maskLie: true }).holes).toBeGreaterThan(0);
});

it('decodes inline where there is no Worker, with the same data as the wire decoder', async () => {
  const heights = Float32Array.from({ length: 17 * 17 }, (_, i) => (i % 17) * 0.5), colours = new Float32Array(17 * 17 * 3).fill(0.5);
  const bytes = encodeTerrainTile({ resolution: 17, x: -250, z: -250, size: 125, heights, colours });
  const decoder = new TileDecoder();
  expect(decoder.threaded).toBe(false);
  expect(await decoder.decode(bytes)).toEqual(decodeTerrainTile(bytes));
  decoder.dispose();
  await expect(decoder.decode(bytes)).rejects.toThrow('disposed');
});

it('a shard without a far proxy is ready only once all 16 of its L1 tiles draw, and dropped prepared tiles are discarded', () => {
  const allocator = new ResidencyAllocator(), drawn = new Set<string>(), discarded: string[] = [], pending: { tile: RingTile; done: (r: RingTile | Error) => void }[] = [];
  const rings = new RenderRings<RingTile>([{ instance: 'solo', origin: { x: 0, z: 0 } }], allocator, (_i, level) => (level === 'far' ? null : resident[level]), {
    fetch: (tile, done) => { pending.push({ tile, done }); },
    upload: (tile) => { drawn.add(tile.key); return { mask: () => undefined, shadow: () => undefined, dispose: () => { drawn.delete(tile.key); } }; },
    discard: (tile) => { discarded.push(tile.key); },
  }, { maxInFlight: 64, uploadsPerFrame: 64, uploadBytesPerFrame: 1e9 });
  // a corner camera: several of the cell's L1 tiles are beyond 400 m, but all 16 are its coarse level
  rings.step({ x: 240, z: 240, vx: 0, vz: 0 });
  expect(pending.filter((p) => p.tile.level === 'l1')).toHaveLength(16);
  expect(pending.some((p) => p.tile.level === 'l0')).toBe(false); // parent-first: no L0 before its L1 draws
  for (const p of pending.splice(0, 15)) p.done(p.tile);
  rings.step({ x: 240, z: 240, vx: 0, vz: 0 });
  expect(rings.ready()).toBe(false);
  for (const p of pending.splice(0)) p.done(p.tile);
  rings.step({ x: 240, z: 240, vx: 0, vz: 0 });
  expect(rings.ready()).toBe(true);
  expect([...drawn].filter((k) => k.includes(':l1/'))).toHaveLength(16);
  // L0 requests are out now; drive away so they are dropped before they finish: their prepared results are discarded
  rings.step({ x: 240, z: 240, vx: 0, vz: 0 });
  const fine = pending.filter((p) => p.tile.level === 'l0'); expect(fine.length).toBeGreaterThan(0);
  rings.step({ x: -240, z: -240, vx: 0, vz: 0 });
  for (const p of fine) p.done(p.tile);
  rings.step({ x: -240, z: -240, vx: 0, vz: 0 });
  expect(discarded.length).toBeGreaterThan(0);
  rings.dispose();
  for (const p of pending) p.done(p.tile);
  expect(drawn.size).toBe(0);
  expect(allocator.entries()).toEqual([]);
});

it('far proxies are bounded by count, not only distance: a 30 m/s diagonal over a 5 × 5 grid never holds more than farCount', () => {
  const grid: RingCell[] = [];
  for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) grid.push({ instance: `g${x + 2}${z + 2}`, origin: { x: x * C.pitch, z: z * C.pitch } });
  const queue: (() => void)[] = [];
  const allocator = new ResidencyAllocator();
  const rings = new RenderRings<RingTile>(grid, allocator, (_i, level) => resident[level], {
    fetch: (tile, done) => { queue.push(() => { done(tile); }); },
    upload: () => ({ mask: () => undefined, shadow: () => undefined, dispose: () => undefined }),
  }, { maxInFlight: 16, uploadsPerFrame: 8, uploadBytesPerFrame: 1e9 });
  let peak = 0;
  for (let i = 0; i < 60 * 80; i++) {
    const d = -1100 + 30 * i / 60;
    for (const run of queue.splice(0)) run();
    rings.step({ x: d / Math.SQRT2, z: d / Math.SQRT2, vx: 30 / Math.SQRT2, vz: 30 / Math.SQRT2 });
    peak = Math.max(peak, rings.stats().resident.far);
  }
  expect(peak).toBeLessThanOrEqual(C.farCount);
  rings.dispose();
});

it('dispose re-masks nothing: a session scope that already uninstalled the coarse meshes does not fault (SF15a offline leak)', () => {
  const allocator = new ResidencyAllocator(), pending: { tile: RingTile; done: (r: RingTile | Error) => void }[] = [];
  let torn = false, masksAfterTeardown = 0;
  const rings = new RenderRings<RingTile>([{ instance: 'solo', origin: { x: 0, z: 0 } }], allocator, (_i, level) => (level === 'far' ? null : resident[level]), {
    fetch: (tile, done) => { pending.push({ tile, done }); },
    upload: () => ({ mask: () => { if (torn) masksAfterTeardown++; }, shadow: () => undefined, dispose: () => undefined }),
  }, { maxInFlight: 64, uploadsPerFrame: 64, uploadBytesPerFrame: 1e9 });
  for (let i = 0; i < 4; i++) { for (const p of pending.splice(0)) p.done(p.tile); rings.step({ x: 0, z: 0, vx: 0, vz: 0 }); }
  expect(rings.stats().resident.l0).toBeGreaterThan(0); // fine tiles drawn, so their parents are masked
  torn = true; // the loader's scope disposed first and uninstalled every tile mesh
  rings.dispose();
  expect(masksAfterTeardown).toBe(0);
  expect(allocator.entries()).toEqual([]);
});
