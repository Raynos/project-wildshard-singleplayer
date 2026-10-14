import { expect, it } from 'vitest';
import { driftwoodGroundSampler } from '../src/shards/driftwood-isle/generators/groundSampling';
import { ShipwreckBuilder } from '../src/shards/driftwood-isle/generators/shipwreck';
import { wreckSiteKind } from '../src/shards/driftwood-isle/models/shipwreck';
import { wreckFloorHeight } from '../src/shards/driftwood-isle/world/wreckFloor';
import { WRECK_SITES } from '../src/shards/driftwood-isle/data/wreckSites';
import bake from '../src/shards/driftwood-isle/data/wreckBake.json' with { type: 'json' };

it('admits the authored world wreck and Explorer specimen, refusing an unbaked site', () => {
  expect(wreckSiteKind(WRECK_SITES.world)).toBe('world');
  expect(wreckSiteKind(WRECK_SITES.specimen)).toBe('specimen');
  expect(() => wreckSiteKind({...WRECK_SITES.world,x:WRECK_SITES.world.x+1})).toThrow('authored geometry');
  expect(() => wreckSiteKind({...WRECK_SITES.specimen,roll:0})).toThrow('authored geometry');
});

it('keeps the native hold, ramp and deck queries over the authored floor rows', () => {
  const builder=new ShipwreckBuilder(WRECK_SITES.world,driftwoodGroundSampler()), made=builder.build();
  try {
    // The world surrounding the vessel changes its cargo, not its floor planes.
    for(const [lx,lz] of [[0,0],[-1,-3],[0,-6],[0,7],[3,-1],[20,20]]) {
      if(lx===undefined||lz===undefined)throw new Error('Incomplete floor probe');
      const {x,z,heading}=WRECK_SITES.world;
      const wx=x+lx*Math.cos(heading)+lz*Math.sin(heading),wz=z-lx*Math.sin(heading)+lz*Math.cos(heading);
      expect(wreckFloorHeight(bake.floor,wx,wz)).toBe(builder.floorHeightAt(wx,wz));
    }
    expect(bake.anchors).toEqual(builder.anchors);
    expect(bake.holdBounds).toEqual(builder.holdBounds);
    expect(bake.descs).toEqual(expect.arrayContaining(builder.colliderDescs()));
  } finally { made.geometry.dispose();made.glow.dispose(); }
});
