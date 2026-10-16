import { expect, it } from 'vitest';
import { pierGeometryKey, PIER_WORLD, pierColliders } from '../src/shards/driftwood-isle/runtime/models/pier';
import { pierDeckAt, pierHalfWidthAt } from '../src/shards/driftwood-isle/world/pierLayout';
import { worldPierSites, resolvePierParams } from '../src/shards/driftwood-isle/generators/pierSites';
import { pierWorldLayout } from '../src/shards/driftwood-isle/generators/pier';
import { driftwoodGroundSampler } from '../src/shards/driftwood-isle/generators/groundSampling';
import { LOWERED_SEA } from '../src/shards/driftwood-isle/world/sea';
import { PIER_DEFAULTS, PIER_VARIANTS } from '../src/shards/driftwood-isle/data/pierRows';
import { pierColliders as originalColliders } from '../src/shards/driftwood-isle/generators/pierColliders';
import { admitDriftwoodFixtureRows } from './fixtures/driftwoodRows';
import rows from '../src/shards/driftwood-isle/data/piers.generated.json' with {type:'json'};

it('admits authored piers and walkable ramps, refusing unbaked parameters', () => {
  admitDriftwoodFixtureRows();
  expect(PIER_WORLD).toHaveLength(worldPierSites().length);
  for (const { params } of PIER_WORLD) {
    expect(pierGeometryKey(params)).toMatch(/^world-/u);
    expect(pierColliders(params).length).toBeGreaterThan(0);
    expect(pierDeckAt(params, 0)).toBeLessThanOrEqual(pierDeckAt(params, 9));
    expect(pierHalfWidthAt(params, 0)).toBeGreaterThanOrEqual(params.width / 2);
  }
  for (const row of PIER_VARIANTS) expect(pierGeometryKey({ ...PIER_DEFAULTS, ...row.params })).toBeTruthy();
  expect(() => pierGeometryKey({ ...PIER_DEFAULTS, length: 41 })).toThrow('authored geometry');
});

it('bakes each world pier where the world placed it: site, pilings, bollards and legacy boxes', () => {
  const ground = driftwoodGroundSampler();
  for (const [i, site] of worldPierSites().entries()) {
    const { params, ...placed } = PIER_WORLD[i] ?? { params: null }, measured = resolvePierParams(site, ground, LOWERED_SEA);
    expect(params).toEqual(measured);
    expect(placed).toEqual(pierWorldLayout(site, measured));
  }
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
