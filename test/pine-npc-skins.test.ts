import {expect,test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the authored GLB bake inputs in Node.
import {readFileSync} from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {bakeNpcSkin} from '../src/shards/pine-hollow/generators/npcSkin';

test('baked NPCs retain required skin channels, bone bindings and texture loans',async()=>{
  await MeshoptDecoder.ready;
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
  for(const kind of ['ranger','trader','miller'] as const)for(const tier of ['desktop','phone'] as const){
    const input=new Uint8Array(readFileSync(`public/assets/pine-hollow/npcs/${kind}${tier==='phone'?'.phone':''}.glb`));
    const made=await bakeNpcSkin(input,{id:`pine.${kind}`,lantern:kind==='ranger'});
    const doc=await io.readBinary(made.glb),primitive=doc.getRoot().listMeshes()[0]?.listPrimitives()[0];
    if(primitive===undefined)throw new Error('Missing baked NPC primitive');
    for(const semantic of ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0']){
      const array=primitive.getAttribute(semantic)?.getArray();
      if(array===null||array===undefined)throw new Error(`Missing NPC ${semantic}`);
    }
    const bones=doc.getRoot().listSkins()[0]?.listJoints()??[];
    expect(bones).toHaveLength(made.metadata.rest.length);
    expect(bones.map(bone=>bone.getExtras()['wildshard'])).toEqual(made.metadata.rest.map(bind=>({bind})));
    expect(doc.getRoot().listTextures()).toHaveLength(0); // Existing tier-aware PBR files remain texture loans.
    made.geometry.dispose();
  }
});
