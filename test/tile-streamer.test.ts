import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { TileStreamer, type RingPorts, type RingTile, type RingLevel, type RingOptions, type TileStreamBudget } from '../src/engine/world/tileStreamer';

// Captured from the pre-extraction scheduler on the same 1 km path. Render
// ownership, masks and allocator charges are part of the oracle, not only counts.
const BASELINE = '5e0c88fa09c768a0812311096c475615bfc92e2cea3f31977c5d3cf2cd30a582';
function drive() {
  const cells = [{ instance: 'west', origin: { x: 0, z: 0 } }, { instance: 'east', origin: { x: 555, z: 0 } }];
  const allocator = new ResidencyAllocator(), live = new Map<string, Set<number>>();
  const pending: { tile: RingTile; done: (value: string) => void }[] = [], events: string[] = [], trace: unknown[] = [];
  const ports: RingPorts<string> = {
    fetch: (tile, done) => { events.push(`fetch:${tile.key}`); pending.push({ tile, done }); },
    upload: tile => { events.push(`upload:${tile.key}`); live.set(tile.key, new Set()); return {
      mask: excluded => { live.set(tile.key, new Set(excluded)); }, shadow: () => undefined,
      dispose: () => { events.push(`dispose:${tile.key}`); live.delete(tile.key); },
    }; },
    cancel: tile => { events.push(`cancel:${tile.key}`); },
    discard: tile => { events.push(`discard:${tile.key}`); },
  };
  const bytes = (_instance: string, level: RingLevel): number => level === 'far' ? 8000 : level === 'l1' ? 2000 : 1000;
  const streamer = new TileStreamer(cells, { reserve: claim => allocator.reserve(claim), now: () => 0 }, bytes, ports);
  let holes = 0, overlaps = 0, readyFrames = 0;
  for (let frame = 0; frame <= 120; frame++) {
    if (frame % 3 === 0) for (const row of pending.splice(0)) row.done(row.tile.key);
    // Initial settle, then exactly 1000 metres in 10 m increments.
    const x = -500 + Math.max(0, frame - 20) * 10;
    streamer.step({ x, z: 0, vx: frame > 20 ? 10 : 0, vz: 0 });
    if (streamer.ready()) {
      readyFrames++;
      for (const cell of streamer.visible()) for (let z = 0; z < 8; z++) for (let i = 0; i < 8; i++) {
        const far = live.get(`${cell.instance}:far`), coarse = live.get(`${cell.instance}:l1/${String(Math.floor(i / 2))}/${String(Math.floor(z / 2))}`);
        const full = live.has(`${cell.instance}:l0/${String(i)}/${String(z)}`);
        const count = Number(far !== undefined && !far.has(Math.floor(i / 2) + 4 * Math.floor(z / 2)))
          + Number(coarse !== undefined && !coarse.has(i % 2 + 2 * (z % 2))) + Number(full);
        if (count === 0) holes++; if (count > 1) overlaps++;
      }
    }
    trace.push({ resident: streamer.resident(), stats: streamer.stats(),
      masks: [...live].sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => [key, [...values].sort((a, b) => a - b)]),
      claims: allocator.entries(), events: events.splice(0) });
  }
  streamer.dispose();
  // Fetches finishing after retirement can only discard, never publish a view.
  for (const row of pending.splice(0)) row.done(row.tile.key);
  expect(live.size).toBe(0); expect(allocator.entries()).toHaveLength(0);
  return { digest: hashImmutableBytes(new TextEncoder().encode(JSON.stringify(trace))), holes, overlaps, readyFrames };
}

test('the engine keeps the original 1 km trace with no ready-frame holes or overlaps', () => {
  const result = drive();
  expect(result.holes).toBe(0); expect(result.overlaps).toBe(0);
  expect(result.readyFrames).toBeGreaterThan(100);
  expect(result.digest).toBe(BASELINE);
});

test('invalid cell data refuses before any borrowed render or budget service runs', () => {
  const allocator = new ResidencyAllocator();
  const ports: RingPorts<string> = { fetch: () => { throw new Error('Unexpected fetch'); }, upload: () => { throw new Error('Unexpected upload'); } };
  expect(() => new TileStreamer([{ instance: 'bad', origin: { x: Number.NaN, z: 0 } }], allocator, () => 1, ports)).toThrow('Invalid ring cells');
  expect(allocator.entries()).toHaveLength(0);
});

function timedUploads(cost: number, options: RingOptions = {}) {
  let now = 0;
  const allocator = new ResidencyAllocator();
  const budget: TileStreamBudget = { reserve: claim => allocator.reserve(claim), now: () => now };
  const cells = Array.from({ length: 4 }, (_, index) => ({ instance: `cell${String(index)}`, origin: { x: index * 555, z: 0 } }));
  const drawn = new Set<string>();
  const ports: RingPorts<string> = {
    fetch: (tile, done) => { done(tile.key); },
    upload: tile => { now += cost; drawn.add(tile.key); return {
      mask: () => undefined, shadow: () => undefined, dispose: () => { drawn.delete(tile.key); },
    }; },
  };
  const streamer = new TileStreamer(cells, budget, (_instance, level) => level === 'far' ? 1000 : null, ports,
    { viewDistance: 3000, farRadius: 3000, uploadsPerFrame: 4, uploadBytesPerFrame: 4000, ...options });
  return { streamer, allocator, drawn };
}
const camera = { x: 0, z: 0, vx: 0, vz: 0 };

test('elapsed uploads pause refinement without dropping its scopes or claims', () => {
  const f = timedUploads(12);
  try {
    f.streamer.step(camera);
    expect(f.streamer.stats()).toMatchObject({ resident: { far: 1 }, queued: 3, uploads: 1 });
    expect(f.allocator.entries()).toHaveLength(4);
    expect(f.streamer.ready()).toBe(false);
    for (let frame = 1; frame < 4; frame++) {
      f.streamer.step(camera);
      expect(f.streamer.stats().uploads).toBe(frame + 1);
    }
    expect(f.streamer.ready()).toBe(true);
  } finally { f.streamer.dispose(); }
  expect(f.drawn.size).toBe(0); expect(f.allocator.entries()).toHaveLength(0);
});

test.each([
  { cost: 1, options: { uploadsPerFrame: 2 }, uploads: 2 },
  { cost: 1, options: { uploadBytesPerFrame: 2000 }, uploads: 2 },
  { cost: 8, options: { uploadMsPerFrame: 8 }, uploads: 1 },
  { cost: 30, options: { uploadMsPerFrame: 12 }, uploads: 1 },
])('count, byte and time limits independently bound new uploads: %o', ({ cost, options, uploads }) => {
  const f = timedUploads(cost, options);
  try { f.streamer.step(camera); expect(f.streamer.stats().uploads).toBe(uploads); }
  finally { f.streamer.dispose(); }
  expect(f.allocator.entries()).toHaveLength(0);
});

test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('invalid time budget %s refuses before preparation', uploadMsPerFrame => {
  expect(() => timedUploads(1, { uploadMsPerFrame })).toThrow('Invalid tile upload time budget');
});

test.each(['nested', 'throw'] as const)('release planning survives %s disposal without changing the remaining order', action => {
  const allocator = new ResidencyAllocator(), disposed: string[] = [];
  let entered = false;
  let nested = (): void => { throw new Error('Missing live streamer'); };
  const ports: RingPorts<string> = {
    fetch: (tile, done) => { done(tile.key); },
    upload: tile => ({ mask: () => undefined, shadow: () => undefined, dispose: () => {
      disposed.push(tile.key);
      if (entered) return;
      entered = true;
      if (action === 'throw') throw new Error('Fixture cleanup failed');
      // This nested camera still wants b/c. The outer release must retain its
      // own plan and finish dropping them in its original distance order.
      nested();
    } }),
  };
  const streamer = new TileStreamer(['a', 'b', 'c'].map((instance, index) => ({ instance, origin: { x: index * 555, z: 0 } })),
    { reserve: claim => allocator.reserve(claim), now: () => 0 }, (_instance, level) => level === 'far' ? 1000 : null, ports,
    { viewDistance: 1500, farRadius: 1500, uploadsPerFrame: 4 });
  nested = () => { streamer.step({ x: 2000, z: 0, vx: 0, vz: 0 }); };
  try {
    streamer.step(camera);
    expect(streamer.resident()).toEqual(['a:far', 'b:far', 'c:far']);
    const away = { x: 10000, z: 0, vx: 0, vz: 0 };
    if (action === 'throw') {
      expect(() => streamer.step(away)).toThrow('Ring tile cleanup failed');
      expect(disposed).toEqual(['a:far']);
    }
    streamer.step(away);
    expect(disposed).toEqual(['a:far', 'b:far', 'c:far']);
    expect(streamer.resident()).toEqual([]);
    expect(allocator.entries()).toEqual([]);
  } finally { streamer.dispose(); }
});

test('replanning keeps fresh public descriptors and rejects an old construction completion', () => {
  const allocator = new ResidencyAllocator(), received: RingTile[] = [], discarded: string[] = [];
  const completions: ((value: string) => void)[] = [];
  const ports: RingPorts<string> = {
    fetch: (tile, done) => { received.push(tile); completions.push(done); done(tile.key); },
    upload: () => ({ mask: () => undefined, shadow: () => undefined, dispose: () => undefined }),
    discard: (_tile, data) => { discarded.push(data); },
  };
  const streamer = new TileStreamer([{ instance: 'home', origin: { x: 0, z: 0 } }],
    { reserve: claim => allocator.reserve(claim), now: () => 0 }, (_instance, level) => level === 'far' ? 1000 : null, ports);
  try {
    streamer.step(camera);
    const original = received[0]; if (original === undefined) throw new Error('Missing original tile');
    Object.defineProperty(original, 'constructionMarker', { value: 1, enumerable: true });
    for (let frame = 0; frame < 5; frame++) streamer.step(camera);
    expect(received).toHaveLength(1);
    streamer.step({ x: 10000, z: 0, vx: 0, vz: 0 });
    streamer.step(camera);
    const next = received[1]; if (next === undefined) throw new Error('Missing replacement tile');
    expect(next).not.toBe(original);
    expect(next).toEqual({ key: 'home:far', instance: 'home', type: 'level', level: 'far', x: 0, z: 0 });
    completions[0]?.('obsolete'); streamer.step(camera);
    expect(discarded).toEqual(['obsolete']);
    expect(streamer.resident()).toEqual(['home:far']);
  } finally { streamer.dispose(); }
  expect(allocator.entries()).toEqual([]);
});

test('required zero keys retain the original Set coordinate canonicalization', async () => {
  const allocator = new ResidencyAllocator(), received: RingTile[] = [];
  const streamer = new TileStreamer([{ instance: 'home', origin: { x: 0, z: 0 } }],
    { reserve: claim => allocator.reserve(claim), now: () => 0 }, (_instance, level) => level === 'l0' ? 1000 : null,
    { fetch: (tile, done) => { received.push(tile); done(tile.key); }, upload: () => ({ mask: () => undefined, shadow: () => undefined, dispose: () => undefined }) });
  const away = { x: 10000, z: 0, vx: 0, vz: 0 };
  try {
    const negative = streamer.require('home', [-0]); streamer.step(away); await negative.ready;
    expect(Object.is(received[0]?.x, 0)).toBe(true); expect(Object.is(received[0]?.z, 0)).toBe(true);
    negative.release(); streamer.step(away);
    const positive = streamer.require('home', [0]); streamer.step(away); await positive.ready;
    expect(received).toHaveLength(2);
    expect(Object.is(received[1]?.x, 0)).toBe(true); expect(Object.is(received[1]?.z, 0)).toBe(true);
    positive.release();
  } finally { streamer.dispose(); }
});
