import { expect, test } from 'vitest';
import { TileStreamer, type RingCell, type RingTile } from '../src/engine/world/tileStreamer';
import { ResidencyAllocator } from '../src/game/grid/allocator';

const camera = { x: -31.25, z: -31.25, vx: 0, vz: 0 };
const home: RingCell = { instance: 'home', origin: { x: 0, z: 0 } };
function fixture(cell: RingCell = home, refuseFine = false) {
  const allocator = new ResidencyAllocator(), live = new Map<string, RingTile>(), masks = new Map<string, Set<number>>();
  const streamer = new TileStreamer([cell], { now: () => 0, reserve: claim => refuseFine && claim.category === 'l0' ? null : allocator.reserve(claim) },
    () => 1000, {
      fetch: (tile, done) => { done(tile); },
      upload: tile => { live.set(tile.key, tile); return {
        mask: excluded => { masks.set(tile.key, new Set(excluded)); }, shadow: () => undefined,
        dispose: () => { live.delete(tile.key); masks.delete(tile.key); },
      }; },
    });
  const fine = (): number[] => [...live.values()].filter(tile => tile.level === 'l0').map(tile => tile.z * 8 + tile.x).sort((a, b) => a - b);
  const settle = (view = camera, player: { readonly x: number; readonly z: number } = view): void => {
    for (let step = 0; step < 90; step++) streamer.step(view, player);
  };
  return { streamer, allocator, live, masks, fine, settle };
}

function square(x: number, z: number, radius: number): number[] {
  const keys: number[] = [];
  for (let j = Math.max(0, z - radius); j <= Math.min(7, z + radius); j++)
    for (let i = Math.max(0, x - radius); i <= Math.min(7, x + radius); i++) keys.push(j * 8 + i);
  return keys;
}

test('full detail changes 5x5 to whole to 3x3 without retaining unwanted fine tiles', () => {
  const f = fixture();
  try {
    f.streamer.setFullRing('home', 2); f.settle(); expect(f.fine()).toEqual(square(3, 3, 2));
    f.streamer.setFullRing('home', 8); f.settle(); expect(f.fine()).toHaveLength(64);
    expect(f.allocator.entries().filter(row => row.category === 'l0')).toHaveLength(64);
    f.streamer.setFullRing('home', 1); f.streamer.step(camera);
    expect(f.fine()).toEqual(square(3, 3, 1));
    expect(f.allocator.entries().filter(row => row.category === 'l0')).toHaveLength(9);
    // A retired child exposes its parent's quadrant in the same step.
    expect(f.masks.get('home:l1/0/0')).toEqual(new Set());
  } finally { f.streamer.dispose(); }
  expect(f.live.size).toBe(0); expect(f.allocator.entries()).toHaveLength(0);
});

test('player centre wins over an orbit camera, with four metres of boundary hysteresis', () => {
  const f = fixture(), orbit = { ...camera, x: 20, z: 20 };
  try {
    f.streamer.setFullRing('home', 0); f.settle(orbit, { x: -2, z: -31.25 }); expect(f.fine()).toEqual([27]);
    f.settle(orbit, { x: 2, z: -31.25 }); expect(f.fine()).toEqual([27]);
    f.settle(orbit, { x: 4, z: -31.25 }); expect(f.fine()).toEqual([28]);
    f.settle(orbit, { x: -2, z: -31.25 }); expect(f.fine()).toEqual([28]);
    f.settle(orbit, { x: -4.01, z: -31.25 }); expect(f.fine()).toEqual([27]);
  } finally { f.streamer.dispose(); }
});

test('full-ring pins stay additive until released, then distance mode can resume', async () => {
  const f = fixture();
  f.streamer.setFullRing('home', 0);
  const pin = f.streamer.require('home', [63]);
  try {
    f.settle(); await pin.ready; expect(f.fine()).toEqual([27, 63]);
    pin.release(); f.streamer.step(camera); expect(f.fine()).toEqual([27]);
    f.streamer.setFullRing('home', null); f.settle(); expect(f.fine().length).toBeGreaterThan(1);
  } finally { pin.release(); f.streamer.dispose(); }
});

test.each([
  { type: 'road', width: 55, depth: 500, expected: [8, 16, 24, 32, 40] },
  { type: 'junction', width: 55, depth: 55, expected: [0] },
] as const)('full rings clip to declared $type dimensions', ({ type, width, depth, expected }) => {
  const f = fixture({ instance: 'home', origin: { x: 0, z: 0 }, type, extent: { width, depth } });
  try { f.streamer.setFullRing('home', 2); f.settle(); expect(f.fine()).toEqual(expected); }
  finally { f.streamer.dispose(); }
});

test('full selection never bypasses native budget refusal', () => {
  const f = fixture(undefined, true);
  try { f.streamer.setFullRing('home', 8); f.settle(); expect(f.fine()).toEqual([]); expect(f.streamer.stats().refused).toBeGreaterThan(0); }
  finally { f.streamer.dispose(); }
  expect(f.allocator.entries()).toHaveLength(0);
});

test('invalid rings and centres refuse before changing demand', () => {
  const f = fixture();
  try {
    for (const radius of [-1, 0.5, 9, Number.NaN, Infinity]) expect(() => f.streamer.setFullRing('home', radius)).toThrow('Invalid full tile ring');
    expect(() => f.streamer.setFullRing('missing', 2)).toThrow('Unknown ring cell');
    expect(() => f.streamer.step(camera, { x: Number.NaN, z: 0 })).toThrow('Invalid ring camera');
    expect(f.allocator.entries()).toHaveLength(0);
  } finally { f.streamer.dispose(); }
  expect(() => f.streamer.setFullRing('home', 1)).toThrow('disposed');
});
