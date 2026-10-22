import {expect,test} from 'vitest';
import {unzlibSync} from 'fflate';
import {readBakedGeometry} from '../src/game/plugin/geometry';
import {reinsCard} from '../src/shards/nalati-grasslands/generators/reinsCard';
import reins from '../src/shards/nalati-grasslands/data/reins.json' with {type:'json'};

test('the reins card bakes both straps, double-faced, standing on y 0',()=>{
  const row=reinsCard().rows[0];if(row?.source.kind!=='inline')throw new Error('Missing inline reins');
  const strap=(reins.span*3+1)*2;
  expect(row.source.geometry).toMatchObject({count:2*strap,indexCount:2*reins.span*3*6});
  expect(row.source.material).toMatchObject({family:'painterly',rim:reins.paint.rim,bands:reins.paint.bands,side:'double'});
  const geometry=readBakedGeometry(unzlibSync(Uint8Array.from(atob(row.source.data),c=>c.codePointAt(0)??0)),0,row.source.geometry);
  geometry.computeBoundingBox();const box=geometry.boundingBox;if(box===null)throw new Error('Missing reins bounds');
  expect(box.min.y).toBeCloseTo(0,5);expect(box.min.x+box.max.x).toBeCloseTo(0,5);expect(box.max.z-box.min.z).toBeGreaterThan(.5);
  geometry.dispose();
});
