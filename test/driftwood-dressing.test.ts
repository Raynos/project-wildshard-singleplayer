import {expect,it} from 'vitest';
import {BufferAttribute,BufferGeometry} from 'three';
import {AuthorCoverGrid} from '../src/shards/driftwood-isle/generators/coverGrid';
import {clipIslandDressing,retainedIslandRuns} from '../src/shards/driftwood-isle/generators/clipDressing';

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
