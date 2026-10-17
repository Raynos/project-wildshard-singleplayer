import { admitDriftwoodFixtureRows } from './fixtures/driftwoodRows';
import { beforeAll, expect, it } from 'vitest';
import { driftwoodGroundSampler } from '../src/shards/driftwood-isle/generators/groundSampling';
import { ShipwreckBuilder } from '../src/shards/driftwood-isle/generators/shipwreck';
import { wreckSiteKind } from '../src/shards/driftwood-isle/runtime/models/fixedSites';
import { floorAtRects } from '../src/engine/physics/box';
import { WRECK_SITES } from '../src/shards/driftwood-isle/data/wreckSites';
import bake from '../src/shards/driftwood-isle/data/wreckBake.json' with { type: 'json' };

beforeAll(admitDriftwoodFixtureRows);

it('admits the authored world wreck and Explorer specimen, refusing an unbaked site', () => {
  expect(wreckSiteKind(WRECK_SITES.world)).toBe('world');
  expect(wreckSiteKind(WRECK_SITES.specimen)).toBe('specimen');
  expect(() => wreckSiteKind({...WRECK_SITES.world,x:WRECK_SITES.world.x+1})).toThrow('authored geometry');
  expect(() => wreckSiteKind({...WRECK_SITES.specimen,roll:0})).toThrow('authored geometry');
});

it('keeps the native hold, ramp and deck queries over the authored floor rows', () => {
  const builder=new ShipwreckBuilder(WRECK_SITES.world,driftwoodGroundSampler()), made=builder.build();
  try {
    // The world surrounding the vessel changes its cargo, not its floor planes. Probes sit off the rows' seams (a
    // measure-zero line); the decks' rows are the colliders' 0.25 m strips, as wide as the deck gets across each, so
    // past the rail's curve only a deck may answer where the continuous law did not.
    const {x,z,heading}=WRECK_SITES.world;
    let matched=0;
    for(let lx=-4.0013;lx<4;lx+=0.05) for(let lz=-10.0007;lz<10;lz+=0.05) {
      const wx=x+lx*Math.cos(heading)+lz*Math.sin(heading),wz=z-lx*Math.sin(heading)+lz*Math.cos(heading);
      const want=builder.floorHeightAt(wx,wz), got=floorAtRects(bake.floors,wx,wz,'first');
      if(want===undefined){ if(got!==undefined) expect(lz<-4.2||lz>5.3).toBe(true); continue; }
      expect(got).toBeCloseTo(want,9); matched++;
    }
    expect(matched).toBeGreaterThan(5000);
    expect(bake.anchors).toEqual(builder.anchors);
    expect(bake.holdBounds).toEqual(builder.holdBounds);
    expect(bake.descs).toEqual(expect.arrayContaining(builder.colliderDescs()));
  } finally { made.geometry.dispose();made.glow.dispose(); }
});
