import { expect, it } from 'vitest';
import { ShrineBuilder } from '../src/shards/driftwood-isle/generators/shrine';
import { driftwoodGroundSampler } from '../src/shards/driftwood-isle/generators/groundSampling';
import { shrineLayout, shrineOrigin, shrineSiteKind } from '../src/shards/driftwood-isle/models/shrine';
import { SHRINE_SITES } from '../src/shards/driftwood-isle/data/shrineSites';

it('admits the authored knoll and flat Explorer shrine, refusing other sites', () => {
  expect(shrineSiteKind(SHRINE_SITES.world)).toBe('world');
  expect(shrineSiteKind(SHRINE_SITES.specimen)).toBe('specimen');
  expect(()=>shrineSiteKind({...SHRINE_SITES.world,rot:0})).toThrow('authored geometry');
});

it('keeps the native stair, terraces, pool causeway and independent collision owners', () => {
  for(const kind of ['world','specimen'] as const){
    const site=SHRINE_SITES[kind],ground=kind==='world'?driftwoodGroundSampler():()=>0;
    const params={site,ground},author=new ShrineBuilder(params).build(),layout=shrineLayout(params);
    try {
      // JSON has one zero rotation; the specimen author may produce -0.
      const colliders=author.colliders.map(c=>({...c,rot:c.rot===0?0:c.rot}));
      expect(layout.colliders).toEqual(colliders);
      expect(layout.colliderDescs()).toEqual(author.colliderDescs());
      expect(layout.anchors).toEqual(author.anchors);
      expect(shrineOrigin(params)).toEqual({x:site.x,y:Math.fround(ground(site.x,site.z)),z:site.z});
      for(const [x,z] of [[0,0],[0,3],[0,7],[0,11],[3,-5],[20,20]]){
        if(x===undefined||z===undefined)throw new Error('Incomplete floor probe');
        expect(layout.floorHeightAt(x,z)).toBe(author.floorHeightAt(x,z));
      }
      const other=shrineLayout(params);layout.colliders.length=0;
      expect(other.colliders).toEqual(colliders);
    } finally {for(const geometry of Object.values(author.geometry??{}))geometry.dispose();}
  }
});
