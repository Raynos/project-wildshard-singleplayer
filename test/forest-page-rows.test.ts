import { expect, test } from 'vitest';
import * as v from 'valibot';
import { ForestPageSchema, ForestGroundLayoutSchema } from '../src/format/forestPage';
import { RangedPageSchema, ForestWeatherObservationSchema } from '../src/format/rangedPage';
import { ForestRoofMask } from '../src/game/looks/forestRoofMask';
import { FOREST_PAGE } from '../src/shards/pine-hollow/generators/forestPage';
import { RANGED_PAGE, WEATHER_OBSERVATIONS } from '../src/shards/pine-hollow/generators/rangedPage';

test('an orchard shelter uses its own rotated decks and cave frame', () => {
  const mask = new ForestRoofMask({ floors: [{ x: 20, y: 3, z: -10, hw: 4, hd: 1, rot: Math.PI / 2 }],
    roofs: [{ frame: { x: -20, z: 10, yaw: Math.PI / 2 }, polygon: [[-2, 0], [2, 0], [2, 8], [-2, 8]] }] });
  expect(mask.contains(20, -7)).toBe(true); expect(mask.contains(23, -10)).toBe(false);
  expect(mask.contains(-16, 10)).toBe(true); expect(mask.contains(-20, 15)).toBe(false);
  expect(() => new ForestRoofMask({ floors: [], roofs: [], roofAt: () => true })).toThrow();
});

test('forest and equipment rows preserve native identities and refuse callback ownership', () => {
  const forest = v.parse(ForestPageSchema, structuredClone(FOREST_PAGE)), ranged = v.parse(RangedPageSchema, structuredClone(RANGED_PAGE));
  expect(forest.buildings.variants).toHaveLength(8); expect(forest.buildings.light.count).toBe(2);
  expect(ranged.prewarm).toEqual([{ kind: 'antler-king', variant: 'warden' }, { kind: 'elk', variant: 'thrall' }, { kind: 'boar', variant: 'thrall' }]);
  expect(ranged.drops.rifle.parameters).toEqual(['rifle', 'lever']);
  expect(v.parse(ForestWeatherObservationSchema, WEATHER_OBSERVATIONS).guide).toBe('wardens-hollow');
  expect(() => v.parse(ForestPageSchema, { ...forest, onUpdate: () => undefined })).toThrow('JSON');
  expect(() => v.parse(RangedPageSchema, { ...ranged, collection: { ...ranged.collection, wall: () => undefined } })).toThrow('JSON');
});

test('ground layouts reject an unmatched count or an oversized field', () => {
  expect(() => v.parse(ForestGroundLayoutSchema, { counts: [1], layout: { orchard: [] } })).toThrow('counts');
  expect(v.parse(ForestGroundLayoutSchema, { counts: [0, 0], layout: { meadow: [], orchard: [] } }).counts).toEqual([0, 0]);
});

test('an orchard page declares its own tree set, floor models and slice budget', () => {
  const forest = v.parse(ForestPageSchema, structuredClone(FOREST_PAGE));
  const orchard = { ...forest, trees: 'world/orchard-trees.json', sliceMs: 12,
    ground: { ...forest.ground, kinds: [{ id: 'clover', geometry: 'orchard-clover', model: 'orchard/clover', name: 'Clover' }] } };
  expect(v.parse(ForestPageSchema, orchard).ground.kinds[0]?.model).toBe('orchard/clover');
  expect(() => v.parse(ForestPageSchema, { ...orchard, sliceMs: 0 })).toThrow();
  expect(() => v.parse(ForestPageSchema, { ...orchard, ground: { ...orchard.ground, kinds: [{ id: 'clover', geometry: 'orchard-clover' }] } })).toThrow();
});

test('an orchard page places its own landmarks, a tier batch finishing after its modules', () => {
  const forest = v.parse(ForestPageSchema, structuredClone(FOREST_PAGE));
  const landmarks = [{ place: 'orchard.well' }, { place: 'orchard.phone.wall', tier: 'phone' }, { object: 'orchard.phone', tier: 'phone' }];
  expect(v.parse(ForestPageSchema, { ...forest, landmarks }).landmarks).toEqual(landmarks);
  expect(() => v.parse(ForestPageSchema, { ...forest, landmarks: [{ place: 'orchard.well', object: 'orchard.phone' }] })).toThrow();
  expect(() => v.parse(ForestPageSchema, { ...forest, landmarks: [{ place: 'orchard.well', tier: 'console' }] })).toThrow();
  const crags = forest.landmarks.filter(row => row.tier === 'phone');
  expect(crags.at(-1)).toEqual({ object: 'crags.phone', tier: 'phone' });
});
