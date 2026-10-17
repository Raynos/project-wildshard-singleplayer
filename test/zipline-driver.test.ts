import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { ZiplineDriver } from '../src/engine/sim/cableTraversal';
import { ZiplineLayout } from './fixtures/driftwood-zipline/shipping';
import { ZIPLINE, ZIP_RIDE } from '../src/shards/pine-hollow/generators/zipline';
import spots from '../src/shards/pine-hollow/data/spots.generated.json' with { type: 'json' };

test('the default Driftwood ride keeps its deck anchors, release and silent continuation', () => {
  const row = { ...ZIPLINE, id: 'ride', top: { x: 0, y: 30, z: 0 }, bottom: { x: 0, y: 2, z: 70 }, hang: 2.9, sag: 1.6 };
  const driver = new ZiplineDriver(row);
  const old = new ZiplineLayout({ top: new Vector3(0, 30, 0), bottom: new Vector3(0, 2, 70), sag: row.sag });
  const player = { position: new Vector3(), velocity: new Vector3() };
  expect(driver.len).toBeCloseTo(old.len, 8);
  driver.start(); driver.update(0.2, player);
  const saved = driver.snapshot(), resumed = new ZiplineDriver(row);
  resumed.restore(saved); expect(resumed.snapshot()).toEqual(saved);
  let steps = 0; while (resumed.isRiding && steps++ < 2000) resumed.update(1 / 60, player);
  expect(resumed.isRiding).toBe(false);
  expect(player.velocity.y).toBe(1.5); expect(player.velocity.length()).toBeGreaterThan(1.5);
  expect(player.position.y).toBeGreaterThan(row.bottom.y);
});

test('direct-anchor Pine rides release at the declared deck and resume their continuation', () => {
  const { top, bottom, landing } = spots.zip;
  const driver = new ZiplineDriver({ ...ZIPLINE, top, bottom }, ZIP_RIDE, landing);
  const player = { position: new Vector3(), velocity: new Vector3() };
  driver.start(); driver.update(0.3, player);
  const saved = driver.snapshot(); driver.restore(saved); expect(driver.snapshot()).toEqual(saved);
  let steps = 0; while (driver.isRiding && steps++ < 2400) driver.update(1 / 60, player);
  expect(driver.isRiding).toBe(false);
  expect(player.position.x).toBeCloseTo(landing.x - driver.dir.x * ZIP_RIDE.landing.back, 8);
  expect(player.position.z).toBeCloseTo(landing.z - driver.dir.z * ZIP_RIDE.landing.back, 8);
  expect(player.position.y).toBeGreaterThanOrEqual(landing.y + ZIP_RIDE.landing.deck);
  expect(player.velocity.length()).toBeCloseTo(ZIP_RIDE.landing.velocity, 8);
  expect(driver.speed).toBeGreaterThan(0);
});
