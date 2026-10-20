import { beforeAll, expect, it } from 'vitest';
import { BufferAttribute, Mesh, SkinnedMesh, type Object3D } from 'three';
import { admitBridgeFacts } from '../src/shards/driftwood-isle/boot/bridgeFacts';
import { ropeBridgeLayout, type RopeBridgeSpec } from '../src/shards/driftwood-isle/runtime/models/ropeBridge';
import { fakeWorld } from './fake/world';
import { fixedDraw } from '../src/shards/driftwood-isle/runtime/boot/blobAssets';
import { admitDriftwoodFixtureRows } from './fixtures/driftwoodRows';
import { bridgeDeck, bridgeUnitGeometries } from '../src/shards/driftwood-isle/generators/ropeBridge';

import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';
import { fixtureBytes } from './fixtures/nativeBytes';
import fixedBlobs from '../src/shards/driftwood-isle/data/fixedBlobs.generated.json' with { type: 'json' };

const span:RopeBridgeSpec={a:[0,0],b:[12,0],sag:0.9};
const isMesh=(o:Object3D):o is Mesh=>o instanceof Mesh;
const isSkinned=(o:Object3D):o is SkinnedMesh=>o instanceof SkinnedMesh;
// The page admits the baked deck before it builds; the author recipe stands in for the fixed-model bytes here.
beforeAll(async () => { admitDriftwoodFixtureRows(); await fixedDraw('bridgeSpecimenDeck').load(bridgeDeck(span,()=>0)); });
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

it('refuses an unbaked site', () => {
  expect(()=>admitBridgeFacts({...span,width:3},()=>0)).toThrow('Unbaked');
  expect(()=>admitBridgeFacts(span,()=>1)).toThrow('terrain changed');
});

it('draws the baked deck skinned to its segments, and refuses to draw before it loads', async () => {
  const want=bridgeDeck(span,()=>0),bridge=ropeBridgeLayout(fakeWorld().sky,{span,ground:()=>0});
  try {
    const deck=bridge.mesh.children.find(isSkinned);
    if(deck===undefined)throw new Error('Bridge deck absent');
    expect(deck.skeleton.bones.length).toBe(bridge.chainSpec().segments.length+1);
    for(const key of ['position','color','skinWeight'])expect(Array.from(deck.geometry.getAttribute(key).array)).toEqual(Array.from(want.getAttribute(key).array));
    expect(deck.geometry.getAttribute('skinIndex').array).toBeInstanceOf(Uint16Array);
  } finally {
    want.dispose();
    bridge.mesh.traverse(o=>{if(isMesh(o)){o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material])material.dispose();}});bridge.mesh.clear();
  }
  fixedDraw('bridgeSpecimenDeck').take().dispose();
  expect(()=>ropeBridgeLayout(fakeWorld().sky,{span,ground:()=>0})).toThrow('not loaded');
  await fixedDraw('bridgeSpecimenDeck').load(bridgeDeck(span,()=>0));
});

it('retains original native bridge units in named GLBs', async () => {
  for (const [name, expected] of Object.entries(bridgeUnitGeometries())) {
    const row = fixedBlobs.blobs.find(blob => blob.name === `models/fixed/${name}.glb`);
    if (row === undefined) throw new Error('Missing native bridge unit blob');
    const intake = createOwnedGeometry(row.name); await intake.load(fixtureBytes(new URL(`../src/shards/driftwood-isle/${row.source}`, import.meta.url)));
    const actual = intake.take();
    try {
      expect(Object.keys(actual.attributes).sort()).toEqual(Object.keys(expected.attributes).sort());
      for (const key of Object.keys(expected.attributes)) {
        const a = actual.getAttribute(key), b = expected.getAttribute(key);
        if (!(a instanceof BufferAttribute) || !(b instanceof BufferAttribute)) throw new Error('Missing native bridge channel');
        expect(a.array.constructor).toBe(b.array.constructor); expect(a.array).toEqual(b.array);
      }
      expect(actual.index?.array.constructor).toBe(expected.index?.array.constructor); expect(actual.index?.array).toEqual(expected.index?.array);
    } finally { actual.dispose(); expected.dispose(); }
  }
});
