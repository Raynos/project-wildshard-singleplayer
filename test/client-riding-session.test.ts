import { expect, test } from 'vitest';
import { parse } from 'valibot';
import { ClientRidingSessionSchema, cleanMountName } from '../src/format/riding';
import { NALATI_RIDING_SESSION } from '../src/shards/nalati-grasslands/generators/clientRiding';
import { MountedArsenal } from '../src/game/loadout/mounted';
import { Scope } from '../src/engine/app/scope';

test('client session rejects callback ports and admits an unrelated ride profile', () => {
  const rows = structuredClone(NALATI_RIDING_SESSION);
  rows.preset.mountableLabel = 'Orchard deer'; rows.profile.speeds.gallop = 9;
  rows.naming.maximum = 8; rows.naming.notice = 'Your companion is '; rows.naming.bondedFeat = 'befriend';
  rows.rest = { x: 23, z: -41, face: { x: 0, z: 1 } }; rows.taming.rail = { x: 25, z: -40 };
  const admitted = parse(ClientRidingSessionSchema, rows);
  expect(admitted.rest).toEqual(rows.rest); expect(admitted.naming.maximum).toBe(8);
  for (const bad of [{ ...rows, naming: { ...rows.naming, maximum: 129 } },
    { ...rows, naming: { ...rows.naming, onSave: () => undefined } },
    { ...rows, figure: { row: { build: () => null } } },
    { ...rows, taming: { ...rows.taming, owner: 'borrowed', path: ['herds'] } }])
    expect(() => parse(ClientRidingSessionSchema, bad)).toThrow();
});

test('native names keep unicode graphemes, reject markup and respect the row cap', () => {
  expect(cleanMountName('  ka<ra>   jorga<script>  ', 10)).toBe('Kara Jorga');
  expect(cleanMountName(' e\u0301clair and an extra word ', 6)).toBe('Éclair');
  expect(cleanMountName('\u200B<>&', 16)).toBe('');
  expect(() => cleanMountName('Camp horse', 0)).toThrow('limit');
  expect(() => cleanMountName('Camp horse', 1.5)).toThrow('limit');
});

test('the session cannot bind an unbuilt or disposed equipment authority', () => {
  const scope = new Scope('orchard.kit');
  const arsenal = new MountedArsenal({ blade: { file: 'blade.json', item: 'weapon.blade' },
    polearm: { file: 'pole.json', item: 'weapon.pole' }, bow: { file: 'bow.json', item: 'weapon.bow' }, initial: 'bow',
    variants: { bow: { id: 'weapon.bow-upgraded', name: 'Bow' }, blade: { id: 'weapon.blade-upgraded', name: 'Blade' } } });
  expect(arsenal.pageKit({ scope })).toBeNull();scope.dispose();
  expect(arsenal.pageKit({ scope })).toBeNull();
});
