import { expect, it } from 'vitest';
import { pierGeometryKey, pierWorldParams, pierColliders } from '../src/shards/driftwood-isle/models/pier';
import { pierDeckAt, pierHalfWidthAt } from '../src/shards/driftwood-isle/world/pierLayout';
import { worldPierSites } from '../src/shards/driftwood-isle/generators/pierSites';
import { PIER_DEFAULTS, PIER_VARIANTS } from '../src/shards/driftwood-isle/data/pierRows';

it('admits authored piers and walkable ramps, refusing unbaked sites or parameters', () => {
  for (const site of worldPierSites()) {
    const params = pierWorldParams(site);
    expect(pierGeometryKey(params)).toMatch(/^world-/u);
    expect(pierColliders(params).length).toBeGreaterThan(0);
    expect(pierDeckAt(params, 0)).toBeLessThanOrEqual(pierDeckAt(params, 9));
    expect(pierHalfWidthAt(params, 0)).toBeGreaterThanOrEqual(params.width / 2);
  }
  for (const row of PIER_VARIANTS) expect(pierGeometryKey({ ...PIER_DEFAULTS, ...row.params })).toBeTruthy();
  expect(() => pierGeometryKey({ ...PIER_DEFAULTS, length: 41 })).toThrow('authored geometry');
  const site = worldPierSites()[0];
  if (site === undefined) throw new Error('No declared world pier');
  expect(() => pierWorldParams({ ...site, x: site.x + 1 })).toThrow('authored geometry');
});
