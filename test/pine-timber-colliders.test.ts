import { expect, test } from 'vitest';
import * as v from 'valibot';
import { TimberRowSchema } from '../src/shards/pine-hollow/generators/timberSchema';
import sites from '../src/shards/pine-hollow/data/siteTimbers.json';

test('timber rows admit the authored box/tread families and own their native descriptors', () => {
  for (const site of [sites.landing.world, sites.landing.turntable, sites.bridge.world, sites.bridge.turntable]) {
    const first = v.parse(TimberRowSchema, site), second = v.parse(TimberRowSchema, site);
    expect(first.colliders).toEqual(site.colliders);
    expect(second.colliders).toEqual(first.colliders);
    const tread = first.colliders.find(row => row.kind === 'treads');
    if (tread?.kind === 'treads') tread.from.y += 1;
    expect(second.colliders).toEqual(site.colliders);
    expect(() => v.parse(TimberRowSchema, { ...site, colliders: [{ kind: 'ball', x: 0, y: 0, z: 0, radius: 1 }] })).toThrow();
    expect(() => v.parse(TimberRowSchema, { ...site, colliders: [{ ...site.colliders[0], surface: 'sand' }] })).toThrow();
  }
});
