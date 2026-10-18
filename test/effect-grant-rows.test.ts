import { parseItems } from '../src/format/items';
import { DRIFTWOOD_SWORDS } from '../src/shards/driftwood-isle/generators/items';
import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { PlayerHealth } from '../src/engine/combat/health';
import { EffectService, selectEffectGrants } from '../src/engine/combat/effects/EffectService';
import { isOwnedId, type OwnedId } from '../src/game/loot/Owned';
import { bindFixtureEffects } from './fixtures/item-effects';
import { DRIFTWOOD_EFFECTS } from '../src/shards/driftwood-isle/generators/economy';
import { NalatiSkinLocker, NALATI_SKINS } from '../src/shards/nalati-grasslands/weapons/nalatiSkins';


test('Driftwood selects ordered live grants, highest upgrades and worn cosmetics', () => {
  const have = new Set<OwnedId>(), worn = new Set<string>();
  const scope = new Scope('ordered-grants'), effects = new EffectService(DRIFTWOOD_EFFECTS);
  const health = new PlayerHealth(new Events(), { now: () => 0, dodging: () => false, dodgeGuard: () => false, position: () => new Vector3() });
  const attributes = { damage: 24, heavyDamageMul: 1 };
  const sword = { attributes, get damage() { return attributes.damage; }, get heavyMult() { return attributes.heavyDamageMul; } };
  let changed = (): void => { /* Bound below. */ };
  const owned: Parameters<typeof bindFixtureEffects>[0]['owned'] = {
    has: id => isOwnedId(id) && have.has(id), worn: id => worn.has(id), onChange: run => { changed = run; return () => { changed = () => undefined; }; },
  };
  const sync = vi.spyOn(effects, 'sync');
  const refresh = (): void => { sync.mockClear(); changed(); };
  bindFixtureEffects({ effects, scope, owned, health, player: { dodgeCooldownScale: 1 }, swords: [sword], hitCap: Infinity });
  const playerGrants = (): Parameters<EffectService['sync']>[1] => sync.mock.calls.find(call => call[0] === health)?.[1] ?? [];
  const weaponGrants = (): Parameters<EffectService['sync']>[1] => sync.mock.calls.find(call => call[0] === sword)?.[1] ?? [];
  expect(playerGrants()).toEqual([]);
  expect(weaponGrants()).toEqual([]);
  for (const id of ['heart-1', 'heart-2', 'charm-1', 'charm-2', 'charm-3', 'boar-tusk', 'whetstone-1', 'whetstone-2', 'bear-claw'] as const) have.add(id);
  worn.add('captain-hat'); worn.add('cape'); refresh();
  expect(playerGrants()).toEqual([
    { id: 'effect.sturdy-heart', stacks: 2 }, { id: 'effect.charm.1' }, { id: 'effect.charm.2' },
    { id: 'effect.charm.3' }, { id: 'effect.boar-tusk' }, { id: 'effect.captain-hat' }, { id: 'effect.cape' },
  ]);
  expect(weaponGrants()).toEqual([{ id: 'effect.whetstone.2' }, { id: 'effect.bear-claw' }]);
  have.delete('heart-2'); have.delete('whetstone-2'); worn.clear(); refresh();
  expect(playerGrants()[0]).toEqual({ id: 'effect.sturdy-heart', stacks: 1 });
  expect(playerGrants().some(grant => grant.id === 'effect.cape')).toBe(false);
  expect(weaponGrants()[0]).toEqual({ id: 'effect.whetstone.1' });
  const before = playerGrants(); delete owned.worn; refresh();
  expect(playerGrants()).toEqual(before);
  scope.dispose(); sync.mockRestore();
});

test('the named Nalati W3 worn-skin grants fit the shared selector', () => {
  const locker = new NalatiSkinLocker({ read: () => ({ owned: [], worn: {} }), write: () => true });
  const rows = NALATI_SKINS.map(skin => ({ id: `effect.skin.${skin.id}` as const, key: skin.id }));
  const check = (): void => {
    const selected = new Set(Object.values(locker.worn));
    const grants = selectEffectGrants(rows, selected);
    expect(grants.map(grant => grant.id).sort()).toEqual(locker.effects.active(locker.effectTarget).map(effect => effect.def.id).sort());
  };
  check();
  for (const skin of NALATI_SKINS) { locker.own(skin.id); check(); }
  locker.wear('mount', 'sky-marked-saddle'); check();
  locker.wear('sabre', null); locker.wear('mount', null); check();
});

test('invalid grant capacities and stacks refuse before reading ownership', () => {
  const owned = new Set<string>();
  const row = { id: 'effect.test' as const, key: 'test' };
  expect(() => selectEffectGrants(Array.from({ length: 129 }, () => row), owned)).toThrow('grant rows');
  expect(() => selectEffectGrants([{ ...row, unless: Array.from({ length: 33 }, () => 'test') }], owned)).toThrow('grant rows');
  for (const stacks of [0, -1, 0.5, Infinity]) expect(() => selectEffectGrants([{ ...row, stacks }], owned)).toThrow('grant rows');
  expect(() => selectEffectGrants([{ ...row, key: '' }], owned)).toThrow('grant rows');
  expect(selectEffectGrants([], owned)).toEqual([]);
});

test('item grant bindings refuse missing and duplicate equipment before installation', () => {
  const items = parseItems(DRIFTWOOD_SWORDS), rows = items.loadout.effects;
  if (rows === undefined) throw new Error('Missing item effect fixture');
  const binding = rows.weapons[0]; if (binding === undefined) throw new Error('Missing weapon grant fixture');
  expect(() => parseItems({ ...items, loadout: { ...items.loadout, effects: { ...rows,
    weapons: [{ ...binding, items: ['weapon.missing'] }] } } })).toThrow();
  expect(() => parseItems({ ...items, loadout: { ...items.loadout, effects: { ...rows,
    weapons: [{ ...binding, items: [binding.items[0], binding.items[0]] }] } } })).toThrow();
});
