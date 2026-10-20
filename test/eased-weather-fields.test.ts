// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { EasedFields, easeField } from '../src/engine/world/easedFields';
import { parseEasedFields } from '../src/format/easedFields';
import { SIGNAL_WEATHER_FIELDS } from '../src/shards/sunscar-dunes/generators/weatherFields';
import { Scope } from '../src/engine/app/scope';
import { Flags } from '../src/engine/world/interact/flags';
import { QuestState } from '../src/engine/quest/core';
import { publishBoundQuest } from '../src/game/quest/boundState';
import { installWeatherFields, settleWeatherFields } from '../src/game/shardfile/weatherFields';
import { sceneScalar, sceneScalarValue } from '../src/game/shardfile/sceneInputs';
import { graphParamFeeds } from '../src/game/shardfile/clientGraphs';
import type { ShardContext } from '../src/game/plugin/context';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { DUSK, setDusk, stepDusk } from '../src/shards/sunscar-dunes-legacy/look/dusk';

test('every Signal save step snaps, while play follows the sealed dusk law exactly', () => {
  const rows = SIGNAL_WEATHER_FIELDS, current = new EasedFields(rows);
  const stages = [
    { flags: [], target: 0 },
    { flags: ['sunscar.scout'], target: 0.5 },
    { flags: ['sunscar.scout', 'sunscar.logbook'], target: 0.52 },
    { flags: ['sunscar.oil', 'sunscar.logbook'], target: 0.56 },
    { flags: ['sunscar.oil', 'sunscar.brazier.2'], target: 0.62 },
    { flags: ['sunscar.brazier.0', 'sunscar.brazier.2'], target: 0.74 },
    { flags: ['sunscar.brazier.0', 'sunscar.brazier.1', 'sunscar.brazier.2'], target: 0.86 },
    { flags: ['sunscar.lit', 'sunscar.oil'], target: 1 },
  ];
  setDusk(0, true);
  for (const stage of stages) {
    const saved = new EasedFields(rows); saved.step(0, stage.flags, true);
    expect(saved.value('dusk')).toBe(stage.target);
    setDusk(stage.target);
    for (let frame = 0; frame < 1000; frame++) {
      const dt = (frame % 13 + 1) / 120;
      current.step(dt, stage.flags); stepDusk(dt);
      expect(current.value('dusk')).toBe(DUSK.value);
    }
  }
  expect(() => current.value('missing')).toThrow(); setDusk(0, true);
});

test('a fictional weather table has first-match, count and exclusion semantics with independent fields', () => {
  const rows = parseEasedFields({ version: 1, fields: [
    { field: 'mist', ease: { rate: 0.5 }, min: 0, max: 1, else: 0, steps: [
      { when: { all: ['storm'], none: ['sheltered'] }, value: 1 },
      { when: { count: { of: ['ridge', 'valley', 'coast'], atLeast: 2 } }, value: 0.75 },
      { when: { any: ['cloud', 'storm'] }, value: 0.25 },
    ] },
    { field: 'wind', ease: { rate: 2 }, min: -1, max: 1, else: -1, steps: [{ when: { all: ['storm'] }, value: 1 }] },
  ] });
  const fields = new EasedFields(rows), facts = ['storm', 'ridge', 'valley'];
  fields.step(0.5, facts); expect(fields.value('mist')).toBe(0.25); expect(fields.value('wind')).toBe(0);
  fields.step(0, [...facts, 'sheltered'], true); expect(fields.value('mist')).toBe(0.75); expect(fields.value('wind')).toBe(1);
  fields.step(0, ['cloud'], true); expect(fields.value('mist')).toBe(0.25); expect(fields.value('wind')).toBe(-1);
  for (const value of [{ ...rows, fields: [...rows.fields, ...rows.fields] },
    { version: 1, fields: [{ ...rows.fields[0], else: 99 }] },
    { version: 1, fields: [{ ...rows.fields[0], ease: { rate: 0 } }] },
    { version: 1, fields: [{ ...rows.fields[0], hook: () => 1 }] }]) expect(() => parseEasedFields(value)).toThrow();
});

test('storm seconds preserve the original division ordering and never overshoot', () => {
  for (const seconds of [0.3, 1, 3, 7, 17]) {
    let current = 0, original = 0;
    for (let frame = 0; frame < 3000; frame++) {
      const target = frame % 100 < 40 ? 1 : 0, dt = (frame % 17 + 1) / 120;
      original += Math.sign(target - original) * Math.min(Math.abs(target - original), dt / seconds);
      current = easeField(current, target, dt, { seconds }); expect(current).toBe(original);
    }
  }
  expect(easeField(0.99, 1, 1, { rate: 1 })).toBe(1);
  expect(() => easeField(0, 1, -1, { rate: 1 })).toThrow();
});

test('weather installer borrows saved quest flags, snaps on entry and clears only its presentation on exit', () => {
  const scope = new Scope('fictional-weather'), flags = new Flags('fictional-weather', false);
  flags.set('wet');
  const quest = new QuestState({ id: 'weather.quest', title: 'Weather quest', completeFlag: 'done', steps: [] }, flags);
  publishBoundQuest(scope, quest);
  const rows = parseEasedFields({ version: 1, fields: [{ field: 'mist', min: 0, max: 1, ease: { rate: 0.25 }, else: 0,
    steps: [{ when: { all: ['storm'] }, value: 1 }, { when: { all: ['wet'] }, value: 0.5 }] }] });
  const systems: Parameters<ShardContext['system']>[0][] = [];
  const source = emptyShardfile({ slug: 'fictional-weather', name: 'Weather', author: 'Fixture', revision: 1, seed: 1 });
  source.state.shared.push({ id: 1, name: 'mist', type: 'f64', privacy: 'host', default: 0 });
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(),
    files: new Map(), read: () => Promise.reject(new Error('No weather blob')) });
  const base: Pick<ShardContext, 'scope' | 'product' | 'system' | 'debug'> = { scope, product,
    system: spec => { systems.push(spec); }, debug: { expose: () => undefined } };
  const ctx = base as ShardContext;
  installWeatherFields(ctx, rows, 'weather.quest');
  expect(sceneScalarValue('fictional-weather', 'mist')).toBe(0.5);
  expect(flags.all).toEqual(['wet']);
  flags.set('storm'); systems[0]?.run(1, 1);
  expect(sceneScalarValue('fictional-weather', 'mist')).toBe(0.75);
  settleWeatherFields('fictional-weather', flags.all); expect(sceneScalarValue('fictional-weather', 'mist')).toBe(1);
  const durable = flags.all; scope.dispose();
  expect(sceneScalarValue('fictional-weather', 'mist')).toBe(0); expect(flags.all).toEqual(durable);
  expect(() => settleWeatherFields('fictional-weather', flags.all)).toThrow();
});

test('graph feeds borrow only declared host scalars and preserve an explicit state owner', () => {
  const source = emptyShardfile({ slug: 'weather-feed', name: 'Weather', author: 'Fixture', revision: 1, seed: 1 });
  source.state.shared.push({ id: 1, name: 'mist', type: 'f64', privacy: 'host', default: 0.1 },
    { id: 2, name: 'sun', type: 'f64', privacy: 'public', default: 0.2 });
  sceneScalar(source.identity.slug, 'mist').value = 0.7; sceneScalar(source.identity.slug, 'sun').value = 0.9;
  const feeds = graphParamFeeds(source), observed = new Map<string, readonly number[] | number>();
  feeds.attach({ bindings: [{ param: 'mist', bind: { state: 'shared.mist' } }, { param: 'sun', bind: { state: 'shared.sun' } }],
    setParam: (name, value) => { observed.set(name, value); } }, { mist: { type: 'float', value: 0.1 }, sun: { type: 'float', value: 0.2 } });
  expect(observed.get('mist')).toBe(0.7); expect(observed.get('sun')).toBe(0.2);
  sceneScalar(source.identity.slug, 'mist').value = 0.8; feeds.tick(0); expect(observed.get('mist')).toBe(0.8);
  feeds.bind({ state: () => 0.3 }); expect(observed.get('mist')).toBe(0.3);
});
