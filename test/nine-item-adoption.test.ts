import aim from '../src/shards/nine-dragon-stack/data/grapple.json' with { type: 'json' };
import bursts from '../src/shards/nine-dragon-stack/data/burstFields.json' with { type: 'json' };
// oxlint-disable-next-line import/no-nodejs-modules -- Pin the original authored rows before deleting their producers.
import { createHash } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import { Group } from 'three';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { Weapon } from '../src/engine/combat/Weapon';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { INPUT_CONTEXTS } from '../src/game/inputContexts';
import { createLevelInstallation } from '../src/engine/level/installation';
import { shardContext } from '../src/game/plugin/context';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { bindRuntimeEquipment } from '../src/game/plugin/headless';
import { ItemCatalogue } from '../src/game/plugin/nativeItems';
import source from '../src/shards/nine-dragon-stack/shard.config';
import manifest from '../src/shards/nine-dragon-stack/manifest';
import items from '../src/shards/nine-dragon-stack/data/items.json' with { type: 'json' };
import { GrappleTool } from '../src/game/grapple/tool';
import * as v from 'valibot';
import type { Sword } from '../src/game/weapons/Sword';
import type { HeldClaims } from '../src/game/loadout/claims';
import { MeleeWeaponProfileSchema } from '../src/format/weaponProfiles';
import { publishEntryOwner } from '../src/game/shardfile/entryOwners';
import { legacyDouble } from './fake/FakeGame';
import { NdPlugin } from '../src/shards/nine-dragon-stack/plugin';
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
  const app = new App(), scope = new Scope('nine-play-items');
  app.levelScope = scope;
  for (const input of INPUT_CONTEXTS.filter(row => row.id === 'weapon.melee')) app.input.register(input, scope);
  const level = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const product = createShardProduct({ slug: manifest.slug, revision: source.identity.revision, shardfile: source,
    sections: new Map(), files: new Map([['weapons/jian-row.json', { hash: '0'.repeat(64), url: '/jian-row.json' }]]), read: () => Promise.resolve(new TextEncoder().encode(JSON.stringify({ portraitFov: 78, aim, bursts }))) });
  const ctx = shardContext(level.context, manifest, { shard: manifest, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } }, product);
  const primary = legacyDouble<Sword>(new NativeWeapon(new ItemCatalogue(items).equipment('weapon.jian'))), equipment = new EquipmentService(primary, { scope });
  app.registerEquipment(equipment, scope);
  const plugin = new NdPlugin();
  const profile = v.parse(MeleeWeaponProfileSchema, source.items.rows.find(row => row.kind === 'weapon')?.profile);
  publishEntryOwner(scope, 'claims', 'held.primary', legacyDouble<HeldClaims>({ melee: () => ({ primary: () => primary, profile }) }));
  Object.assign(plugin, { ndWorld: { ctx: { hooks: [] } } });
  // Scene/physics installation is covered by the phone boot; keep item admission and loadout installation real.
  const install = vi.spyOn(GrappleTool.prototype, 'install').mockImplementation(() => undefined);
  try {
    await plugin.play(ctx);
    expect(equipment.current).toBe(primary);
    expect(install).toHaveBeenCalledOnce();
    expect(equipment.tools).toHaveLength(1);
    expect(equipment.tools[0]?.row).toEqual({ ...baseline.tool, ui: { ...baseline.tool.ui, swapIcon: items.rows[0]?.ui.swapIcon } });
  } finally { install.mockRestore(); scope.dispose(); app.engineScope.dispose(); }
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
