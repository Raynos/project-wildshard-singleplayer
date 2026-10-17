import { beforeAll, expect, it } from 'vitest';
import { admitDriftwoodFixtureRows } from './fixtures/driftwoodRows';
import { ShrineBuilder } from '../src/shards/driftwood-isle/generators/shrine';
import { driftwoodGroundSampler } from '../src/shards/driftwood-isle/generators/groundSampling';
import specimens from '../src/shards/driftwood-isle/boot/modelCatalogue.generated.json' with { type: 'json' };
import { parseWorldSceneModels } from '../src/format/worldSceneModels';
import { floorAtRects } from '../src/engine/physics/box';
import SHRINE_SITES from '../src/shards/driftwood-isle/data/shrineSites.json' with { type: 'json' };

const catalogue = specimens.siteCatalogue;

beforeAll(admitDriftwoodFixtureRows);

it('declares the knoll and flat Explorer shrine without executable parameters', () => {
  const rows = parseWorldSceneModels(catalogue), shrine = rows.models.find(row => row.key === 'shrine');
  expect(shrine?.choices.map(row => row.params)).toEqual([{ site: SHRINE_SITES.world }, { site: SHRINE_SITES.specimen }]);
  expect(() => parseWorldSceneModels({ ...catalogue, callback: () => 0 })).toThrow();
});

it('keeps the native stair, terraces, pool causeway and independent collision owners', () => {
  for(const kind of ['world','specimen'] as const){
    const site=SHRINE_SITES[kind],ground=kind==='world'?driftwoodGroundSampler():()=>0;
    const params={site,ground},author=new ShrineBuilder(params).build(),choice=parseWorldSceneModels(catalogue).models.find(row=>row.key==='shrine')?.choices.find(row=>row.id===kind),layout=choice?.site;
    if(layout===undefined)throw new Error('Missing shrine site');
    const {origin}=layout;
    try {
      // JSON has one zero rotation; the specimen author may produce -0.
      const colliders=author.colliders.map(c=>({...c,rot:c.rot===0?0:c.rot}));
      expect(layout.colliders).toEqual(colliders);
      expect(layout.anchors).toEqual(author.anchors);
      expect(origin).toEqual({x:site.x,y:Math.fround(ground(site.x,site.z)),z:site.z});
      for(const [x,z] of [[0,0],[0,3],[0,7],[0,11],[3,-5],[20,20]]){
        if(x===undefined||z===undefined)throw new Error('Incomplete floor probe');
        expect(floorAtRects(layout.floors,x,z,'first')).toBe(floorAtRects(author.floors(),x,z,'first'));
      }
      const other=parseWorldSceneModels(catalogue).models.find(row=>row.key==='shrine')?.choices.find(row=>row.id===kind)?.site;
      if(other===undefined)throw new Error('Missing independent shrine site');
      expect(other.colliders).toEqual(colliders);expect(other.colliders).not.toBe(layout.colliders);
    } finally {for(const geometry of Object.values(author.geometry??{}))geometry.dispose();}
  }
});
