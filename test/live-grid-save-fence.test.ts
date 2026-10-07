// oxlint-disable-next-line import/no-nodejs-modules -- Replay the live page's actual board, native worlds and fixed-step crossing.
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { PerspectiveCamera } from 'three';
import { Scope } from '../src/engine/app/scope';
import { SaveStore } from '../src/engine/saves/store';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { Player } from '../src/engine/player/Player';
import { loadRapier } from '../src/engine/physics/rapier';
import { ReadinessWalls } from '../src/engine/physics/readinessWalls';
import { groups } from '../src/engine/physics/groups';
import { TRANSFER_EXIT_LIMIT } from '../src/engine/physics/transferWalls';
import { generateStrip } from '../src/engine/sim/strips';
import * as hosts from '../src/engine/sim';
import { EmptyEquipment } from '../src/game/shardfile/emptyEquipment';
import { GridAssembly } from '../src/game/grid/assembly';
import { LiveGridSession } from '../src/game/grid/liveSession';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { PageResidency } from '../src/game/grid/pageResidency';
import { GridWallet } from '../src/game/grid/wallet';
import { crossingSaveStatus } from '../src/game/grid/borderShimmer';
import * as products from '../src/game/grid/products';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { MemoryStorage } from './setup';
import { legacyDouble } from './fake/FakeGame';

class Storage extends MemoryStorage {
  quota = false;
  override setItem(key: string, value: string): void { if (this.quota) throw new Error('Quota'); super.setItem(key, value); }
}
async function open(x: number, z: number, speed: number) {
  const made: hosts.SimHost[] = [], create = hosts.createSimHost;
  const factory = vi.spyOn(hosts, 'createSimHost').mockImplementation((level, ports) => { const host = create(level, ports); made.push(host); return host; });
  const product = vi.spyOn(products, 'gridShardfileProduct').mockReturnValue(null);
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const page = hosts.createSimHost({ ...SIM_LEVEL, ground: { size: 600, height: 0 }, entities: [], quests: [] }, { rapier, playerBody: false });
  const player = new Player(new PerspectiveCamera(), page.physics, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
  player.bindFrame(page.physics, player.motor, { heightAt: () => 0, waterSurfaceAt: () => null, platforms: [] });
  player.position.set(x * 249, 0.45, z * 249); player.yaw = Math.atan2(-x, -z); player.locked = true; player.setHover(true); player.keys.add('KeyW');
  const globals = ['window', 'document'].map(name => {
    const before = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value: new EventTarget() });
    return () => { if (before === undefined) Reflect.deleteProperty(globalThis, name); else Object.defineProperty(globalThis, name, before); };
  });
  const assembly = new GridAssembly({ developer: false, devserver: false }), home = assembly.cell('driftwood-isle'), allocator = new ResidencyAllocator(), scope = new Scope('save.fence');
  const strips = (['east', 'west', 'north', 'south'] as const).map(edge => {
    const axis = edge === 'east' || edge === 'west' ? 'x' : 'z', sign = edge === 'east' || edge === 'north' ? 1 : -1;
    return generateStrip({ id: `gap.${axis}.${edge}`, axis, origin: { x: axis === 'x' ? sign * 277.5 : 0, z: axis === 'z' ? sign * 277.5 : 0 },
      profiles: [assembly.emptyNeighbour.edge, assembly.emptyNeighbour.edge], adjacent: [home], observations: [{ entryWidth: 8 }, { entryWidth: 8 }] });
  });
  const owner = new PageResidency(allocator), residency = owner.admitHome(home.instance, 1_000_000);
  scope.onDispose(() => { owner.dispose(); });
  const local = new Storage(), saves = new SaveStore({ local, session: null }), wallet = new GridWallet(saves, { id: home.instance, shard: home.slug });
  wallet.addCoins(7); wallet.savePack({ counts: { coconut: 3 }, order: ['coconut'] });
  const equipment = new EquipmentService(new EmptyEquipment(), { scope }), pre: (() => void)[] = [], post: (() => void)[] = [];
  let current = page.physics, pending = true, tick = 0, captured = -1;
  const session = new LiveGridSession({ assembly, home, physics: page.physics, scope, strips, allocator, residency,
    walls: new ReadinessWalls(page.physics, [], scope), neighbourEdges: () => [], rimEdges: () => [] }, {
    traveller: player, health: page.player.health, equipment, events: page.events, saves, catalogue: [],
    checkpoint: () => { const durable = wallet.flush(); if (durable) captured = tick; return durable; },
    crossingSaveReady: () => pending ? 'pending' : true,
    setPhysics: ph => { current = ph; }, onFixedPre: fn => { pre.push(fn); }, onFixedPost: fn => { post.push(fn); }, onInput: () => undefined, onUpdate: () => undefined,
  });
  // Stress the transfer with the full road speed, including an already-fast board arriving from the strip.
  player.hoverSpeedLimit = () => speed;
  const step = async () => { tick++; player.input(1 / 60); for (const run of pre) run(); current.step(); player.step(1 / 60); for (const run of post) run(); await Promise.resolve(); };
  const enabledPlayers = () => made.reduce((sum, host) => { let count = 0; host.physics.world.forEachCollider(c => { if (c.isEnabled() && c.collisionGroups() === groups('PLAYER')) count++; }); return sum + count; }, 0);
  return { page, player, session, local, wallet, equipment, allocator, step, ticks: () => tick, captured: () => captured, enabledPlayers,
    wait: (value: boolean) => { pending = value; },
    close: () => { try { scope.dispose(); expect(allocator.entries()).toEqual([]); player.motor.dispose(); expect(page.physics.world.colliders.len()).toBe(1); }
      finally { page.dispose(); for (const reset of globals) reset(); product.mockRestore(); factory.mockRestore(); } },
  };
}

it.each([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)('holds five pending seconds and quota failure at edge %s/%s, then commits exactly once', async (x, z) => {
  for (const speed of [15, 30]) {
    const f = await open(x, z, speed);
    try {
      for (let tick = 0; tick < 100 && f.session.state().crossing.phase !== 'save-pending'; tick++) await f.step();
      expect(f.session.state().crossing.phase).toBe('save-pending');
      for (let tick = 0; tick < 300; tick++) {
        await f.step(); expect(f.session.frame()).toBe('driftwood-isle'); expect(f.enabledPlayers()).toBe(1);
        expect(Math.max(Math.abs(f.player.position.x), Math.abs(f.player.position.z))).toBeLessThanOrEqual(250 + TRANSFER_EXIT_LIMIT + 0.005);
        expect(f.player.position.y).toBeGreaterThan(-0.02); expect(crossingSaveStatus(f.session.state().crossing)).toBe('saving');
      }
      expect(f.equipment.stowed).toBe(true); expect(f.wallet.coins()).toBe(7); expect(f.wallet.pack().counts).toEqual({ coconut: 3 });
      f.wait(false); f.local.quota = true; await f.step(); expect(f.session.state().crossing.phase).toBe('save-failed');
      expect(crossingSaveStatus(f.session.state().crossing)).toBe('failed');
      for (let tick = 0; tick < 60; tick++) await f.step();
      expect(f.session.frame()).toBe('driftwood-isle'); expect(f.enabledPlayers()).toBe(1);
      f.local.quota = false; f.session.retrySave(); await f.step();
      expect(f.session.frame()).toBeNull(); expect(f.session.live.state().crossings).toBe(1); expect(f.captured()).toBe(f.ticks());
      expect(crossingSaveStatus(f.session.state().crossing)).toBeNull(); expect(f.enabledPlayers()).toBe(1);
      expect(new GridWallet(new SaveStore({ local: f.local, session: null }), { id: 'driftwood-isle', shard: 'driftwood-isle' }).coins()).toBe(7);
    } finally { f.close(); }
  }
});

it('allows a real board to retreat from a pending transfer without committing or reopening a stale destination', async () => {
  const f = await open(1, 0, 30);
  try {
    for (let tick = 0; tick < 100 && f.session.state().crossing.phase !== 'save-pending'; tick++) await f.step();
    expect(f.session.state().crossing.phase).toBe('save-pending');
    f.player.yaw += Math.PI;
    for (let tick = 0; tick < 240; tick++) await f.step();
    expect(f.player.position.x).toBeLessThan(250); expect(f.session.state().crossing.phase).toBe('settled'); expect(f.equipment.stowed).toBe(false);
    f.wait(false); await f.step(); expect(f.session.frame()).toBe('driftwood-isle'); expect(f.session.live.state().crossings).toBe(0);
  } finally { f.close(); }
});
