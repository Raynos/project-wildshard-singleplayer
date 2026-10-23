// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { jsonSlot } from '../src/engine/saves/slots';
import { pineSetCap } from '../src/shards/pine-hollow-legacy/debug/options';
import { pineTiers } from '../src/shards/pine-hollow-legacy/look/viewDistance';
import { LegacyPineClock } from '../src/shards/pine-hollow-legacy/runtime/questClock';

test('the selected Pine trim applies before plugin construction despite an old off pick', () => {
  const device = jsonSlot('debug.plugin.pine-hollow.pineMemoryTrim', 'device'), original = device.read();
  try {
    device.write('off');
    const phone = { treeHiDist: 60, animalHideDist: 150, marker: 'phone' }, desktop = { marker: 'desktop' };
    const tiers = pineTiers({ phone, desktop });
    expect(tiers.phone).toMatchObject({ treeHiDist: 45, animalHideDist: 112.5, marker: 'phone' });
    expect(tiers.desktop).toBe(desktop); expect(phone.treeHiDist).toBe(60);
    expect([256, 512, 1024, 2048].map(pineSetCap)).toEqual([256, 512, 512, 2048]);
  } finally { device.write(original); }
});

test('the retained native Pine clock keeps night and dawn effect order', () => {
  const effects: [string, number][] = [];
  const clock = new LegacyPineClock({ seen: () => false, hasClock: () => true, night: () => 0,
    publish: (event, value) => { effects.push([event, value]); } });
  clock.night(); clock.dawn(); clock.dawn();
  for (const dt of [2.5, 1.5, 1, 7]) clock.tick(dt);
  expect(effects).toEqual([['night.consume', 0], ['night.start', 6], ['dawn.start', 0],
    ['dawn.sunrise', 7], ['dawn.lanterns', 0], ['dawn.caption', 0], ['dawn.finish', 0]]);
  expect(clock.save()).toBe(-1);
});
