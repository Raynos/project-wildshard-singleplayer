// oxlint-disable-next-line import/no-nodejs-modules -- Pin the original authored rows independently of the new JSON path.
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { Group } from 'three';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { Weapon } from '../src/engine/combat/Weapon';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { INPUT_CONTEXTS } from '../src/game/inputContexts';
import { bindRuntimeEquipment } from '../src/game/plugin/headless';
import { readItemEquipment } from '../src/game/plugin/nativeItems';
import source from '../src/shards/nalati-grasslands/shard.config';
import { NALATI_GRASSLANDS as manifest } from '../src/shards/nalati-grasslands/manifest';
import items from '../src/shards/nalati-grasslands/data/items.json' with { type: 'json' };

class NativeWeapon extends Weapon {
  readonly model = new Group();
  readonly state = { ammo: 3, magazine: 3, reserve: 90, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  adsHeld = false; aimInfo = null; enabled = true; holster = 0;
  tryFire(): void { this.state.ammo--; }
  update(): void { /* Native controllers retain their clocks during adoption. */ }
}

test('Nalati item JSON retains every original profile, attack and equipment value', () => {
  const oldItems = { ...items, rows: items.rows.map(({ equipment: _native, ...row }) => row) };
  const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  expect(hash(oldItems)).toBe('663a65fd62e337e1cb5522b3fd144b3a451501d2ca65636874a253667701dc17');
  expect(hash(items.rows.map(row => row.equipment))).toBe('fedc4a0d87492e230caf4ef0caf05b85f8ca6e038beea5c549854bc2f2bd1b5d');
});

test('Nalati native adoption retains old saved slots, ammo owners, presentation and profile refusal', () => {
  const app = new App(), scope = new Scope('nalati-equipment');
  for (const input of INPUT_CONTEXTS.filter(row => items.runtimeContexts.includes(row.id))) app.input.register(input, scope);
  const ctx = { app, scope, game: { shard: manifest, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } } };
  const owners = items.rows.map(row => ({ id: row.id, weapon: new NativeWeapon(readItemEquipment(items, row.id)), profile: row.profile }));
  const before = owners.map(({ weapon }) => ({ state: weapon.state, row: weapon.row, slot: weapon.id }));
  try {
    expect(() => bindRuntimeEquipment(ctx, source, owners.map(owner => ({ ...owner, profile: {} })))).toThrow('profile');
    bindRuntimeEquipment(ctx, source, owners);
    const first = owners[0];
    if (first === undefined) throw new Error('Missing Nalati bow');
    const equipment = new EquipmentService(first.weapon, { scope, order: ['bow', 'sabre', 'spear'] });
    for (const { weapon } of owners.slice(1)) equipment.add(weapon, { locked: false });
    for (const [index, { weapon }] of owners.entries()) {
      const old = before[index], item = items.rows[index];
      if (old === undefined || item === undefined) throw new Error('Missing original equipment');
      expect(weapon.id).toBe(old.slot);
      expect(weapon.state).toBe(old.state);
      expect(weapon.state.ammo).toBe(3);
      expect(weapon.row.meta).toBe(old.row.meta);
      expect(weapon.row.cues).toEqual(old.row.cues);
      expect(weapon.row.ui).toEqual({ ...old.row.ui, inputContext: item.context });
      equipment.select(old.slot, true);
      expect(equipment.current).toBe(weapon);
    }
  } finally { scope.dispose(); app.engineScope.dispose(); }
});
