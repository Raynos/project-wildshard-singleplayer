// oxlint-disable-next-line import/no-nodejs-modules -- Pin the original authored rows before deleting their producers.
import { createHash } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import { Group } from 'three';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { Weapon } from '../src/engine/combat/Weapon';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { INPUT_CONTEXTS } from '../src/game/inputContexts';
import { bindRuntimeEquipment } from '../src/game/plugin/headless';
import { ItemCatalogue } from '../src/game/plugin/nativeItems';
import source from '../src/shards/nine-dragon-stack/shard.config';
import manifest from '../src/shards/nine-dragon-stack/discovery.generated';
import items from '../src/shards/nine-dragon-stack/data/items.json' with { type: 'json' };
import { GrappleTool } from '../src/game/grapple/tool';
import { heldEntry, enteredRows } from './fixtures/nineHeldEntry';
import baseline from './fixtures/nine-item-equipment.json' with { type: 'json' };

class NativeWeapon extends Weapon {
  readonly model = new Group();
  readonly state = { ammo: 0, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  adsHeld = false; aimInfo = null; enabled = true; holster = 0;
  override get charge(): number { return 0; }
  tryFire(): void { /* The native sword owns its swing clock. */ }
  update(): void { /* Admission never replaces the controller. */ }
}

test('Nine item JSON preserves every contact/profile and both native equipment presentations', () => {
  const original = { ...items, rows: items.rows.map(row => {
    const { equipment: _equipment, ...rest } = row;
    return rest;
  }) };
  expect(createHash('sha256').update(JSON.stringify(original)).digest('hex')).toBe('30ab3dd78bc885a78cdbc22621351f055ff02f4ecffc7205643368c351597e44');
  expect(new ItemCatalogue(items).equipment('weapon.jian')).toEqual(baseline.equipment);
  expect(new ItemCatalogue(items).equipment('tool.fei-zhua')).toEqual(baseline.tool);
});

test('Nine play admits the complete primary/tool set before installing the native grapple', async () => {
  const f = await heldEntry(), install = vi.spyOn(GrappleTool.prototype, 'install').mockImplementation(() => undefined);
  try {
    await f.held.enter(f.ctx, enteredRows);
    expect(f.equipment.current === f.primary).toBe(true);
    expect(install).toHaveBeenCalledOnce(); expect(f.equipment.tools).toHaveLength(1);
    expect(f.equipment.tools[0]?.row).toEqual({ ...baseline.tool, ui: { ...baseline.tool.ui, swapIcon: items.rows[0]?.ui.swapIcon } });
  } finally { install.mockRestore(); f.dispose(); }
});

test('Nine admits the existing Jian while retaining the sword save slot, cues and state owner', () => {
  const app = new App(), scope = new Scope('nine-equipment');
  for (const input of INPUT_CONTEXTS.filter(row => row.id === 'weapon.melee')) app.input.register(input, scope);
  const ctx = { app, scope, game: { shard: manifest, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } } };
  const row = new ItemCatalogue(items).equipment('weapon.jian'), weapon = new NativeWeapon(row), state = weapon.state;
  const shard = { ...source, items: { ...source.items, rows: source.items.rows.filter(item => item.kind === 'weapon'), loadout: { ...source.items.loadout, tools: [] } } };
  try {
    expect(() => bindRuntimeEquipment(ctx, shard, [{ id: row.id, weapon, profile: {} }])).toThrow('profile');
    expect(weapon.row).toBe(row);
    bindRuntimeEquipment(ctx, shard, [{ id: row.id, weapon, profile: items.rows[0]?.profile }]);
    expect(weapon.id).toBe('sword'); expect(weapon.state).toBe(state);
    expect(weapon.row.meta).toBe(row.meta); expect(weapon.row.cues).toEqual(row.cues);
    expect(weapon.row.ui).toEqual({ ...row.ui, inputContext: 'weapon.melee' });
    const equipment = new EquipmentService(weapon, { scope });
    equipment.select('sword', true); expect(equipment.current).toBe(weapon);
  } finally { scope.dispose(); app.engineScope.dispose(); }
});
