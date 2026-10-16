import { expect, it } from 'vitest';
import { pierGeometryKey, pierWorldParams, pierColliders } from '../src/shards/driftwood-isle/runtime/models/pier';
import { pierDeckAt, pierHalfWidthAt } from '../src/shards/driftwood-isle/world/pierLayout';
import { worldPierSites } from '../src/shards/driftwood-isle/generators/pierSites';
import { PIER_DEFAULTS, PIER_VARIANTS } from '../src/shards/driftwood-isle/data/pierRows';
import { pierColliders as originalColliders } from '../src/shards/driftwood-isle/generators/pierColliders';
import { admitDriftwoodFixtureRows } from './fixtures/driftwoodRows';
import rows from '../src/shards/driftwood-isle/data/piers.generated.json' with {type:'json'};

it('admits authored piers and walkable ramps, refusing unbaked sites or parameters', () => {
  admitDriftwoodFixtureRows();
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

it('the admitted rows preserve every original pier descriptor and lend fresh hull buffers', () => {
  admitDriftwoodFixtureRows();
  expect(rows).toHaveLength(7);
  for(const row of rows) {
    const params={...row.params,pennantDir:[...row.params.pennantDir] as [number,number],
      landing:row.params.landing===null?null:{...row.params.landing,postGround:[...row.params.landing.postGround] as [number,number]}};
    const actual=pierColliders(params), expected=originalColliders(params);
    expect(actual).toEqual(expected);
    expect(pierColliders(params)).not.toBe(actual);
    for(const [i,collider] of actual.entries()) {
      const original=expected[i], fresh=pierColliders(params)[i];
      if(collider.kind==='hull'&&original?.kind==='hull'&&fresh?.kind==='hull') {
        expect(collider.points).toEqual(original.points);
        expect(collider.points.buffer).not.toBe(fresh.points.buffer);
      }
    }
  }
  expect(()=>pierColliders({...PIER_DEFAULTS,length:41})).toThrow('authored geometry');
});
