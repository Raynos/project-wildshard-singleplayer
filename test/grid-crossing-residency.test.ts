// oxlint-disable-next-line import/no-nodejs-modules -- The integration fixture boots the committed Rapier WASM.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { restoreSimHost, type SimSnapshot } from '../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { groups } from '../src/engine/physics/groups';
import { Scope } from '../src/engine/app/scope';
import { SaveStore } from '../src/engine/saves/store';
import { InputService } from '../src/engine/input/InputService';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { GridAssembly, type GridPoint } from '../src/game/grid/assembly';
import { GridSimulation } from '../src/game/grid/simulation';
import { installGridCrossing } from '../src/game/grid/crossing';
import { GridWallet, installGridLoadout, type GridLoadout } from '../src/game/grid/wallet';
import { installDeclaredItems } from '../src/game/shardfile/items';
import { declaredKitItemFamilies } from '../src/kit/items/declared';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { MemoryStorage } from './setup';
import itemSource from './fixtures/shardfile/items/template.json';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer); });
function fixture() {
  const assembly = new GridAssembly({ developer: false, devserver: false }), scope = new Scope('grid.crossing.integration');
  const store = new SaveStore({ local: new MemoryStorage(), session: null });
  const worlds = new Map<string, SimHost>(), wallets = new Map<string, GridWallet>(), loadouts = new Map<string, GridLoadout>();
  const saved = new Map<string, SimSnapshot>(), changes: (string | null)[] = [], stowed = new Set<string>();
  const equipment = new Map<string, EquipmentService>();
  const admission = new Map<string, boolean>();
  const host = (id: string) => createSimHost({ ...SIM_LEVEL, id, ground: { size: 2400, height: 0 }, player: { ...SIM_LEVEL.player, at: { x: 300, y: 0, z: 0 } } }, { rapier });
  const highway = host('platform-highway'); let durable = true;
  const driver = new GridSimulation(assembly, {
    highway: { host: highway, dispose: () => { highway.dispose(); } },
    load: (cell, snapshot) => {
      const world = snapshot === undefined ? host(cell.instance) : restoreSimHost({ ...SIM_LEVEL, id: cell.instance, ground: { size: 2400, height: 0 }, player: { ...SIM_LEVEL.player, at: { x: 300, y: 0, z: 0 } } }, { rapier }, snapshot);
      worlds.set(cell.instance, world);
      const wallet = new GridWallet(store, { id: cell.instance, shard: cell.slug }); wallets.set(cell.instance, wallet);
      const input = new InputService(() => world.clock.now * 1000), source = structuredClone(itemSource);
      input.register({ id: 'weapon.melee', actions: ['attack', 'heavy', 'lock'] }, world.scope);
      for (const row of source.rows) row.hook = null;
      const declared = installDeclaredItems(source, { scope: world.scope, actorId: world.player.id, input,
        aim: () => ({ origin: { x: 0, y: 1, z: 0 }, direction: { x: 0, y: 0, z: 1 } }), families: declaredKitItemFamilies(), icon: () => 'sword',
        runtime: () => ({ actor: world.player.health, combat: world.combat, targets: () => [], hook: null, effect: () => undefined }),
      });
      if (declared.primary === null) throw new Error('Missing admitted held weapon');
      const service = new EquipmentService(declared.primary, { scope: world.scope });
      if (declared.secondary !== null) service.add(declared.secondary, { locked: false }); declared.install(service);
      equipment.set(cell.instance, service);
      const loadout = installGridLoadout(wallet, service, declared.runtimes, world.scope, world.state.tick);
      loadouts.set(cell.instance, { checkpoint: () => durable && loadout.checkpoint(),
        stow: () => { stowed.add(cell.instance); loadout.stow(); }, interior: () => { stowed.delete(cell.instance); loadout.interior(); } });
      return Promise.resolve({ host: world, dispose: () => { world.dispose(); } });
    },
    save: (instance, snapshot) => { if (!durable) return false; saved.set(instance, snapshot); return true; }, read: (instance) => saved.get(instance),
    admitted: (instance) => admission.get(instance) ?? true,
  });
  const session = installGridCrossing(driver, assembly, (id) => loadouts.get(id), scope, (_from, to) => { changes.push(to); });
  const place = (feet: GridPoint) => { const instance = driver.current(); const point = instance === null ? feet : assembly.local(feet, assembly.cell(instance)); driver.host().player.position.set(point.x, point.y, point.z); };
  const settle = async (feet: GridPoint, expected: string | null): Promise<void> => {
    place(feet);
    for (let turn = 0; turn < 100; turn++) {
      session.step(driver.worldFeet());
      if (driver.current() === expected) return;
      await Promise.resolve();
    }
    throw new Error(`Crossing failed: ${JSON.stringify(session.crossing.state())}`);
  };
  return { driver, session, scope, worlds, wallets, equipment, changes, stowed, saved, place, settle, quota: (blocked: boolean) => { durable = !blocked; },
    admit: (instance: string, ready: boolean) => { admission.set(instance, ready); },
    dispose: () => { scope.dispose(); driver.dispose(); } };
}
it('crosses real Rapier frames through assembly and residency without transferring local money, resetting hurt creatures or stepping neighbours', async () => {
  const f = fixture();
  try {
    await f.settle({ x: 256, y: 0, z: 0 }, 'driftwood-isle');
    const driftwood = f.driver.host(), wallet = f.wallets.get('driftwood-isle'), creature = driftwood.entities.get('boar:1');
    if (wallet === undefined || creature === undefined) throw new Error('Missing admitted local state');
    wallet.addCoins(23); wallet.savePack({ counts: { coconut: 5 }, order: ['coconut'] }); creature.hp = 41;
    f.place({ x: 249, y: 0, z: 0 }); f.session.step(f.driver.worldFeet()); expect(f.stowed.has('driftwood-isle')).toBe(false);
    f.place({ x: 251, y: 0, z: 0 }); f.session.step(f.driver.worldFeet()); expect(f.stowed.has('driftwood-isle')).toBe(true);
    const held = f.equipment.get('driftwood-isle'); if (held === undefined) throw new Error('Missing held equipment');
    for (let render = 0; render < 5; render++) { held.update(1 / 60, render / 60); expect(held.current.model.visible).toBe(false); }
    expect(f.driver.current()).toBe('driftwood-isle');
    await f.settle({ x: 261, y: 0, z: 0 }, null); expect(driftwood.hasPlayerMotor).toBe(false);
    for (let render = 0; render < 5; render++) { held.update(1 / 60, render / 60); expect(held.current.model.visible).toBe(false); }
    const frozenTick = driftwood.state.tick;
    await f.settle({ x: 0, y: 0, z: 299 }, 'pine-hollow');
    expect(f.driver.worldFeet()).toEqual({ x: 0, y: 0, z: 299 });
    expect(f.wallets.get('pine-hollow')?.coins()).toBe(0); expect(f.wallets.get('pine-hollow')?.pack().order).toEqual([]);
    f.driver.step(); expect(driftwood.state.tick).toBe(frozenTick); expect(creature.hp).toBe(41);
    await f.settle({ x: 0, y: 0, z: 294 }, null);
    expect(f.driver.unload('driftwood-isle')).toBe(true);
    await f.settle({ x: 256, y: 0, z: 0 }, 'driftwood-isle');
    expect(f.driver.host().entities.get('boar:1')?.hp).toBe(41);
    expect(f.wallets.get('driftwood-isle')?.coins()).toBe(23); expect(f.wallets.get('driftwood-isle')?.pack().counts).toEqual({ coconut: 5 });
    expect(f.changes).toEqual(['driftwood-isle', null, 'pine-hollow', null, 'driftwood-isle']);
    expect(f.driver.worldFeet()).toEqual({ x: 256, y: 0, z: 0 });
  } finally { f.dispose(); }
});
it('defers a real prepared motor behind readiness while keeping one active capsule and the latest moving pose', async () => {
  const f = fixture();
  const capsules = (host: SimHost): number => {
    let count = 0; host.physics.world.forEachCollider((collider) => { if (collider.isEnabled() && collider.collisionGroups() === groups('PLAYER')) count++; }); return count;
  };
  try {
    const highway = f.driver.host(), motor = highway.player.motor; f.admit('driftwood-isle', false); f.place({ x: 256, y: 0, z: 0 });
    for (let tick = 0; tick < 20; tick++) { f.session.step(f.driver.worldFeet()); await Promise.resolve(); }
    const destination = f.worlds.get('driftwood-isle'); if (destination === undefined) throw new Error('Missing prepared destination');
    expect(f.session.crossing.state().phase).toBe('ready'); expect(f.driver.current()).toBeNull();
    expect(highway.player.motor).toBe(motor); expect(capsules(highway)).toBe(1); expect(capsules(destination)).toBe(0);
    f.place({ x: 254, y: 0, z: 0 }); highway.player.yaw = 1.2; f.admit('driftwood-isle', true);
    expect(f.session.step(f.driver.worldFeet())).toBe(true);
    expect(f.driver.worldFeet()).toEqual({ x: 254, y: 0, z: 0 }); expect(f.driver.host().player.yaw).toBe(1.2);
    expect(capsules(highway)).toBe(0); expect(capsules(destination)).toBe(1); expect(f.changes).toEqual(['driftwood-isle']);
  } finally { f.dispose(); }
});
it('retains the only active traveller motor while a real source checkpoint is blocked, then commits once after retry', async () => {
  const f = fixture();
  try {
    await f.settle({ x: 256, y: 0, z: 0 }, 'driftwood-isle'); const source = f.driver.host(), motor = source.player.motor;
    f.quota(true); f.place({ x: 261, y: 0, z: 0 });
    for (let tick = 0; tick < 20; tick++) { f.session.step(f.driver.worldFeet()); await Promise.resolve(); }
    expect(f.driver.current()).toBe('driftwood-isle'); expect(source.player.motor).toBe(motor); expect(source.hasPlayerMotor).toBe(true);
    expect(f.session.crossing.state().issue).toBe('Local checkpoint is not durable');
    f.quota(false); f.session.crossing.retrySave(); expect(f.session.step(f.driver.worldFeet())).toBe(true); expect(f.driver.current()).toBeNull(); expect(source.hasPlayerMotor).toBe(false);
    expect(f.changes).toEqual(['driftwood-isle', null]);
  } finally { f.dispose(); }
});
