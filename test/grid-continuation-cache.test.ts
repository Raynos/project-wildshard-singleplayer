// oxlint-disable-next-line import/no-nodejs-modules -- Exercise exact continuation bytes from the shipped native physics binary.
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { snapshotSimHost, serializeSimSnapshot } from '../src/engine/sim/snapshot';
import { GridContinuationCache, GRID_CONTINUATION_CACHE_BYTES, GRID_CONTINUATION_CACHE_CHARS } from '../src/game/grid/continuations';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { LiveGridHost, type LiveGridPorts } from '../src/game/grid/live';
import { GridAssembly } from '../src/game/grid/assembly';
import { ResidencyAllocator } from '../src/game/grid/allocator';

it('retains an exact packed continuation without retaining mutable decoded physics arrays', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const host = createSimHost(SIM_LEVEL, { rapier });
  try {
    host.flags.set('cache.fixture'); host.step();
    const snapshot = snapshotSimHost(host), cache = new GridContinuationCache();
    const packed = cache.pack('fixture', snapshot);
    if (packed === null) throw new Error('Small native fixture exceeds packed cache');
    cache.store('fixture', packed);
    const first = cache.read('fixture');
    if (first === undefined) throw new Error('Missing continuation');
    expect(first).toEqual(snapshot);
    first.physics.fill(0); first.flags.push('mutated');
    expect(cache.read('fixture')).toEqual(snapshot);
    expect(cache.state().storedChars).toBe(packed.length + 'fixture'.length);
    expect(GRID_CONTINUATION_CACHE_BYTES).toBe(GRID_CONTINUATION_CACHE_CHARS * 4 + 16 * 1024);
  } finally { host.dispose(); }
});

it('reserves the cache before allocating owned worlds and releases every lease on construction failure', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const host = createSimHost(SIM_LEVEL, { rapier });
  const motor = host.releasePlayerMotor(), allocator = new ResidencyAllocator();
  const create = vi.fn(() => { throw new Error('Highway construction failed'); });
  const ports: LiveGridPorts = {
    home: { instance: 'driftwood-isle', physics: host.physics, bytes: 1000, checkpoint: () => true },
    player: { position: host.player.position, yaw: 0, health: host.player.health, owner: host.player, motor }, allocator,
    highway: { bytes: 1000, create }, admit: () => Promise.reject(new Error('Unused')),
    save: () => true, bindFrame: () => undefined, gameplayReady: () => true,
    readiness: { link: { speed: 15, linkBitsPerSecond: 1_000_000, requestLatencySeconds: 0, maxStallSeconds: 0 },
      bundle: () => ({ criticalWireBytes: 0, hybridWireBytes: 0, decodeSeconds: 0, runtimeParseSeconds: 0 }) },
  };
  const assembly = new GridAssembly({ developer: false, devserver: false });
  try {
    const denied = vi.spyOn(allocator, 'reserve').mockReturnValue(null);
    expect(() => new LiveGridHost(assembly, ports)).toThrow('continuation cache admission deferred');
    expect(create).not.toHaveBeenCalled(); expect(allocator.entries()).toEqual([]);
    denied.mockRestore();
    expect(() => new LiveGridHost(assembly, ports)).toThrow('Highway construction failed');
    expect(create).toHaveBeenCalledOnce(); expect(allocator.entries()).toEqual([]);
  } finally { host.attachPlayerMotor(motor); host.dispose(); }
});

it('refuses aggregate overflow atomically and bounds the number of retained region keys', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const host = createSimHost(SIM_LEVEL, { rapier });
  try {
    const snapshot = snapshotSimHost(host), wire = serializeSimSnapshot(snapshot);
    const cache = new GridContinuationCache(wire.length + 1);
    cache.store('a', wire);
    expect(cache.pack('b', snapshot)).toBeNull();
    expect(() => cache.store('b', wire)).toThrow('capacity exceeded');
    expect(cache.read('a')).toEqual(snapshot);
    expect(cache.pack('a', snapshot)).toBe(wire);
    cache.store('a', wire); expect(cache.state().storedChars).toBe(wire.length + 1);
    cache.drop('a'); expect(cache.state().storedChars).toBe(0);
    cache.store('b', wire); cache.clear(); expect(cache.state().entries).toBe(0);
    const keys = new GridContinuationCache();
    for (let index = 0; index < 9; index++) keys.store(String(index), wire);
    expect(keys.pack('tenth', snapshot)).toBeNull();
    expect(keys.state().entries).toBe(9);
  } finally { host.dispose(); }
});
