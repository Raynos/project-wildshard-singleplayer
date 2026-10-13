import { expect, it } from 'vitest';
import sky from '../src/shards/far-reach/manifest';
import signal from '../src/shards/sunscar-dunes/manifest';
import { SKY_DEV_POSES } from '../src/shards/far-reach/data/devPoses';
import { SIGNAL_DEV_POSES } from '../src/shards/sunscar-dunes/data/devPoses';
import skyBefore from './fixtures/boot-poses/far-reach.json';
import signalBefore from './fixtures/boot-poses/sunscar-dunes.json';

it('retains all eight shipping Sky camera poses as serializable data', async () => {
  expect(SKY_DEV_POSES).toEqual(skyBefore);
  expect(JSON.stringify(SKY_DEV_POSES)).toBe(JSON.stringify(skyBefore));
  expect(await sky.dev?.poses()).toEqual(skyBefore);
});
it('retains all five shipping Signal camera poses and original terrain heights', async () => {
  expect(SIGNAL_DEV_POSES).toEqual(signalBefore);
  expect(JSON.stringify(SIGNAL_DEV_POSES)).toBe(JSON.stringify(signalBefore));
  expect(await signal.dev?.poses()).toEqual(signalBefore);
});
it('returns fresh pose records and tuples on each call, as the old lazy factories did', async () => {
  for (const manifest of [sky, signal]) {
    if (manifest.dev === undefined) throw new Error('Missing admitted pose binding');
    const first = await manifest.dev.poses(), second = await manifest.dev.poses();
    expect(first).not.toBe(second);
    for (const name of Object.keys(first)) { expect(first[name]).not.toBe(second[name]); expect(first[name]?.eye).not.toBe(second[name]?.eye); }
    expect(first).toEqual(second);
  }
});
