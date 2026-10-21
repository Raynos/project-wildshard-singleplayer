import {expect,it,vi} from 'vitest';
import {BufferAttribute,BufferGeometry} from 'three';
import {AuthorCoverGrid} from '../src/shards/driftwood-isle/generators/coverGrid';
import {clipIslandDressing,retainedIslandRuns} from '../src/shards/driftwood-isle/generators/clipDressing';
import {loadIslandCover} from '../src/shards/driftwood-isle/world/islandCover';
import ISLAND_COVER_FILES from '../src/shards/driftwood-isle/data/islandCoverFiles.json' with { type: 'json' };
import {createShardProduct} from '../src/game/shardfile/shardProduct';
import {emptyShardfile} from '../src/sdk/author';

it('crops the lattice losslessly and keeps zero perimeter samples empty',()=>{
 const source=new AuthorCoverGrid();source.data.set([0.2,0.4,0.6,0.7,0.8],(60*source.n+60)*5);
 const crop=source.crop(),sample={r:0,g:0,b:0,top:0,side:0};
 expect(crop.rect).toEqual({x:60,z:60,width:1,height:1});expect(Array.from(crop.data)).toEqual(Array.from(new Float32Array([0.2,0.4,0.6,0.7,0.8])));
 source.sample(-250+60*4,-250+60*4,sample);expect(sample.top).toBeCloseTo(0.7);expect(sample.r).toBeCloseTo(0.2);
 source.sample(-250,-250,sample);expect(sample).toEqual({r:0,g:0,b:0,top:0,side:0});
 source.sample(-250+60*4+2,-250+60*4,sample);expect(sample.top).toBeCloseTo(0.35);expect(sample.r).toBeCloseTo(0.2);
});
it('installs retained native triangle runs and refuses a bad plan before changing geometry',()=>{
 const geometry=new BufferGeometry(),positions=new BufferAttribute(new Float32Array(18),3);geometry.setAttribute('position',positions);
 const plan={vertices:6,indices:0,output:3,runs:[{start:3,count:3}]};
 try{
  expect(()=>clipIslandDressing(geometry,{...plan,runs:[{start:6,count:3}]})).toThrow('corrupt');expect(geometry.getIndex()).toBeNull();
  clipIslandDressing(geometry,plan);expect(geometry.getAttribute('position')).toBe(positions);expect(Array.from(geometry.getIndex()?.array??[])).toEqual([3,4,5]);
  expect(()=>clipIslandDressing(geometry,plan)).toThrow('differs');
 }finally{geometry.dispose();}
});
it('refuses a missing or damaged required cover file through the world loader',async()=>{
 const read=vi.fn<()=>Promise<Uint8Array>>().mockRejectedValue(new Error('Required cover is missing'));
 const product=createShardProduct({slug:'driftwood-isle',revision:1,
  shardfile:emptyShardfile({slug:'driftwood-isle',name:'Test',author:'Test',revision:1,seed:1}),
  sections:new Map<string,unknown>([['custom/assets',{byUrl:Object.fromEntries(Object.values(ISLAND_COVER_FILES).map(file=>[file.url,'world/cover.bin']))}],
    ['custom/fixedLayouts',{coverFiles:ISLAND_COVER_FILES}]]),
  files:new Map([['world/cover.bin',{hash:ISLAND_COVER_FILES.phone.hash,url:'/checked/cover.bin'}]]),read,check:true});
 await expect(loadIslandCover(product)).rejects.toThrow('missing');
 read.mockResolvedValue(new Uint8Array(4));await expect(loadIslandCover(product)).rejects.toThrow('corrupt');
 read.mockResolvedValue(new Uint8Array(ISLAND_COVER_FILES.phone.bytes));await expect(loadIslandCover(product)).rejects.toThrow('corrupt');
});

it('compiles source triangle runs before the dressing table exists', () => {
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([
    -3, 0, 0, -2, 0, 1, -1, 0, 0, 1, 0, 0, 2, 0, 1, 3, 0, 0,
  ]), 3)).setIndex([0, 1, 2, 3, 4, 5]);
  try {
    const plan = retainedIslandRuns(geometry, x => x > 0);
    expect(plan).toEqual({ vertices: 6, indices: 6, output: 3, runs: [{ start: 3, count: 3 }] });
    clipIslandDressing(geometry, plan);
    expect(Array.from(geometry.getIndex()?.array ?? [])).toEqual([3, 4, 5]);
  } finally { geometry.dispose(); }
});
