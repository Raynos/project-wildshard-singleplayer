import { expect, test } from 'vitest';
import assembly from '../src/shards/nalati-grasslands/data/headlessAssembly.json' with { type: 'json' };
import { readPouncerSpec, readHowlerSpec } from '../src/engine/ai/stalker';
import { buildEliteEntryRows, buildEliteEntryPageRows } from '../src/shards/nalati-grasslands/generators/eliteEntryRows';
import ecology from '../src/shards/nalati-grasslands/data/ecology.generated.json' with { type: 'json' };
import source from '../src/shards/nalati-grasslands/data/eliteRoster.json' with { type: 'json' };
import charge from '../src/shards/nalati-grasslands/data/eliteCharge.generated.json' with { type: 'json' };
import { ELITE_BODY_COLUMNS, ELITE_CONDITION_COLUMNS } from '../src/format/eliteEntryRows';

test('the existing elite producer declares the original ordered controllers and condition observations', () => {
  const result = buildEliteEntryRows();
  expect(result.rows.entries.map(row => row.id)).toEqual([...ecology.keeperElites, ...ecology.externalElites].map(row => row.def.id));
  expect(result.rows.conditions).toEqual(source.conditions.map(row => ({ id: row.id, program: 'elite.rules', signal: row.signal, observations: Object.entries(row.observations).map(([field, value]) => ({ field, value })) })));
  expect(result.observations).toEqual([{ id: 'elite.conditions', rows: ELITE_CONDITION_COLUMNS }, ...ecology.keeperElites.map(row => ({ id: `${row.def.id}.inputs`, rows: ELITE_BODY_COLUMNS }))]);
  ecology.keeperElites.forEach((old, index) => {
    const row = result.rows.entries[index]; if (row === undefined || row.controller.kind === 'borrowed') throw new Error('Missing native controller');
    expect(row.controller.kind).toBe(old.pattern); expect(row.condition).toBe(old.def.rule);
    expect(row.controller.spawn).toEqual({ kind: old.kind, variant: old.def.id, yaw: old.yaw, offset: old.offset, memory: old.memory });
    const amounts = old.pattern === 'pouncer' ? [old.spec.swipe.damage, old.spec.pounce.damage] : [old.pattern === 'howler' ? old.spec.bite.damage : old.spec.stoop.damage];
    expect(row.controller.contacts.map(hit => hit.amount)).toEqual([...new Set(amounts)]);
    row.controller.contacts.forEach(hit => { expect(result.actions.find(action => action.id === hit.action)).toEqual({ id: hit.action, kind: 'contact', controller: index, amount: hit.amount }); });
  });
  ecology.externalElites.forEach((old, index) => {
    const controller = ecology.keeperElites.length + index;
    expect(result.rows.entries[controller]).toEqual({ id: old.def.id, condition: old.def.rule, controller: { kind: 'borrowed', controller: old.def.id } });
    const actions = result.actions.filter(row => row.controller === controller);
    if (old.mode === 'script') expect(actions.filter(row => row.kind === 'contact').map(row => row.amount)).toEqual([...new Set(charge.strikes.map(row => row.row.damage))]);
    else expect(actions.find(row => row.kind === 'wildlife-herd')).toMatchObject({ kind: 'wildlife-herd', actorKind: old.spawn.kind, variant: old.spawn.variant, offset: old.spawn.offset, mares: old.spawn.mares, foals: old.spawn.foals, stallion: old.spawn.stallion });
  });
});


test('declared page rows retain original profiles, external laws, reward presentation and order', () => {
  const rows = buildEliteEntryPageRows();
  expect(rows.profiles).toEqual(ecology.keeperElites.map(value => ({ id: value.def.id, value })));
  expect(rows.borrowed).toEqual(ecology.externalElites);
  expect(rows.presentation).toEqual(Object.fromEntries(Object.values(ecology.elites).map(def => [def.id, {
    prompt: `Take the ${def.drop.skinName} ${def.drop.weapon} skin`, toast: `${def.drop.skinName} ${def.drop.weapon} skin — ${def.drop.blurb}`,
    hum: true, sting: { banner: .8, phase2: 1, kill: 'chunk' },
  }])));
  expect(rows.prewarm).toEqual(source.prewarm); expect(rows.debug).toBe(source.debug);
});


test('native keeper references resolve the original specs from the declared page profile envelope', () => {
  const rows = buildEliteEntryPageRows(), refs: readonly (string | number)[][] = references(assembly);
  const specs = refs.filter(ref => ref[0] === 'constants' && ref[1] === 'pageElites' && ref.at(-1) === 'spec');
  expect(specs).toEqual([['constants', 'pageElites', 'profiles', 0, 'value', 'spec'], ['constants', 'pageElites', 'profiles', 1, 'value', 'spec']]);
  const resolve = (path: readonly (string | number)[]): unknown => {
    let value: unknown = { constants: { pageElites: rows } };
    for (const key of path) {
      if (value === null || typeof value !== 'object') throw new Error('Missing keeper reference');
      value = Reflect.get(value, key);
    }
    return value;
  };
  expect(readPouncerSpec(resolve(specs[0] ?? []))).toEqual(ecology.profiles.aqbars.spec);
  expect(readHowlerSpec(resolve(specs[1] ?? []))).toEqual(ecology.profiles.kokbori.spec);
});

function references(input: unknown): (string | number)[][] {
  if (input === null || typeof input !== 'object') return [];
  if (Array.isArray(input)) return input.flatMap(references);
  const ref: unknown = Reflect.get(input, '$ref');
  const own: (string | number)[][] = [];
  if (Array.isArray(ref)) {
    const keys: unknown[] = ref;
    if (keys.every((key): key is string | number => typeof key === 'string' || typeof key === 'number')) own.push(keys);
  }
  return [...own, ...Object.values(input).flatMap(references)];
}
