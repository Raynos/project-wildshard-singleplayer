import {expect,test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Hash the released offline vertex/weight bytes.
import {createHash} from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the authored GLB bake inputs in Node.
import {readFileSync} from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {bakeNpcSkin} from '../src/shards/pine-hollow/generators/npcSkin';
import oracle from './fixtures/pine-npc-skins.json';

const sha=(bytes:Uint8Array):string=>createHash('sha256').update(bytes).digest('hex');
/** Released runtime fitter at b34ce1002, before its removal. This oracle covers
 * every vertex/weight, not a skeleton inferred from the new author implementation. */
test('bakes every released NPC hull and skin channel without fitting at runtime',async()=>{
  await MeshoptDecoder.ready;
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
  for(const kind of ['ranger','trader','miller'] as const)for(const tier of ['desktop','phone'] as const){
    const input=new Uint8Array(readFileSync(`public/assets/pine-hollow/npcs/${kind}${tier==='phone'?'.phone':''}.glb`));
    const made=await bakeNpcSkin(input,{id:`pine.${kind}`,lantern:kind==='ranger'});
    const doc=await io.readBinary(made.glb),primitive=doc.getRoot().listMeshes()[0]?.listPrimitives()[0];
    if(primitive===undefined)throw new Error('Missing baked NPC primitive');
    const expected=oracle[`${kind}/${tier}`];
    for(const [name,semantic] of [['position','POSITION'],['normal','NORMAL'],['uv','TEXCOORD_0'],['skinIndex','JOINTS_0'],['skinWeight','WEIGHTS_0']] as const){
      const array=primitive.getAttribute(semantic)?.getArray();
      if(array===null||array===undefined)throw new Error(`Missing NPC ${semantic}`);
      expect(sha(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)),`${kind}/${tier}/${name}`).toBe(expected[name].sha256);
    }
    const bones=doc.getRoot().listSkins()[0]?.listJoints()??[];
    expect(bones).toHaveLength(made.metadata.rest.length);
    expect(bones.map(bone=>bone.getExtras()['wildshard'])).toEqual(made.metadata.rest.map(bind=>({bind})));
    expect(doc.getRoot().listTextures()).toHaveLength(0); // Existing tier-aware PBR files remain texture loans.
    made.geometry.dispose();
  }
});
