import { expect, test } from 'vitest';
import { parseClientPlan } from '../src/format/clientPlan';
import { CLIENT_FEATURES } from '../src/game/shardfile/clientPlan';
import plan from '../src/shards/pine-hollow/data/clientPlan.json' with { type: 'json' };

// G571: a forest page, its cave, weather and life are declared client features (sp-x8 QX: inline page-mode caps,
// world 30 after world.scenes, the cave's spots at play 35, weather 40, life 65: their order inside Pine's old plugin)
test('Pine declares its forest page, cave, weather and life as rows', () => {
  const kinds = parseClientPlan(plan).features.map(row => row.kind);
  expect(kinds).toEqual(expect.arrayContaining(['world.forest-page', 'weather.forest', 'page.life']));
});

test('a cave cap is inline page-mode rows, never a lookup', () => {
  const row = { kind: 'world.forest-page', file: 'world/forest-page.json', cave: { file: 'world/cave-interior.json', cap: { shard: null, grid: { through: 1024, max: 512 } } } };
  expect(parseClientPlan({ version: 1, features: [row] }).features).toHaveLength(1);
  for (const cap of [{ module: './data/pagePolicy.json', export: 'default' }, { shard: null, grid: { through: -1, max: 512 } }, { shard: null }])
    expect(() => parseClientPlan({ version: 1, features: [{ ...row, cave: { ...row.cave, cap } }] })).toThrow();
});

test('the features build in the old plugin order', () => {
  const page = CLIENT_FEATURES['world.forest-page'], weather = CLIENT_FEATURES['weather.forest'], life = CLIENT_FEATURES['page.life'];
  expect([page.phase, page.rank, page.play?.rank]).toEqual(['world', 30, 35]);
  expect(CLIENT_FEATURES['world.scenes'].rank).toBeLessThan(page.rank);
  expect([weather.phase, weather.rank, life.phase, life.rank]).toEqual(['play', 40, 'play', 65]);
  expect(CLIENT_FEATURES['held.ranged-page'].phase).toBe('world');
});
