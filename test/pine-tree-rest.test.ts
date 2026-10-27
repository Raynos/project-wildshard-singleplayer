// oxlint-disable-next-line import/no-nodejs-modules -- Compare the retained source GLB with its authored rest streams.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exact byte views compare retained geometry without numeric copies.
import { Buffer } from 'node:buffer';
import { afterEach, expect, it, vi } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bakeTreeRest } from '../src/shards/pine-hollow/generators/treeRest';
import { loadTreeSetGeometry } from '../src/engine/world/forest/treeSet';
import { readSourceModel } from '../src/sdk/bake/skinned';
import { createModelLibrary } from '../src/game/plugin/geometry';
import { PINE_TREE_SET, pineTreeRestRows } from '../src/shards/pine-hollow/generators/treeSet';

const rows = pineTreeRestRows();

afterEach(()=>{vi.restoreAllMocks();});
it('bakes every original tree part and borrows its exact graph channels and bounds',async()=>{
  const bytes=readFileSync('public/assets/models/pine-hollow-trees/trees.glb');
  const source = await readSourceModel(bytes);
  vi.spyOn(GLTFLoader.prototype,'loadAsync').mockResolvedValue(source.gltf);
  const [original,baked]=await Promise.all([loadTreeSetGeometry('http://tree-proof.local/trees.glb',PINE_TREE_SET),bakeTreeRest(bytes,PINE_TREE_SET)]);
  const parsed=await readSourceModel(baked);
  const library=createModelLibrary<never,never>({meshes:[],meshUrls:{},hd:[],hdUrls:{},hdLooks:{},aoFloor:1,geometryPools:[{url:'rest',parts:rows.parts,channels:rows.channels}]},'test',{},()=>Promise.resolve({scene:parsed.gltf.scene}));
  await library.preload();let count=0;
  for(const [name,parts]of original)for(const [part,geometry]of Object.entries(parts)){
    const rest=library.geometry(`${name}__${part}`,{borrow:true});if(rest===null)throw new Error('Missing authored rest part');
    for(const [key,attribute]of Object.entries(geometry.attributes)){
      const channel=rest.getAttribute(key==='windWeight'?'aWindWeight':key==='barkLayer'?'aBarkLayer':key);
      expect(channel.itemSize).toBe(attribute.itemSize);expect(channel.array.constructor).toBe(attribute.array.constructor);
      expect(Buffer.from(channel.array.buffer,channel.array.byteOffset,channel.array.byteLength).equals(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength))).toBe(true);
    }
    expect(rest.index?.array.constructor).toBe(geometry.index?.array.constructor);
    const expected=geometry.index?.array,actual=rest.index?.array;if(expected===undefined||actual===undefined)throw new Error('Missing original tree index');
    expect(Buffer.from(actual.buffer,actual.byteOffset,actual.byteLength).equals(Buffer.from(expected.buffer,expected.byteOffset,expected.byteLength))).toBe(true);
    expect(rest.boundingBox).toEqual(geometry.boundingBox);expect(rest.boundingSphere).toEqual(geometry.boundingSphere);count++;
  }
  expect(count).toBe(84);
});

// iPhone downloads I2: the product ships the pool through compactPhoneGlb `each` (sourceOutput.ts), every named shape on its
// own 16-bit grid. Read through the same rest pool, each part keeps its index, bounds and every other channel bit for bit;
// its positions lie within half its node's grid step, its normals within one Int8 step (the intake renormalizes the
// decoded normal under the node's matrix), its colours within half a Uint8 step.
it('the shipped rest pool reads every part back within its storage step',async()=>{
  const { compactPhoneGlb } = await import('../src/sdk/bake/compactGlb');
  const bytes=readFileSync('public/assets/models/pine-hollow-trees/trees.glb');
  const source = await readSourceModel(bytes);
  vi.spyOn(GLTFLoader.prototype,'loadAsync').mockResolvedValue(source.gltf);
  const [original,baked]=await Promise.all([loadTreeSetGeometry('http://tree-proof.local/trees.glb',PINE_TREE_SET),bakeTreeRest(bytes,PINE_TREE_SET)]);
  const shipped=await compactPhoneGlb(baked,{each:true});
  expect(shipped).not.toBe(baked);
  const json=JSON.parse(new TextDecoder().decode(shipped.subarray(20,20+new DataView(shipped.buffer,shipped.byteOffset).getUint32(12,true)))) as {nodes:{name:string;scale?:number[]}[]};
  const steps=new Map(json.nodes.map(node=>[node.name,(node.scale?.[0]??0)/32767]));
  const parsed=await readSourceModel(shipped);
  const library=createModelLibrary<never,never>({meshes:[],meshUrls:{},hd:[],hdUrls:{},hdLooks:{},aoFloor:1,geometryPools:[{url:'rest',parts:rows.parts,channels:rows.channels}]},'test',{},()=>Promise.resolve({scene:parsed.gltf.scene}));
  await library.preload();let count=0,worst=0;
  for(const [name,parts]of original)for(const [part,geometry]of Object.entries(parts)){
    const rest=library.geometry(`${name}__${part}`,{borrow:true});if(rest===null)throw new Error('Missing shipped rest part');
    const step=steps.get(`${name}__${part}`)??0;expect(step).toBeGreaterThan(0);
    for(const [key,attribute]of Object.entries(geometry.attributes)){
      const channel=rest.getAttribute(key==='windWeight'?'aWindWeight':key==='barkLayer'?'aBarkLayer':key);
      expect(channel.itemSize).toBe(attribute.itemSize);expect(channel.count).toBe(attribute.count);
      const tolerance=key==='position'?step/2+1e-6:key==='normal'?1/127+1e-6:key==='color'?0.5/255+1e-6:0;
      let off=0;for(let i=0;i<attribute.count;i++)for(let c=0;c<attribute.itemSize;c++)off=Math.max(off,Math.abs(channel.getComponent(i,c)-attribute.getComponent(i,c)));
      expect(off,`${name}__${part}.${key}`).toBeLessThanOrEqual(tolerance);if(key==='position')worst=Math.max(worst,off);
    }
    const expected=geometry.index?.array,actual=rest.index?.array;if(expected===undefined||actual===undefined)throw new Error('Missing original tree index');
    expect(Array.from(actual)).toEqual(Array.from(expected));
    expect(rest.boundingBox).toEqual(geometry.boundingBox);expect(rest.boundingSphere).toEqual(geometry.boundingSphere);count++;
  }
  expect(count).toBe(84);expect(worst).toBeLessThan(5e-4);
});
