import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { TileStreamer, type RingPorts, type RingTile, type RingLevel } from '../src/engine/world/tileStreamer';

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
  const streamer = new TileStreamer(cells, allocator, bytes, ports);
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
