import { expect, it } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import type { EquipmentRow } from '../src/engine/combat/Equipment';
import type { ItemFamily } from '../src/engine/combat/itemFamilies';
import type { Actor } from '../src/engine/combat/pipeline';
import { Weapon } from '../src/engine/combat/Weapon';
import { InputService } from '../src/engine/input/InputService';
import { emptyShardfile } from '../src/sdk/author';
import { installDeclaredItems, parseItems } from '../src/game/shardfile/items';
import { parseShardfile, shardfileRules } from '../src/game/shardfile/schema';
import { ITEMS } from '../src/shards/_template/data/items';
import { LONGBOW } from '../src/shards/pine-hollow/weapons/equipment';

const profiles = [
  { keysFrom: 'weapon.melee', actions: ['attack', 'heavy', 'lock'], touch: 'melee' },
  { keysFrom: 'weapon.ranged', actions: ['attack', 'aim', 'reload'], touch: 'ranged' },
  { keysFrom: 'weapon.bow', actions: ['attack', 'aim'], touch: 'bow' },
  { keysFrom: 'weapon.spear', actions: ['attack', 'aim'], touch: 'throwing' },
] as const;
function items(context = 'fixture.weapon') {
  const row = parseItems(ITEMS).rows.find((item) => item.kind === 'weapon' && item.context === 'weapon.melee');
  if (row?.kind !== 'weapon') throw new Error('Missing fixture weapon');
  return { version: 1, rows: [{ ...row, family: 'range-fixture.native', context }], contexts: [],
    loadout: { primary: row.id, secondary: null, tools: [] } };
}
function source() { return emptyShardfile({ slug: 'range-fixture', name: 'Range fixture', author: 'Fixture', revision: 1, seed: 1 }); }

it('preserves the existing Pine longbow swap glyph and bounds swap icons at 512 characters', () => {
  const data = items('weapon.melee'), row = data.rows[0];
  if (row === undefined) throw new Error('Missing fixture weapon');
  const admit = (swapIcon: string) => parseShardfile({ ...source(), items: { ...data, rows: [{ ...row, ui: { ...row.ui, swapIcon } }] } });
  const glyph = LONGBOW.ui.swapIcon;
  expect(glyph.length).toBeGreaterThan(64);
  expect(admit(glyph).items.rows[0]?.ui.swapIcon).toBe(glyph);
  expect(admit('x'.repeat(512)).items.rows[0]?.ui.swapIcon).toBe('x'.repeat(512));
  expect(() => admit('x'.repeat(513))).toThrow();
});

it('admits exact melee, ranged, bow and thrown context profiles through the full schema', () => {
  for (const profile of profiles) {
    const context = { id: 'fixture.weapon', ...profile, lockable: true };
    const data = { ...items(), contexts: [context] };
    expect(parseShardfile({ ...source(), items: data }).items.contexts).toEqual([context]);
    for (const bad of [{ ...context, actions: ['attack', 'use'] }, { ...context, touch: 'unknown' },
      { ...context, id: profile.keysFrom }, { ...context, keysFrom: 'unknown' }, { ...context, callback: () => undefined }]) {
      expect(() => parseShardfile({ ...source(), items: { ...data, contexts: [bad] } })).toThrow();
    }
    if (profile.touch !== 'melee') expect(() => parseShardfile({ ...source(), items: { ...data, contexts: [{ ...context, touch: 'melee' }] } })).toThrow();
  }
});

it('requires explicit runtime item ownership for existing-context references, without redeclaring them', () => {
  for (const context of ['weapon.bow', 'weapon.ranged', 'weapon.spear', 'fixture.registered']) {
    const data = { ...items(context), runtimeContexts: [context] };
    const declaration = { ...source(), items: data, runtime: { entry: 'runtime/index.ts', binds: ['items'] } };
    const admitted = parseShardfile(declaration);
    expect(admitted.items).toEqual(data);
    expect(shardfileRules({ ...admitted, runtime: null })).toContain('runtime input context references require runtime.binds items');
    for (const runtime of [null, { entry: 'runtime/index.ts' }, { entry: 'runtime/index.ts', binds: ['quests'] }]) {
      expect(() => parseShardfile({ ...declaration, runtime })).toThrow('shardfile semantic rules');
    }
    expect(() => parseShardfile({ ...declaration, items: { ...data, runtimeContexts: [] } })).toThrow();
    expect(() => parseShardfile({ ...declaration, items: { ...data, runtimeContexts: [context, context] } })).toThrow();
    expect(() => parseShardfile({ ...declaration, items: { ...data, runtimeContexts: ['bad context'] } })).toThrow();
  }
  const data = { ...items(), runtimeContexts: ['fixture.weapon'], contexts: [{ id: 'fixture.weapon', ...profiles[0], lockable: true }] };
  expect(() => parseShardfile({ ...source(), items: data, runtime: { entry: 'runtime/index.ts', binds: ['items'] } })).toThrow();
  expect(() => parseShardfile({ ...source(), items: { ...items(), presentation: { ui: { touch: 'ranged' } } } })).toThrow();
  const itemData = items(), first = itemData.rows[0];
  if (first === undefined) throw new Error('Missing fixture item');
  expect(() => parseShardfile({ ...source(), items: { ...itemData, rows: [{ ...first, presentation: {} }] } })).toThrow();
});

class NativeWeapon extends Weapon {
  readonly model = { visible: false, parent: null, removeFromParent: () => undefined };
  readonly state = { ammo: 5, magazine: 5, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  holster = 0; enabled = true; adsHeld = false; aimInfo = null; shots = 0;
  tryFire(): void { this.shots++; }
  update(): void { /* The trusted family owns its existing native firing path. */ }
}
function fixture() {
  const scope = new Scope('ranged-items'), input = new InputService(() => 0), rows: EquipmentRow[] = [];
  const actor: Actor = { id: 'actor.player', tags: [], attributes: { health: 100, maxHealth: 100 }, state: [], alive: true, applyDamage: () => false };
  const family: ItemFamily = { kind: 'weapon', presentation: {
    ui: { touch: 'ranged', lockOn: false, melee: false, tracers: true, ammo: { label: 'Rounds', segments: 5, magazine: true }, swapName: 'Rifle' },
    cues: { fire: 'cue.rifle.fire', reload: 'cue.rifle.reload', impact: 'cue.rifle.hit' }, hitStop: { body: 0.03, head: 0.04, kill: 0.05 },
  }, create: (row) => { rows.push(row); return new NativeWeapon(row); } };
  const ports = { scope, input, actorId: actor.id, families: new Map<string, ItemFamily>(),
    shardFamilies: { slug: 'range-fixture', families: new Map([['range-fixture.native', family]]) },
    aim: () => ({ origin: { x: 0, y: 1, z: 0 }, direction: { x: 0, y: 0, z: 1 } }), icon: () => 'sword' as const,
    runtime: () => ({ actor, combat: { hit: () => null }, targets: () => [], hook: null, effect: () => undefined }),
  };
  return { scope, input, rows, ports, family };
}

it('preflights runtime context ownership and existence before any family construction or context installation', () => {
  const f = fixture(), data = { ...items('weapon.ranged'), runtimeContexts: ['weapon.ranged'] }, before = f.scope.census;
  try {
    expect(() => installDeclaredItems(data, f.ports)).toThrow('runtime-owned');
    expect(() => installDeclaredItems(data, { ...f.ports, contexts: 'runtime' })).toThrow('Unresolved runtime input context weapon.ranged');
    expect(f.rows).toEqual([]); expect(f.scope.census).toEqual(before); expect(f.input.has('weapon.ranged')).toBe(false);
    f.input.register({ id: 'weapon.ranged', actions: ['attack', 'aim', 'reload'] }, f.scope);
    const declared = installDeclaredItems(data, { ...f.ports, contexts: 'runtime' });
    expect(f.rows).toHaveLength(1); expect(f.input.has('weapon.ranged')).toBe(true);
    const weapon = declared.primary;
    if (!(weapon instanceof NativeWeapon)) throw new Error('Missing native weapon');
    weapon.tryFire(); expect(weapon.shots).toBe(1);
    expect(weapon.row.ui).toEqual({ ...f.family.presentation?.ui, name: data.rows[0]?.ui.name, icon: 'sword',
      inputContext: 'weapon.ranged', swapIcon: data.rows[0]?.ui.swapIcon });
    expect(weapon.row.id).toBe(data.rows[0]?.id); expect(weapon.row.legacySlot).toBe(data.rows[0]?.slot);
    expect(weapon.row.cues).toEqual(f.family.presentation?.cues); expect(weapon.row.hitStop).toEqual(f.family.presentation?.hitStop);
    expect(data.rows[0]?.ui).not.toHaveProperty('ammo');
  } finally { f.scope.dispose(); }
  expect(f.input.has('weapon.ranged')).toBe(false);
});

it('installs new ranged/thrown contexts once with their exact inherited keys and retires them with the item scope', () => {
  for (const profile of profiles) {
    const f = fixture();
    try {
      f.input.register({ id: profile.keysFrom, actions: profile.actions, keys: { attack: ['KeyF'] } }, f.scope);
      const data = { ...items(), contexts: [{ id: 'fixture.weapon', ...profile, lockable: true }] };
      installDeclaredItems(data, f.ports);
      f.input.push('fixture.weapon', f.scope);
      expect(f.input.touchLayout().mode).toBe(profile.touch);
      expect(f.input.bindings.keys('fixture.weapon')['attack']).toEqual(['KeyF']);
    } finally { f.scope.dispose(); }
    expect(f.input.has('fixture.weapon')).toBe(false);
  }
});
