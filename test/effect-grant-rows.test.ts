import { expect, test } from 'vitest';
import { selectEffectGrants } from '../src/engine/combat/effects/EffectService';
import type { OwnedId } from '../src/game/loot/Owned';
import { driftwoodPlayerGrants, driftwoodWeaponGrants } from '../src/shards/driftwood-isle/loot/effects';
import { NalatiSkinLocker, NALATI_SKINS } from '../src/shards/nalati-grasslands/weapons/nalatiSkins';

test('Driftwood selects ordered live grants, highest upgrades and worn cosmetics', () => {
  const have = new Set<OwnedId>(), worn = new Set<string>();
  const owned = { has: (id: OwnedId) => have.has(id), worn: (id: string) => worn.has(id) };
  expect(driftwoodPlayerGrants(owned)).toEqual([]);
  expect(driftwoodWeaponGrants(owned)).toEqual([]);
  for (const id of ['heart-1', 'heart-2', 'charm-1', 'charm-2', 'charm-3', 'boar-tusk', 'whetstone-1', 'whetstone-2', 'bear-claw'] as const) have.add(id);
  worn.add('captain-hat'); worn.add('cape');
  expect(driftwoodPlayerGrants(owned)).toEqual([
    { id: 'effect.sturdy-heart', stacks: 2 }, { id: 'effect.charm.1' }, { id: 'effect.charm.2' },
    { id: 'effect.charm.3' }, { id: 'effect.boar-tusk' }, { id: 'effect.captain-hat' }, { id: 'effect.cape' },
  ]);
  expect(driftwoodWeaponGrants(owned)).toEqual([{ id: 'effect.whetstone.2' }, { id: 'effect.bear-claw' }]);
  have.delete('heart-2'); have.delete('whetstone-2'); worn.clear();
  expect(driftwoodPlayerGrants(owned)[0]).toEqual({ id: 'effect.sturdy-heart', stacks: 1 });
  expect(driftwoodPlayerGrants(owned).some(grant => grant.id === 'effect.cape')).toBe(false);
  expect(driftwoodWeaponGrants(owned)[0]).toEqual({ id: 'effect.whetstone.1' });
  expect(driftwoodPlayerGrants({ has: owned.has })).toEqual(driftwoodPlayerGrants(owned));
});

test('the named Nalati W3 worn-skin grants fit the shared selector', () => {
  const locker = new NalatiSkinLocker({ read: () => ({ owned: [], worn: {} }), write: () => true });
  const rows = NALATI_SKINS.map(skin => ({ id: `effect.skin.${skin.id}` as const, key: skin.id }));
  const check = (): void => {
    const selected = new Set(Object.values(locker.worn));
    const grants = selectEffectGrants(rows, key => selected.has(key));
    expect(grants.map(grant => grant.id).sort()).toEqual(locker.effects.active(locker.effectTarget).map(effect => effect.def.id).sort());
  };
  check();
  for (const skin of NALATI_SKINS) { locker.own(skin.id); check(); }
  locker.wear('mount', 'sky-marked-saddle'); check();
  locker.wear('sabre', null); locker.wear('mount', null); check();
});

test('invalid grant capacities and stacks refuse before reading ownership', () => {
  let reads = 0;
  const has = (): boolean => { reads++; return true; };
  const row = { id: 'effect.test' as const, key: 'test' };
  expect(() => selectEffectGrants(Array.from({ length: 129 }, () => row), has)).toThrow('grant rows');
  expect(() => selectEffectGrants([{ ...row, unless: Array.from({ length: 33 }, () => 'test') }], has)).toThrow('grant rows');
  for (const stacks of [0, -1, 0.5, Infinity]) expect(() => selectEffectGrants([{ ...row, stacks }], has)).toThrow('grant rows');
  expect(() => selectEffectGrants([{ ...row, key: '' }], has)).toThrow('grant rows');
  expect(reads).toBe(0);
  expect(selectEffectGrants([], has)).toEqual([]);
});
