import {expect,it,vi} from 'vitest';
import {BufferAttribute,BufferGeometry} from 'three';
import {AuthorCoverGrid} from '../src/shards/driftwood-isle/generators/coverGrid';
import {CoverGrid,coverSample} from '../src/shards/driftwood-isle/runtime/looks/coverGrid';
import {clipIslandDressing} from '../src/shards/driftwood-isle/world/islandDressing';
import {loadIslandCover} from '../src/shards/driftwood-isle/world/islandCover';
import {ISLAND_COVER_FILES} from '../src/shards/driftwood-isle/data/islandCoverFiles';

it('borrows a losslessly cropped lattice and keeps zero perimeter samples empty',()=>{
 const source=new AuthorCoverGrid();source.data.set([0.2,0.4,0.6,0.7,0.8],(60*source.n+60)*5);
 const crop=source.crop(),grid=new CoverGrid(crop.data,crop.rect),sample=coverSample();
 expect(grid.data.buffer).toBe(crop.data.buffer);expect(grid.data.byteLength).toBeLessThan(source.data.byteLength);
 grid.sample(-250+60*4,-250+60*4,sample);expect(sample.top).toBeCloseTo(0.7);expect(sample.r).toBeCloseTo(0.2);
 grid.sample(-250,-250,sample);expect(sample).toEqual({r:0,g:0,b:0,top:0,side:0});
 grid.sample(-250+60*4+2,-250+60*4,sample);expect(sample.top).toBeCloseTo(0.35);expect(sample.r).toBeCloseTo(0.2);
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
 const mocked=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('',{status:404}));
 try{await expect(loadIslandCover()).rejects.toThrow('missing');mocked.mockResolvedValue(new Response(new Uint8Array(4)));await expect(loadIslandCover()).rejects.toThrow('corrupt');mocked.mockResolvedValue(new Response(new Uint8Array(ISLAND_COVER_FILES.phone.bytes)));await expect(loadIslandCover()).rejects.toThrow('corrupt');}finally{mocked.mockRestore();}
});
