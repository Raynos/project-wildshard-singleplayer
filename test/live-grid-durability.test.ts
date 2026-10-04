// oxlint-disable-next-line import/no-nodejs-modules -- Use shipped native physics and admitted immutable template assets.
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { SaveStore } from '../src/engine/saves/store';
import { loadRapier } from '../src/engine/physics/rapier';
import { ReadinessWalls } from '../src/engine/physics/readinessWalls';
import { createSimHost } from '../src/engine/sim';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { EmptyEquipment } from '../src/game/shardfile/emptyEquipment';
import * as simulation from '../src/game/shardfile/simulation';
import * as products from '../src/game/grid/products';
import { LiveGridSession } from '../src/game/grid/liveSession';
import { GridRegionDurability } from '../src/game/grid/durability';
import { GridAssembly } from '../src/game/grid/assembly';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import source from '../src/shards/_template/shard.config';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { MemoryStorage } from './setup';

class Storage extends MemoryStorage {
  fail = false;
  override setItem(key: string, value: string): void { if (this.fail) throw new Error('Quota'); super.setItem(key, value); }
}

it('holds a real live crossing on home or region save refusal and reloads the earned quest and coins', async () => {
  const assets = new Map(source.files.map((file) => [file.hash, readFileSync(`src/shards/_template/assets/${file.hash}`)]));
  vi.spyOn(products, 'gridShardfileProduct').mockReturnValue(Promise.resolve({ admitted: { source, assets, cached: false },
    options: { base: 'https://fixture.invalid/', offline: false, firstParty: true, fetch: () => Promise.reject(new Error('No fixture network')), hash: () => Promise.reject(new Error('Already admitted')) } }));
  const regions: simulation.ShardfileSimulation[] = [], create = simulation.createShardfileSim;
  vi.spyOn(simulation, 'createShardfileSim').mockImplementation((...args) => {
    const sim = create(...args); regions.push(sim); return sim;
  });
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const assembly = new GridAssembly({ developer: false, devserver: false }), home = assembly.cell('driftwood-isle'), target = assembly.cell('template-3');
  const pageHost = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('document', new EventTarget());
  const local = new Storage(), store = new SaveStore({ local, session: null });
  let homeDurable = false;
  const open = () => {
    const scope = new Scope('live.durability'), pre: (() => void)[] = [], post: (() => void)[] = [];
    let currentPhysics = pageHost.physics;
    const traveller = { position: pageHost.player.position, yaw: 0, motor: pageHost.releasePlayerMotor(), camera: new PerspectiveCamera(), hoverSpeedLimit: null,
      bindFrame: (physics: typeof pageHost.physics, motor: typeof pageHost.player.motor) => { currentPhysics = physics; traveller.motor = motor; } };
    const session = new LiveGridSession({ assembly, home, physics: pageHost.physics, scope, walls: new ReadinessWalls(pageHost.physics, [], scope),
      strips: [], allocator: new ResidencyAllocator(), neighbourEdges: () => [], rimEdges: () => [] }, {
      traveller, health: pageHost.player.health, equipment: new EquipmentService(new EmptyEquipment(), { scope }), events: pageHost.events,
      saves: store, checkpoint: () => homeDurable, catalogue: [], setPhysics: (physics) => { currentPhysics = physics; },
      onFixedPre: (fn) => { pre.push(fn); }, onFixedPost: (fn) => { post.push(fn); }, onInput: () => undefined, onUpdate: () => undefined,
    });
    return { session, scope, traveller, tick: () => { for (const fn of pre) fn(); currentPhysics.step(); for (const fn of post) fn(); } };
  };
  const first = open();
  const settle = async (tick: () => void): Promise<void> => { for (let turn = 0; turn < 20; turn++) { await Promise.resolve(); tick(); } };
  try {
    await first.session.live.prefetch([target.instance]);
    pageHost.player.position.set(270, 1, 270); await settle(first.tick);
    expect(first.session.frame()).toBe(home.instance);
    expect(first.session.state().crossing.issue).toBe('Local checkpoint is not durable');
    homeDurable = true; first.tick(); expect(first.session.frame()).toBeNull();
    pageHost.player.position.set(target.origin.x, 1, target.origin.z); await settle(first.tick);
    expect(first.session.frame()).toBe(target.instance);
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
    const reload = new GridRegionDurability(new SaveStore({ local, session: null }), { id: target.instance, shard: target.slug }, source, []);
    expect(reload.read()?.flags).toContain('template.complete'); expect(reload.wallet.coins()).toBe(5);
    expect(Object.values(reload.ledger.state().facts)).toHaveLength(1);
    expect(new GridRegionDurability(new SaveStore({ local, session: null }), { id: 'template-2', shard: '_template' }, source, []).wallet.coins()).toBe(0);
  } finally {
    first.scope.dispose(); pageHost.attachPlayerMotor(first.traveller.motor); pageHost.dispose(); vi.unstubAllGlobals();
  }
});
