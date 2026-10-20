import { expect, test } from 'vitest';
import * as v from 'valibot';
import { RainPresentationSchema } from '../src/format/rainPresentation';
import { RAIN } from '../src/shards/pine-hollow/generators/rangedPage';

/** An unrelated orchard's drizzle: no hood, one barn roof in its own frame, a small bake and its own graphs. */
const pack = { bytes: 1024, geometries: [{ attrs: [['position', 3], ['aWater', 4]], count: 30, unique: 30, own: 'u16', indexCount: 60 }, { attrs: [['values', 1]], count: 4096, unique: 64, own: null, indexCount: 4096 }] };
const orchard = {
  name: 'orchard-drizzle', programs: { rain: 'orchard-rain', splash: 'orchard-splash', lens: 'orchard-lens', channels: 'orchard.rain' },
  look: { coverN: 64, streaks: { phone: 900, desktop: 1600 }, splashes: { phone: 16, desktop: 24 }, lensDrops: { phone: 4, desktop: 8 } },
  cover: { page: 'orchard.page', roofs: [{ frame: { x: 12, z: -4, yaw: 0.5 }, polygon: [[-3, -2], [3, -2], [3, 2], [-3, 2]] }] },
  water: { look: 'orchard-puddle', name: 'orchard-puddles', renderOrder: 2 }, rings: ['orchard-puddle', 'orchard-trough'],
  bake: { phone: { url: '/assets/orchard/rain.phone.bin', rows: pack }, desktop: { url: '/assets/orchard/rain.bin', rows: pack } },
};

test('rain rows admit an unrelated orchard and Pine Hollow with its cave hood', () => {
  const rows = v.parse(RainPresentationSchema, orchard);
  expect(rows.hood).toBeUndefined(); expect(rows.water.culled).toBe(true);
  expect(rows.cover.roofs[0]?.polygon).toHaveLength(4);
  const pine = v.parse(RainPresentationSchema, structuredClone(RAIN));
  expect(pine.hood?.up).toBeGreaterThan(0); expect(pine.bake.phone.url).toMatch(/\.phone\.bin$/u);
});

test('rain rows refuse a callback, an unbounded cover map and too many roofs', () => {
  expect(v.safeParse(RainPresentationSchema, { ...orchard, roofAt: () => true }).success).toBe(false);
  expect(v.safeParse(RainPresentationSchema, { ...orchard, look: { ...orchard.look, coverN: 4096 } }).success).toBe(false);
  expect(v.safeParse(RainPresentationSchema, { ...orchard, cover: { ...orchard.cover, roofs: Array.from({ length: 17 }, () => orchard.cover.roofs[0]) } }).success).toBe(false);
});
