import { beforeAll, expect, it } from 'vitest';
import { BufferAttribute, Mesh, type Object3D } from 'three';
import { admitBridgeFacts } from '../src/shards/driftwood-isle/boot/bridgeFacts';
import { ropeBridgeLayout, type RopeBridgeSpec } from '../src/shards/driftwood-isle/runtime/models/ropeBridge';
import { fakeWorld } from './fake/world';
import { fixedDraw } from '../src/shards/driftwood-isle/runtime/boot/blobAssets';
import { admitDriftwoodFixtureRows } from './fixtures/driftwoodRows';
import { bridgePosts, bridgeUnitGeometries } from '../src/shards/driftwood-isle/generators/ropeBridge';

import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';
import { fixtureBytes } from './fixtures/nativeBytes';
import fixedBlobs from '../src/shards/driftwood-isle/data/fixedBlobs.generated.json' with { type: 'json' };

const span:RopeBridgeSpec={a:[0,0],b:[12,0],sag:0.9};
const isMesh=(o:Object3D):o is Mesh=>o instanceof Mesh;
// The page admits the baked posts before it builds; the author recipe stands in for the fixed-model bytes here.
beforeAll(async () => { admitDriftwoodFixtureRows(); await fixedDraw('bridgeSpecimenPosts').load(bridgePosts(span,()=>0));
  const units = bridgeUnitGeometries();
  const plank = units['bridge-plank-unit'], rope = units['bridge-rope-unit'];
  if (plank === undefined || rope === undefined) throw new Error('Missing native bridge unit');
  await fixedDraw('bridgePlankUnit').load(plank); await fixedDraw('bridgeRopeUnit').load(rope);
});
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

it('draws the baked anchor posts, painted, and refuses to draw before they load', async () => {
  const want=bridgePosts(span,()=>0),bridge=ropeBridgeLayout(fakeWorld().sky,{span,ground:()=>0});
  try {
    const posts=bridge.mesh.children[0];
    if(posts===undefined||!isMesh(posts))throw new Error('Bridge posts absent');
    expect(Array.from(posts.geometry.getAttribute('position').array)).toEqual(Array.from(want.getAttribute('position').array));
    expect(Array.from(posts.geometry.getAttribute('color').array)).toEqual(Array.from(want.getAttribute('color').array));
  } finally {
    want.dispose();
    bridge.mesh.traverse(o=>{if(isMesh(o)){o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material])material.dispose();}});bridge.mesh.clear();
  }
  fixedDraw('bridgeSpecimenPosts').take().dispose();
  expect(()=>ropeBridgeLayout(fakeWorld().sky,{span,ground:()=>0})).toThrow('not loaded');
  await fixedDraw('bridgeSpecimenPosts').load(bridgePosts(span,()=>0));
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
