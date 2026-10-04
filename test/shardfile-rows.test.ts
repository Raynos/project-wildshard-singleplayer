// oxlint-disable-next-line import/no-nodejs-modules -- Read committed JSON author rows.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { isJsonData, parseRows, speciesResolver, simStrikes } from '@wildshard/sdk/rows';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { emptyShardfile } from '@wildshard/sdk/author';
import { declaredDay, declaredWeather, declaredCompendium, declaredLootPresentation } from '@wildshard/game/shard/declaredRows';
import { scoredStrikes } from '@wildshard/game/shardfile/rows';
import { RngService } from '@wildshard/engine/core/rng';
import { Weather } from '@wildshard/engine/world/weather';
import { TEMPLATE_ROWS } from '../src/shards/_template/data/rows';
import type { StrikeContext } from '@wildshard/engine/ai/strikes';
import { legacyDouble } from './fake/FakeGame';

const rows = () => parseRows(JSON.parse(readFileSync('test/fixtures/shardfile/rows.json', 'utf8')));
it('round trips every template row category, with no authored runtime closure', () => {
  const parsed = rows();
  expect(parsed).toEqual(TEMPLATE_ROWS);
  expect(isJsonData(parsed)).toBe(true);
  const shard = emptyShardfile({ slug: 'rows-test', name: 'Rows', author: 'Fixture', revision: 1, seed: 1 });
  shard.rows = parsed;
  const wire = JSON.stringify(shard);
  expect(parseShardfile(JSON.parse(wire)).rows).toEqual(parsed);
  expect(parsed.looks.map((look) => look.recipe)).toEqual(['engine.sphere', 'kit.look.boar']);
  expect(simStrikes(parsed).get('template.blob.bump')?.damage).toBe(8);
  expect(scoredStrikes(parsed).map((strike) => strike.weight(legacyDouble<StrikeContext>({})))).toEqual([2, 1, 1]);
});
it('rejects lossy JSON independently from row typing, without invoking getters', () => {
  const cycle: { self?: object } = {}; cycle.self = cycle;
  let reads = 0;
  const getter = { get value() { reads++; return 1; } };
  const sparse: number[] = []; sparse.length = 2;
  for (const value of [() => 1, undefined, Number.NaN, Infinity, -0, 1n, new Map(), new Date(), cycle, getter, [undefined], sparse]) expect(isJsonData(value)).toBe(false);
  const decorated = [1]; Object.assign(decorated, { extra: 2 }); expect(isJsonData(decorated)).toBe(false);
  expect(reads).toBe(0);
  const authored = rows(); Object.assign(authored.strikes[0] ?? {}, { weight: () => 1 });
  expect(() => parseRows(authored)).toThrow('JSON-only rows');
});
it('rejects unresolved recipes, species variants, weather transitions and schedule gaps', () => {
  const parsed = rows(), resolve = speciesResolver(parsed);
  expect(resolve('grey-blob', 'big')).toMatchObject({ hp: 180, dims: { bodyY: 0.65 } });
  expect(resolve('boar', 'ironhide')).toMatchObject({ hp: 300, mods: { damageTaken: 0.6, relentless: true } });
  expect(resolve('boar', 'greyback').hp).toBe(140);
  expect(() => resolve('grey-blob', 'missing')).toThrow();
  const state = parsed.weather[0]?.states[0]; if (state === undefined) throw new Error('Missing weather');
  state.next = 'missing'; expect(() => parseRows(parsed)).toThrow(); state.next = 'cloudy';
  const segment = parsed.days[0]?.schedule[0]; if (segment === undefined) throw new Error('Missing day');
  segment.from = 1; expect(() => parseRows(parsed)).toThrow();
});
it('uses the existing day/weather mechanisms with the same seeded template outputs', () => {
  const parsed = rows(), weather = parsed.weather[0], day = parsed.days[0];
  if (weather === undefined || day === undefined) throw new Error('Missing climate');
  const declared = declaredWeather(weather, new RngService(17).stream('gameplay'));
  const legacy = new Weather({ states: ['clear', 'cloudy'], next: { clear: 'cloudy', cloudy: 'clear' }, length: { clear: [60, 90], cloudy: [30, 45] }, soak: 0.1, dry: 0.1,
    initial: () => ({ overcast: 0, rain: 0, wet: 0, wind: 0.1, fog: 0 }), numbers: ({ state }) => ({ overcast: state === 'cloudy' ? 0.5 : 0, rain: 0, wet: 0, wind: 0.1, fog: 0 }),
    modes: { live: 'none', clear: { hold: 'clear', dry: true } } }, new RngService(17).stream('gameplay'));
  const clock = declaredDay(day);
  for (let i = 0; i < 10000; i++) { declared.update(1 / 60, clock); legacy.update(1 / 60, clock); clock.update(1 / 60); }
  expect({ state: declared.state, phaseT: declared.phaseT, phaseLen: declared.phaseLen, numbers: declared.n }).toEqual({ state: legacy.state, phaseT: legacy.phaseT, phaseLen: legacy.phaseLen, numbers: legacy.n });
  expect(clock.dayMinutes).toBe(12);
  declared.setMode('clear'); legacy.setMode('clear'); expect(declared.n).toEqual(legacy.n);
});
it('adapts constant compendium text/stats and loot cue data without content callbacks', () => {
  const parsed = rows(), compendium = parsed.compendiums[0], loot = parsed.loot[0];
  if (compendium === undefined || loot === undefined) throw new Error('Missing presentation');
  const book = declaredCompendium(compendium, parsed, 'fixture'), entry = book.entries[0];
  if (entry === undefined) throw new Error('Missing entry');
  expect(book.skin.stamp(entry)).toBe('Beat the blob');
  expect(book.entries[0]?.match).toEqual({ kind: 'greyBlob' });
  const cues: string[] = [], presentation = declaredLootPresentation(loot, (id) => { cues.push(id); });
  expect(presentation.charted()).toBe(false); presentation.chime(); expect(cues).toEqual(['cue.swap']);
});
