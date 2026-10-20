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
import { PINE_TREE_SET } from '../src/shards/pine-hollow/generators/treeSet';
import rows from '../src/shards/pine-hollow/data/treeRest.generated.json';

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
