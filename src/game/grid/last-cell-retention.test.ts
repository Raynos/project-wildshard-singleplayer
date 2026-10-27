import { expect, test } from 'vitest';
import { CONTENT_CAPS } from '@wildshard/engine/core/config';
import { loadRapier } from '@wildshard/engine/physics/rapier';
import { createSimHost, type SimLevel } from '@wildshard/engine/sim';
import { fixtureBytes } from '@wildshard/engine/test/nativeBytes';
import { GridAssembly } from './assembly';
import { LiveGridHost } from './live';
import { PageResidency } from './pageResidency';

const level: SimLevel = { version: 1, id: 'platform', seed: 1, ground: { size: 500, height: 0 },
  player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 30 }, entities: [], quests: [],
  weapon: { id: 'none', shape: { kind: 'point', radius: 0 }, windup: 0, active: 0, recover: 0, cooldown: 0, range: 0, damage: 0, tags: [] } };

async function fixture(options: { cap?: number; isolated?: boolean } = {}) {
  const rapier = await loadRapier(Uint8Array.from(fixtureBytes(new URL('../../../node_modules/@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm', import.meta.url))));
  const assembly = new GridAssembly({ developer: false, devserver: false }), home = assembly.cell('driftwood-isle');
  const next = assembly.cells.find(cell => cell.instance !== home.instance);
  if (next === undefined) throw new Error('Missing second cell');
  const page = createSimHost(level, { rapier }), residency = new PageResidency(), created: string[] = [], disposed: string[] = [];
  const objects = new Map<string, object>(), allocated: { instance: string; owners: string[] }[] = [];
  const expiries: { run: () => void; delay: number; cancelled: boolean }[] = [];
  const control = { dispose: true, checkpoint: true };
  const player = { position: page.player.position, yaw: 0, health: page.player.health, owner: page.player, motor: page.releasePlayerMotor() };
  const live = new LiveGridHost(assembly, {
    home: { mode: 'owned', instance: home.instance, bytes: 50_000_000, residency: residency.admitHome(home.instance, 50_000_000) },
    player, allocator: residency.allocator, continuations: 'durable', save: () => true,
    lastCell: { windowMs: 30_000, playingBytes: options.cap ?? CONTENT_CAPS.playing, schedule: (run, delay) => {
      const expiry = { run, delay, cancelled: false }; expiries.push(expiry); return () => { expiry.cancelled = true; };
    } },
    bindFrame: () => undefined, gameplayReady: () => true, prefetchable: () => false,
    highway: { bytes: 1000, create: () => ({ physics: page.physics, dispose: () => undefined }) },
    readiness: { link: { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: .25, maxStallSeconds: 3 },
      bundle: () => ({ criticalWireBytes: 1000, hybridWireBytes: 1000, decodeSeconds: 0, runtimeParseSeconds: 0 }) },
    admit: cell => Promise.resolve({ bytes: 50_000_000, exclusiveRuntime: true, isolatedPreparation: options.isolated !== false,
      reloadsCheckpoint: true, prepareRuntime: () => Promise.resolve(), create: () => {
        created.push(cell.instance); objects.set(cell.instance, {});
        allocated.push({ instance: cell.instance, owners: [...residency.allocator.claims()].map(row => row.owner) });
        const host = createSimHost(level, { rapier, playerBody: false, ground: false });
        return Promise.resolve({ host, checkpoint: () => control.checkpoint, dispose: () => {
          if (!control.dispose) throw new Error('Retirement refused');
          disposed.push(cell.instance); host.dispose();
        } });
      } }),
  });
  const enter = async (instance: string): Promise<void> => { const frame = await live.prepare(null, instance); frame.commit(); };
  const leave = async (): Promise<boolean> => {
    const from = live.current(); if (from === null) throw new Error('Missing entered cell');
    const frame = await live.prepare(from, null); frame.commit(); return live.retainDeparted(from);
  };
  const settle = async (): Promise<void> => { live.beforeFixed(); await live.prefetch([]); };
  return { live, home, next, residency, created, disposed, objects, allocated, expiries, control, enter, leave, settle,
    close: () => { control.dispose = true; live.dispose(); player.motor.dispose(); page.dispose(); residency.dispose(); } };
}

test('return reattaches the same complete world and fully charged claim without construction', async () => {
  const f = await fixture();
  try {
    await f.enter(f.home.instance); const object = f.objects.get(f.home.instance);
    expect(await f.leave()).toBe(true); await f.settle();
    expect(f.expiries[0]?.delay).toBe(30_000);
    expect(f.live.state().retainedCell?.instance).toBe(f.home.instance);
    const claim = f.residency.allocator.entries().find(row => row.id === `sim:${f.home.instance}`);
    expect(claim).toMatchObject({ bytes: 50_000_000, needed: false, holds: 0 });
    await f.enter(f.home.instance);
    expect(f.created).toEqual([f.home.instance]); expect(f.objects.get(f.home.instance)).toBe(object);
    expect(f.disposed).toEqual([]); expect(f.live.state().retainedCell).toBeNull();
    f.expiries[0]?.run(); expect(f.live.ready(f.home.instance)).toBe(true);
  } finally { f.close(); }
});

test('entering a different cell retires the kept world before the next allocation', async () => {
  const f = await fixture();
  try {
    await f.enter(f.home.instance); await f.leave(); await f.enter(f.next.instance);
    expect(f.disposed).toEqual([f.home.instance]); expect(f.expiries[0]?.cancelled).toBe(true);
    expect(f.allocated[1]?.owners).not.toContain(f.home.instance);
    expect(f.live.state().residents).toEqual([f.next.instance]);
  } finally { f.close(); }
});

test('expiry releases the world and claim without waiting for another fixed tick', async () => {
  const f = await fixture();
  try {
    await f.enter(f.home.instance); await f.leave(); f.expiries[0]?.run();
    expect(f.disposed).toEqual([f.home.instance]); expect(f.live.state().retainedCell).toBeNull();
    expect(f.residency.allocator.entries().some(row => row.owner === f.home.instance)).toBe(false);
    await f.enter(f.home.instance); expect(f.created).toEqual([f.home.instance, f.home.instance]);
  } finally { f.close(); }
});

test('allocator pressure durably evicts an unneeded kept world before admitting replacement bytes', async () => {
  const f = await fixture();
  try {
    await f.enter(f.home.instance); await f.leave();
    const baseline = f.residency.allocator.ownerCost('pressure').playing;
    const bytes = Math.floor((CONTENT_CAPS.playing - baseline) / CONTENT_CAPS.residentFactor) - 1000;
    const lease = f.residency.allocator.reserve({ id: 'pressure', owner: 'pressure', category: 'library', bytes, needed: true, distance: 0 });
    try {
      expect(lease).not.toBeNull(); expect(f.disposed).toEqual([f.home.instance]);
      expect(f.live.state().retainedCell).toBeNull(); expect(f.live.ready(f.home.instance)).toBe(false);
    } finally { lease?.release(); }
  } finally { f.close(); }
});

test('retention refuses insufficient per-shard headroom and non-isolated factories', async () => {
  for (const options of [{ cap: 1 }, { isolated: false }]) {
    const f = await fixture(options);
    try { await f.enter(f.home.instance); expect(await f.leave()).toBe(false); await f.settle(); expect(f.expiries).toEqual([]); expect(f.disposed).toEqual([f.home.instance]); }
    finally { f.close(); }
  }
});

test('expiry during a prepared return cannot free its held world; cancellation makes it retireable', async () => {
  const f = await fixture();
  try {
    await f.enter(f.home.instance); await f.leave();
    const pending = f.live.prepare(null, f.home.instance); f.expiries[0]?.run();
    const frame = await pending;
    expect(f.disposed).toEqual([]); frame.cancel(); await f.settle();
    expect(f.disposed).toEqual([f.home.instance]); expect(f.live.state().retainedCell).toBeNull();
  } finally { f.close(); }
});

test('failed retained-world disposal remains charged and blocks another constructor', async () => {
  const f = await fixture();
  try {
    await f.enter(f.home.instance); await f.leave(); f.control.dispose = false; f.expiries[0]?.run();
    expect(f.residency.allocator.entries().some(row => row.owner === f.home.instance)).toBe(true);
    await expect(f.enter(f.next.instance)).rejects.toThrow('Exclusive runtime awaits successful disposal');
    expect(f.created).toEqual([f.home.instance]);
  } finally { f.close(); }
});

test('pressure cannot uncharge a retained world whose disposal failed', async () => {
  const f = await fixture();
  try {
    await f.enter(f.home.instance); await f.leave(); f.control.dispose = false;
    const baseline = f.residency.allocator.ownerCost('pressure').playing;
    const bytes = Math.floor((CONTENT_CAPS.playing - baseline) / CONTENT_CAPS.residentFactor) - 1000;
    expect(() => f.residency.allocator.reserve({ id: 'pressure', owner: 'pressure', category: 'library', bytes, needed: true, distance: 0 })).toThrow('Retained world disposal failed');
    expect(f.residency.allocator.entries().find(row => row.id === `sim:${f.home.instance}`)).toMatchObject({ bytes: 50_000_000, needed: true });
    expect(f.residency.allocator.has('pressure')).toBe(false);
    await expect(f.enter(f.next.instance)).rejects.toThrow('Exclusive runtime awaits successful disposal');
    expect(f.created).toEqual([f.home.instance]);
  } finally { f.close(); }
});
