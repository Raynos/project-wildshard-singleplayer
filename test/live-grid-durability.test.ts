// oxlint-disable-next-line import/no-nodejs-modules -- Use shipped native physics and admitted immutable template assets.
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import { SaveStore } from '../src/engine/saves/store';
import { loadRapier } from '../src/engine/physics/rapier';
import { ReadinessWalls, type ReadinessEdge } from '../src/engine/physics/readinessWalls';
import { createSimHost } from '../src/engine/sim';
import { snapshotSimHost, serializeSimSnapshot } from '../src/engine/sim/snapshot';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { EmptyEquipment } from '../src/game/shardfile/emptyEquipment';
import * as simulation from '../src/game/shardfile/simulation';
import * as products from '../src/game/grid/products';
import { LiveGridSession } from '../src/game/grid/liveSession';
import { GridRegionDurability } from '../src/game/grid/durability';
import { GridAssembly, type GridCell } from '../src/game/grid/assembly';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { GRID_CONTINUATION_CACHE_BYTES } from '../src/game/grid/continuations';
import { parseMigrations } from '../src/game/shardfile/migrations';
import source from '../src/shards/_template/shard.config';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { MemoryStorage } from './setup';

class Storage extends MemoryStorage {
  fail = false;
  override setItem(key: string, value: string): void { if (this.fail) throw new Error('Quota'); super.setItem(key, value); }
}

function browserEvents(): () => void {
  const restore = ['window', 'document'].map((name) => {
    const before = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: new EventTarget() });
    return () => { if (before === undefined) Reflect.deleteProperty(globalThis, name); else Object.defineProperty(globalThis, name, before); };
  });
  return () => { for (const reset of restore) reset(); };
}

function neighbourEdges(cell: GridCell, origin: { x: number; z: number }): ReadinessEdge[] {
  const x = cell.origin.x - origin.x, z = cell.origin.z - origin.z, r = 256;
  return [{ instance: cell.instance, x: x + r, z, axis: 'x', halfLength: r, floor: 0 },
    { instance: cell.instance, x: x - r, z, axis: 'x', halfLength: r, floor: 0 },
    { instance: cell.instance, x, z: z + r, axis: 'z', halfLength: r, floor: 0 },
    { instance: cell.instance, x, z: z - r, axis: 'z', halfLength: r, floor: 0 }];
}
function rimEdges(): ReadinessEdge[] {
  return [{ instance: null, x: 2000, z: 0, axis: 'x', halfLength: 2000, floor: 0 },
    { instance: null, x: -2000, z: 0, axis: 'x', halfLength: 2000, floor: 0 },
    { instance: null, x: 0, z: 2000, axis: 'z', halfLength: 2000, floor: 0 },
    { instance: null, x: 0, z: -2000, axis: 'z', halfLength: 2000, floor: 0 }];
}

it('holds a real live crossing on home or region save refusal and reloads the earned quest and coins', async () => {
  const assets = new Map(source.files.map((file) => [file.hash, readFileSync(`src/shards/_template/assets/${file.hash}`)]));
  vi.spyOn(products, 'gridShardfileProduct').mockReturnValue(Promise.resolve({ admitted: { source, assets, cached: false },
    options: { base: 'https://fixture.invalid/', offline: false, firstParty: true, fetch: () => Promise.reject(new Error('No fixture network')), hash: () => Promise.reject(new Error('Already admitted')) } }));
  const regions: simulation.ShardfileSimulation[] = [], create = simulation.createShardfileSim;
  let pageScope: Scope | undefined;
  vi.spyOn(simulation, 'createShardfileSim').mockImplementation((...args) => {
    const sim = withOwner(pageScope ?? null, () => create(...args)); regions.push(sim); return sim;
  });
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const assembly = new GridAssembly({ developer: false, devserver: false }), home = assembly.cell('driftwood-isle'), target = assembly.cell('template-3');
  const pageHost = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  const homeBaseline = { bodies: pageHost.physics.world.bodies.len(), colliders: pageHost.physics.world.colliders.len() };
  const restoreGlobals = browserEvents();
  const local = new Storage(), store = new SaveStore({ local, session: null });
  let homeDurable = false;
  const open = () => {
    const scope = new Scope('live.durability'), pre: (() => void)[] = [], post: (() => void)[] = [];
    const allocator = new ResidencyAllocator();
    pageScope = scope;
    let currentPhysics = pageHost.physics;
    let mounted = true;
    const dismount = vi.fn(() => { mounted = false; });
    const traveller = { position: pageHost.player.position, yaw: 0, motor: pageHost.releasePlayerMotor(), camera: new PerspectiveCamera(), hoverSpeedLimit: null,
      hover: true, get ride() { return mounted ? { dismount } : null; },
      bindFrame: (physics: typeof pageHost.physics, motor: typeof pageHost.player.motor) => { currentPhysics = physics; traveller.motor = motor; } };
    const session = withOwner(scope, () => new LiveGridSession({ assembly, home, physics: pageHost.physics, scope, walls: new ReadinessWalls(pageHost.physics, [], scope),
      strips: [], allocator, neighbourEdges, rimEdges }, {
      traveller, health: pageHost.player.health, equipment: new EquipmentService(new EmptyEquipment(), { scope }), events: pageHost.events,
      saves: store, checkpoint: () => homeDurable, catalogue: [], setPhysics: (physics) => { currentPhysics = physics; },
      onFixedPre: (fn) => { pre.push(fn); }, onFixedPost: (fn) => { post.push(fn); }, onInput: () => undefined, onUpdate: () => undefined,
    }));
    return { session, scope, traveller, allocator, dismount, tick: () => withOwner(scope, () => { for (const fn of pre) fn(); currentPhysics.step(); for (const fn of post) fn(); }) };
  };
  const first = open();
  expect(first.allocator.entries().find((entry) => entry.id === `sim-continuations:live:${home.instance}`)?.bytes).toBe(GRID_CONTINUATION_CACHE_BYTES);
  expect(first.scope.census.colliders).toBe(0); // highway walls belong to their independent world, never the page
  const settle = async (tick: () => void): Promise<void> => { for (let turn = 0; turn < 20; turn++) { await Promise.resolve(); tick(); } };
  try {
    const reserve = first.allocator.reserve.bind(first.allocator);
    const denyBasis = vi.spyOn(first.allocator, 'reserve').mockImplementation((claim) => claim.id === `sim-basis:${target.instance}` ? null : reserve(claim));
    await expect(first.session.live.prefetch([target.instance])).rejects.toThrow('checkpoint basis exceeds residency budget');
    expect(regions.every((region) => region.host.scope.disposed)).toBe(true);
    expect(first.allocator.has(`sim:${target.instance}`)).toBe(false);
    denyBasis.mockRestore(); first.session.live.retry(target.instance);
    await first.session.live.prefetch([target.instance]);
    expect(first.allocator.entries().find((entry) => entry.id === `sim-basis:${target.instance}`)?.bytes).toBeGreaterThan(300_000);
    expect(first.scope.census.colliders).toBe(0); // admitted terrain and props also stay in their regional scope
    pageHost.player.position.set(270, 1, 270); await settle(first.tick);
    expect(first.session.frame()).toBe(home.instance);
    expect(first.session.state().crossing.issue).toBe('Local checkpoint is not durable');
    expect(first.dismount).toHaveBeenCalledOnce(); expect(first.traveller.ride).toBeNull(); expect(first.traveller.hover).toBe(true);
    homeDurable = true; first.tick(); expect(first.session.frame()).toBeNull();
    pageHost.player.position.set(target.origin.x, 1, target.origin.z); await settle(first.tick);
    expect(first.session.frame()).toBe(target.instance);
    expect(first.dismount).toHaveBeenCalledOnce(); expect(first.traveller.ride).toBeNull(); expect(first.traveller.hover).toBe(true);
    const region = regions.find((value) => value.host.state.tick > 0);
    if (region === undefined) throw new Error('Missing running native region');
    expect(first.session.simulation(target.instance)).toBe(region);
    pageHost.player.position.set(0, 1, -9); first.tick();
    const blob = region.host.entities.get('grey-blob:1'); if (blob === undefined) throw new Error('Missing quest blob');
    region.host.combat.hit({ source: pageHost.player.health, sourceTags: ['dmg.melee', 'cover.checked'], target: blob.combatActor(), amount: 1000,
      point: blob.position, from: pageHost.player.position, dir: new Vector3(0, 0, 1) }); first.tick();
    expect(region.host.flags.has('template.complete')).toBe(true);
    local.fail = true;
    pageHost.player.position.set(270, 1, 270); await settle(first.tick);
    expect(first.session.frame()).toBe(target.instance);
    expect(first.session.state().crossing.issue).toBe('Local checkpoint is not durable');
    local.fail = false; first.tick(); expect(first.session.frame()).toBeNull();
    expect(first.session.live.state().continuations.storedChars).toBeGreaterThan(0);
    const reload = new GridRegionDurability(new SaveStore({ local, session: null }), { id: target.instance, shard: target.slug }, source, []);
    const freshBasis = create(source, assets, { rapier, playerBody: false, groundResolution: 257, quest: reload.quest });
    try { reload.setPhysicsBasis(freshBasis.host.physics.snapshot()); } finally { freshBasis.dispose(); }
    expect(reload.read()?.flags).toContain('template.complete'); expect(reload.wallet.coins()).toBe(5);
    expect(Object.values(reload.ledger.state().facts)).toHaveLength(1);
    expect(new GridRegionDurability(new SaveStore({ local, session: null }), { id: 'template-2', shard: '_template' }, source, []).wallet.coins()).toBe(0);
    expect(first.session.live.unload(target.instance)).toBe(true);
    expect(first.session.live.state().continuations.entries).toBe(0);
    expect(first.allocator.has(`sim-continuations:live:${home.instance}`)).toBe(true);
    pageHost.player.position.set(target.origin.x, 1, target.origin.z); await settle(first.tick);
    expect(first.session.frame()).toBe(target.instance);
    expect(first.session.simulation(target.instance)?.host.flags.has('template.complete')).toBe(true);
  } finally {
    try {
      withOwner(first.scope, () => { first.scope.dispose(); });
      expect(regions.every((region) => region.host.scope.disposed)).toBe(true);
      expect(first.session.live.state().residents).toEqual([]);
      expect(first.allocator.entries()).toEqual([]);
      expect(first.session.live.state().continuations).toMatchObject({ entries: 0, storedChars: 0, claimedBytes: 0 });
      expect({ bodies: pageHost.physics.world.bodies.len(), colliders: pageHost.physics.world.colliders.len() }).toEqual(homeBaseline);
    } finally {
      pageHost.attachPlayerMotor(first.traveller.motor); pageHost.dispose(); restoreGlobals();
    }
    expect(pageHost.physics.world.colliders).toBeUndefined(); expect(pageHost.physics.world.bodies).toBeUndefined();
  }
});

it('admits an old-revision region through its logical companion before exposing the fresh simulation', async () => {
  const assets = new Map(source.files.map((file) => [file.hash, readFileSync(`src/shards/_template/assets/${file.hash}`)]));
  const nextSource = { ...source, identity: { ...source.identity, revision: source.identity.revision + 1 },
    migrations: parseMigrations([{ from: 1, to: 2, fields: [{ op: 'default', scope: 'shared', field: { id: 303, name: 'checkpoint.added', type: 'f64', value: 0.4 } }] }]),
    state: { ...source.state, version: 2, shared: [...source.state.shared, { id: 303, name: 'checkpoint.added', type: 'f64' as const, privacy: 'public' as const, default: 0.25 }] } };
  vi.spyOn(products, 'gridShardfileProduct').mockReturnValue(Promise.resolve({ admitted: { source: nextSource, assets, cached: false },
    options: { base: 'https://fixture.invalid/', offline: false, firstParty: true, fetch: () => Promise.reject(new Error('No fixture network')), hash: () => Promise.reject(new Error('Already admitted')) } }));
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const assembly = new GridAssembly({ developer: false, devserver: false }), home = assembly.cell('driftwood-isle'), target = assembly.cell('template-3');
  const local = new MemoryStorage(), store = new SaveStore({ local, session: null });
  const old = new GridRegionDurability(store, { id: target.instance, shard: target.slug }, source, []);
  const previous = simulation.createShardfileSim(source, assets, { rapier, quest: old.quest }); old.bind(previous.host);
  const basis = previous.host.physics.snapshot(); old.setPhysicsBasis(basis);
  try {
    for (const flag of source.quests.flags) previous.host.flags.set(flag);
    previous.host.step(); old.wallet.addCoins(9);
    const snapshot = snapshotSimHost(previous.host); expect(old.checkpoint(snapshot)).toBe(true);
    const key = `wildshard.save.v2.${target.instance}`, bytes = local.getItem(key);
    if (bytes === null) throw new Error('Missing old regional save');
    local.setItem(key, bytes.replace(JSON.stringify(serializeSimSnapshot(snapshot, basis)), JSON.stringify('old engine unavailable')));
  } finally { previous.dispose(); }
  const pageHost = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  const restoreGlobals = browserEvents();
  const scope = new Scope('live.migration');
  const traveller = { position: pageHost.player.position, yaw: 0, motor: pageHost.releasePlayerMotor(), camera: new PerspectiveCamera(), hoverSpeedLimit: null,
    bindFrame: (_physics: typeof pageHost.physics, motor: typeof pageHost.player.motor) => { traveller.motor = motor; } };
  const session = new LiveGridSession({ assembly, home, physics: pageHost.physics, scope, walls: new ReadinessWalls(pageHost.physics, [], scope),
    strips: [], allocator: new ResidencyAllocator(), neighbourEdges: () => [], rimEdges: () => [] }, {
    traveller, health: pageHost.player.health, equipment: new EquipmentService(new EmptyEquipment(), { scope }), events: pageHost.events,
    saves: store, checkpoint: () => true, catalogue: [], setPhysics: () => undefined,
    onFixedPre: () => undefined, onFixedPost: () => undefined, onInput: () => undefined, onUpdate: () => undefined,
  });
  try {
    await session.live.prefetch([target.instance]);
    const fresh = session.simulation(target.instance); if (fresh === undefined) throw new Error('Missing freshly admitted region');
    expect(fresh.host.flags.has('template.complete')).toBe(true); expect(fresh.quest.quests[0]?.isComplete).toBe(true);
    expect(fresh.lane?.world.view(fresh.host.player.id).shared['checkpoint.added']).toBe(0.4);
    expect(old.wallet.coins()).toBe(14); expect(Object.values(old.ledger.state().facts)).toHaveLength(1);
    expect(local.getItem(`wildshard.save.v2.${target.instance}`)).toContain('old engine unavailable');
    expect(session.live.ready(target.instance)).toBe(true); expect(session.frame()).toBe(home.instance);
  } finally { scope.dispose(); pageHost.attachPlayerMotor(traveller.motor); pageHost.dispose(); restoreGlobals(); }
});
