import { expect, test } from 'vitest';
import { parseWorldScenePlacement } from '../src/format/worldScenePlacement';

// a placement pose may carry its instanced copy's own colour (Nine's wall kit and drawn facade pieces)
const row = (color: unknown) => ({ id: 'nds-inst-plant.town', model: 'galleryPlant', draw: 'instanced', poses: [{ x: 1, y: 2, z: 3, matrix: Array.from({ length: 16 }, (_, i) => i % 5 === 0 ? 1 : 0), color }] });
test('a pose colour is an RGB triple; any other shape refuses', () => {
  expect(parseWorldScenePlacement(row([0.5, 0.25, 1])).poses[0]?.color).toEqual([0.5, 0.25, 1]);
  expect(() => parseWorldScenePlacement(row([0.5, 0.25]))).toThrow();
  expect(() => parseWorldScenePlacement(row('red'))).toThrow();
  const { poses: [pose] } = parseWorldScenePlacement({ ...row(undefined), poses: [{ x: 0, y: 0, z: 0, yxz: { yaw: 0, scale: 1 } }] });
  expect(pose?.color).toBeUndefined();
});
