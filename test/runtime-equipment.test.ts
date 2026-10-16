import { expect, test } from 'vitest';
import { Group } from 'three';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { Weapon } from '../src/engine/combat/Weapon';
import { runtimeEquipment, bindRuntimeEquipment } from '../src/game/plugin/headless';
import { INPUT_CONTEXTS } from '../src/game/inputContexts';
import source from '../src/shards/pine-hollow/shard.config';
import manifest from '../src/shards/pine-hollow/discovery.generated';
import { CROSSBOW, LEVER, LONGBOW } from '../src/shards/pine-hollow/generators/equipment';
import { CROSSBOW_WEAPON_PROFILE } from '../src/shards/pine-hollow/data/crossbowProfile';
import { LEVER_WEAPON_PROFILE } from '../src/shards/pine-hollow/data/leverProfile';
import { BOW_PROFILE } from '../src/shards/pine-hollow/data/bowProfile';
// oxlint-disable-next-line import/no-nodejs-modules -- The native owner uses the shipped Rapier bytes.
import { readFileSync } from 'node:fs';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { bindNativeLoadout, createNativeLoadout, HOST_PROBE } from '../src/game/plugin/simulation';
import { PINE_NATIVE_LOADOUT } from '../src/shards/pine-hollow/data/nativeLoadout';
import { PineAmmunition } from '../src/shards/pine-hollow/runtime/weapons/ammunition';

class NativeWeapon extends Weapon {
  readonly model = new Group();
  readonly state = { ammo: 8, magazine: 8, reserve: 17, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  adsHeld = false; aimInfo = null; enabled = true; holster = 0;
  tryFire(): void { this.state.ammo--; }
  update(): void { /* This fixture borrows an already constructed owner. */ }
}

test('single and multi-item builds retain exact preparation, yield, construction and binding order', async () => {
  const log: string[] = [], primary = new NativeWeapon(CROSSBOW), rifle = new NativeWeapon(LEVER), secondary = new NativeWeapon(LONGBOW);
  const targets = { raycast: () => null }, due = () => null;
  const build = runtimeEquipment([
    { slot: 'primary', prepare: slice => { expect(slice).toBe(due); log.push('hands.crossbow'); return Promise.resolve(); }, create: () => { log.push('crossbow'); return primary; } },
    { slot: 'rifle', prepare: slice => { expect(slice).toBe(due); log.push('hands.rifle'); return Promise.resolve(); }, create: () => { log.push('rifle'); return rifle; } },
    { slot: 'secondary', prepare: slice => { expect(slice).toBe(due); log.push('hands.bow'); return Promise.resolve(); }, create: () => { log.push('bow'); return secondary; } },
  ], { pause: () => { log.push('pause'); return Promise.resolve(); }, slice: () => due, bind: () => { log.push('bind'); } });
  expect(await build(targets, false)).toEqual({ primary, rifle, secondary });
  expect(log).toEqual(['hands.crossbow', 'pause', 'crossbow', 'pause', 'hands.rifle', 'pause', 'rifle', 'pause', 'hands.bow', 'pause', 'bow', 'bind']);
  expect(await runtimeEquipment([{ slot: 'primary', create: () => primary }])(targets, false)).toEqual({ primary, rifle: null, secondary: null });
  expect(() => runtimeEquipment([])).toThrow();
  expect(() => runtimeEquipment([{ slot: 'rifle', create: () => rifle }])).toThrow();
  expect(() => runtimeEquipment([{ slot: 'primary', create: () => primary }, { slot: 'primary', create: () => primary }])).toThrow();
  await expect(runtimeEquipment([{ slot: 'primary', prepare: () => Promise.reject(new Error('hands missing')), create: () => primary }])(targets, false)).rejects.toThrow('hands missing');
});

test('Pine adopts all three live ranged owners without changing ammunition, identity, cues or native UI', () => {
  const app = new App(), scope = new Scope('equipment-intake');
  for (const definition of INPUT_CONTEXTS.filter(input => input.id === 'weapon.ranged' || input.id === 'weapon.bow')) app.input.register(definition, scope);
  const ctx: Parameters<typeof bindRuntimeEquipment>[0] = { app, scope, game: { shard: manifest, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } } };
  const primary = new NativeWeapon(CROSSBOW), rifle = new NativeWeapon(LEVER), secondary = new NativeWeapon(LONGBOW);
  const owners = [{ id: 'weapon.crossbow', weapon: primary, profile: CROSSBOW_WEAPON_PROFILE, presentation: true },
    { id: 'weapon.lever', weapon: rifle, profile: LEVER_WEAPON_PROFILE, presentation: true },
    { id: 'weapon.longbow', weapon: secondary, profile: BOW_PROFILE }];
  const before = owners.map(({ weapon }) => ({ state: weapon.state, id: weapon.id, row: weapon.row }));
  try {
    expect(() => bindRuntimeEquipment(ctx, source, owners.map(owner => ({ ...owner, profile: {} })))).toThrow('profile');
    expect(primary.row).toBe(CROSSBOW);
    bindRuntimeEquipment(ctx, source, owners);
    for (const [index, { id, weapon }] of owners.entries()) {
      const old = before[index]; if (old === undefined) throw new Error('Missing native owner');
      const declared = source.items.rows.find(row => row.id === id);
      if (declared?.kind !== 'weapon') throw new Error('Missing admitted weapon');
      expect(weapon.state).toBe(old.state); expect(weapon.state.ammo).toBe(8); expect(weapon.id).toBe(old.id);
      expect(weapon.row.meta).toBe(old.row.meta); expect(weapon.row.cues).toEqual(old.row.cues);
      expect(weapon.row.ui).toEqual({ ...old.row.ui, inputContext: declared.context }); expect(weapon.row.legacySlot).toBe(old.id);
    }
  } finally { scope.dispose(); app.engineScope.dispose(); }
});

test('native multi-item binding restores old held/swap and ammunition envelopes with live aim and locks', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const host = createSimHost({ version: 1, id: 'ranged-loadout', seed: 1, ground: { size: 20, height: 0 },
    player: { at: { x: 0, y: 1, z: 0 }, yaw: 0, speed: 5 }, weapon: HOST_PROBE, entities: [], quests: [] }, { rapier });
  let locked = false, aim = 0.7, pick: number | null = null;
  const ports = { owned: () => true, locked: () => locked };
  const old = createNativeLoadout(PINE_NATIVE_LOADOUT, ports);
  old.step(0.125, 1); const saved = old.snapshot();
  const loadout = bindNativeLoadout(host, PINE_NATIVE_LOADOUT, { ...ports, aim: () => aim,
    step: { id: 'pine.loadout', phase: 'afterBodies', pick: () => pick } });
  try {
    loadout.restore(saved); expect(loadout.snapshot()).toEqual(saved);
    expect(loadout.live(0)).toBe(false); expect(loadout.aim()).toBe(0.7); aim = 0.9; expect(loadout.aim()).toBe(0.9);
    for (let i = 0; i < 30; i++) host.step();
    expect(loadout.held()).toBe(1); expect(loadout.live(1)).toBe(true);
    locked = true; expect(loadout.live(1)).toBe(false); locked = false;
    pick = 31; host.step(); expect(loadout.held()).toBe(1); expect(loadout.swapping()).toBe(false);
    const crossbow = { state: { quiver: 30, loaded: true, reloading: false }, addBolts: (n: number) => { crossbow.state.quiver += n; } };
    const weapons = { crossbow, lever: { act: { rounds: 4 }, store: { reserve: 17 } }, longbow: { state: { arrows: 8 } } };
    const ammunition = new PineAmmunition(weapons); ammunition.add('pitch', 7); ammunition.loadKind('pitch');
    const pouch = ammunition.snapshot(), restored = new PineAmmunition(weapons);
    const commit = restored.prepareRestore(pouch); expect(restored.selected).toBe('iron'); commit();
    expect(restored.snapshot()).toEqual(pouch); expect(restored.count('cartridge')).toBe(21); expect(restored.count('arrow')).toBe(8);
    expect(() => restored.prepareRestore({ ...pouch, pitch: 6 })).toThrow(); expect(restored.snapshot()).toEqual(pouch);
    expect(loadout.bodies()).toEqual([...host.entities.values()]);
  } finally { host.dispose(); }
});
