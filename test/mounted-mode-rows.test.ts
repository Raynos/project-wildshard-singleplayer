import { expect, it } from 'vitest';
import { Mount } from '../src/sdk/modes';
import { parseModes } from '../src/format/modes';
import { shardfileRules } from '@wildshard/format/shardSchema';
import { withoutRuntimeRows } from '../src/game/plugin/headless';
import source from '../src/shards/nalati-grasslands/shard.config';
import { NALATI_RIDE } from '../src/shards/nalati-grasslands/data/modes';
import { HORSE_SPEED } from '../src/shards/nalati-grasslands/species/horse';

it('authors the same admitted mounted profile without granting an actor or altering the native horse speeds', () => {
  const mount = new Mount(HORSE_SPEED), copied = mount.clone();
  expect(mount.toModeData()).toEqual(NALATI_RIDE);
  expect(copied.toModeData()).toEqual(mount.toModeData());
  expect(copied.gaits).not.toBe(mount.gaits);
  expect(source.modes?.ride).toEqual([NALATI_RIDE]);
  expect(withoutRuntimeRows(source).modes?.ride).toBeUndefined();
  expect(shardfileRules({ ...source, runtime: null })).toContain('traverse modes require runtime.binds modes until the data client owns their player phase');
  expect(parseModes({})).toEqual({ traverse: [] });
});
it('refuses duplicate or malformed control profiles before a host allocates a mounted motor', () => {
  for (const gaits of [{ ...HORSE_SPEED, walk: 0 }, { ...HORSE_SPEED, gallop: Infinity }, { ...HORSE_SPEED, trot: HORSE_SPEED.walk },
    { ...HORSE_SPEED, canter: 31 }, { ...HORSE_SPEED, extra: 1 }]) {
    expect(() => parseModes({ ride: [{ ...NALATI_RIDE, gaits }] })).toThrow();
  }
  expect(() => parseModes({ ride: [NALATI_RIDE, NALATI_RIDE] })).toThrow();
  expect(() => parseModes({ ride: [{ ...NALATI_RIDE, mount: 'unearned' }] })).toThrow();
});
