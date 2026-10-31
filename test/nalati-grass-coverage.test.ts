// oxlint-disable-next-line import/no-nodejs-modules -- Assert complete numeric equivalence over independent geometric samples.
import assert from 'node:assert/strict';
import {expect,test} from 'vitest';
import {nalatiGrassCoverage} from '../src/shards/nalati-grasslands/generators/grassBake.mjs';

const groups=[['boulder',.9],['slab',1.1],['juniper',.85],['rose',.5],['willow',.4]] as const;
interface Placement {x:number;z:number;sx:number;sz:number}
function input(rows:ReadonlyMap<string,readonly Placement[]>):Map<string,Uint8Array>{
  return new Map(groups.map(([name])=>[`dressing-${name}.json`,new TextEncoder().encode(JSON.stringify(rows.get(name)??[]))]));
}

test('keep-out distance and strongest overlap survive positive and negative four-metre bucket edges',()=>{
  const rows=new Map<string,readonly Placement[]>([
    ['boulder',[{x:-4.001,z:3.999,sx:1.7,sz:1.2},{x:4.001,z:-.001,sx:.8,sz:1.4}]],
    ['slab',[{x:-.001,z:-4.001,sx:1.2,sz:1.3}]],['juniper',[{x:3.999,z:4.001,sx:.4,sz:.6}]],
    ['rose',[{x:-3.999,z:4.001,sx:1.4,sz:1.2}]],['willow',[{x:0,z:0,sx:2,sz:1},{x:-0,z:0,sx:0,sz:0}]],
  ]),before=input(rows),query=nalatiGrassCoverage(before);
  // The geometric oracle scans every clump, with no spatial bucket index.
  // These radii fit the admitted adjacent cells, so every contributing clump
  // must participate while the original distance/falloff remains bit-exact.
  const clumps=groups.flatMap(([name,scale])=>(rows.get(name)??[]).map(row=>({x:row.x,z:row.z,r:Math.max(row.sx,row.sz)*scale})));
  for(let x=-12;x<=12;x+=.125)for(let z=-12;z<=12;z+=.125){
    let expected=0;for(const clump of clumps){const distance=Math.hypot(x-clump.x,z-clump.z);
      if(distance<clump.r)expected=Math.max(expected,Math.min(1,(clump.r-distance)/(clump.r*.25)));}
    assert.equal(query(x,z),expected);
  }
  expect([...before.values()].map(bytes=>new TextDecoder().decode(bytes))).toEqual([...input(rows).values()].map(bytes=>new TextDecoder().decode(bytes)));
});

test('each coverage owner detaches source rows and later mutation or failed construction cannot alter it',()=>{
  const rows=new Map([['boulder',[{x:0,z:0,sx:1,sz:1}]]]),source=input(rows),first=nalatiGrassCoverage(source);
  expect(first(0,0)).toBe(1);expect(first(10,10)).toBe(0);
  source.get('dressing-boulder.json')?.fill(32);
  expect(first(0,0)).toBe(1);
  expect(()=>nalatiGrassCoverage(source)).toThrow();
  const other=nalatiGrassCoverage(input(new Map()));expect(other(0,0)).toBe(0);expect(first(0,0)).toBe(1);
});

test('missing native keep-out groups still refuse instead of accepting an empty coverage owner',()=>{
  for(const [name]of groups){const source=input(new Map());source.delete(`dressing-${name}.json`);
    expect(()=>nalatiGrassCoverage(source)).toThrow(`Missing native grass keep-outs: ${name}`);}
});
