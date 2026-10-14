import { expect, it } from 'vitest';
import { Mesh, type Object3D } from 'three';
import { admitBridgeFacts } from '../src/shards/driftwood-isle/boot/bridgeFacts';
import { ropeBridgeLayout, type RopeBridgeSpec } from '../src/shards/driftwood-isle/models/ropeBridge';
import { fakeWorld } from './fake/world';

const span:RopeBridgeSpec={a:[0,0],b:[12,0],sag:0.9};
const isMesh=(o:Object3D):o is Mesh=>o instanceof Mesh;
it('keeps deck owners and the walk floor on the live chain poses', () => {
  const bridge=ropeBridgeLayout(fakeWorld().sky,{span,ground:()=>0});
  try {
    const chain=bridge.chainSpec(),rest=bridge.floorHeightAt(6,0);
    if(rest===undefined)throw new Error('Bridge floor absent');
    expect(chain.owners.length).toBe(chain.segments.length);
    const first=chain.owners[0];
    if(first===undefined)throw new Error('Bridge has no segment owners');
    const y=first.follows.position.y;
    bridge.setPoses({pose:(i,_alpha,p,q)=>{
      const segment=chain.segments[i];if(segment===undefined)throw new Error('Missing live segment');
      p.x=segment.x;p.y=segment.y+0.5;p.z=segment.z;
      q.x=segment.rot.x;q.y=segment.rot.y;q.z=segment.rot.z;q.w=segment.rot.w;
    }},1);
    expect(first.follows.position.y-y).toBeCloseTo(0.5);
    expect((bridge.floorHeightAt(6,0)??0)-rest).toBeCloseTo(0.5);
    expect(bridge.floorHeightAt(100,100)).toBeUndefined();
    expect(bridge.mesh.children.some(o=>o instanceof Mesh)).toBe(true);
  } finally {
    bridge.mesh.traverse(o=>{if(isMesh(o)){o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material])material.dispose();}});
    bridge.mesh.clear();
  }
});

it('returns independent static descriptors and refuses an unbaked site', () => {
  const bridge=ropeBridgeLayout(fakeWorld().sky,{span,ground:()=>0});
  const a=bridge.deckDescs(),b=bridge.deckDescs();
  const first=a[0],second=b[0];
  if(first?.kind!=='box'||second?.kind!=='box')throw new Error('Bridge rest slab absent');
  const x=second.x;first.x+=1;expect(second.x).toBe(x);
  expect(()=>admitBridgeFacts({...span,width:3},()=>0)).toThrow('Unbaked');
  expect(()=>admitBridgeFacts(span,()=>1)).toThrow('terrain changed');
  bridge.mesh.traverse(o=>{if(isMesh(o)){o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material])material.dispose();}});bridge.mesh.clear();
});
