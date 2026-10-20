import { PrivateSceneSchema } from '../src/format/clientChannels';
import cragRows from '../src/shards/nalati-grasslands/boot/cragRock.generated.json';
import { lendLooks } from '../src/game/shardfile/lentLooks';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { expect, test, vi } from 'vitest';
import type { ShardContext } from '../src/game/plugin/context';
import * as THREE from 'three';
import { SceneDressing, readSceneGeometryAddress } from '../src/game/shardfile/sceneDressing';
import { Scope } from '../src/engine/app/scope';
import { WorldRegistry } from '../src/engine/world/registry';
import { zlibSync, unzlibSync } from 'fflate';
import { writeGeometry, join } from '../src/shards/nalati-grasslands/generators/geometryWriter';
import * as v from 'valibot';
import { SceneDressingSchema } from '../src/format/sceneDressing';
import { dressingScene } from '../src/shards/nalati-grasslands/generators/dressingScene';
import { isJsonData } from '../src/format/json';
import { readBakedGeometry } from '../src/game/plugin/geometry';
import prepared from '../src/shards/nalati-grasslands/data/placeRuntime.generated.json';

const wire = (input:unknown):unknown => JSON.parse(encodeCanonicalJson(input));
test('both Nalati tiers retain scatter policies, static contacts and GPU cloth buffers within JSON bounds',()=>{
  for(const tier of ['phone','desktop']as const){
    const input=wire(dressingScene(tier));expect(isJsonData(input)).toBe(true);
    const rows=v.parse(SceneDressingSchema,input);
    expect(rows.layers).toHaveLength(10);
    const crags=rows.statics.find(row=>row.name==='cragRocks'),cragMember=crags?.members[0];
    expect(crags?.recipe).toEqual(v.parse(PrivateSceneSchema,cragRows[tier].recipe));expect(cragMember?.placements).toEqual(cragRows[tier].placements);
    expect(cragMember?.boxes).toEqual(cragRows[tier].boxes);expect(cragMember?.contacts).toMatchObject({kind:'packed-hulls',surface:'rock'});
    if(cragMember!==undefined&&!Array.isArray(cragMember.contacts)){
      const raw=unzlibSync(Uint8Array.from(atob(cragMember.contacts.data),c=>c.codePointAt(0)??0));
      expect(raw).toEqual(new Uint8Array(Float32Array.from(cragRows[tier].hulls.flatMap(row=>row.points)).buffer));
    }

    expect(rows.statics.find(row=>row.name==='farHerds')?.recipe.nodes.find(node=>node.kind==='group')?.name).toBe('nalati-far-herds');
    expect(rows.statics.find(row=>row.name==='snowLotus')?.recipe.nodes.filter(node=>node.kind==='group').find(node=>node.id==='root')?.name).toBe('nalati-snow-lotus');
    expect(rows.instances.filter(row=>row.group==='farHerds').every(row=>row.name==='nalati-far-herd')).toBe(true);
    expect(rows.layers.find(row=>row.id==='nalati-dress-boulder-tall')?.select).toEqual({modulo:3,remainder:2,equal:true});
    expect(rows.layers.find(row=>row.id==='nalati-dress-stone')?.binary).toBe(true);
    expect(rows.layers.find(row=>row.id==='nalati-dress-stone')?.far).toBe(tier==='phone'?.55:1);
    for(const name of ['dressing-statics','dressing-clutter']){
      const source=prepared.places.rows.find(row=>row.name===name),actual=rows.statics.find(row=>row.name===name);
      expect(actual?.members).toHaveLength(source?.members.length ?? 0);
      expect(actual?.members.reduce((sum,member)=>sum+member.placements.length,0)).toBe(name==='dressing-statics'?51:48);
    }
    const cloth=rows.geometry['cloth'];expect(cloth?.kind).toBe('inline');
    if(cloth?.kind==='inline'){
      const raw=unzlibSync(Uint8Array.from(atob(cloth.data),c=>c.codePointAt(0)??0));
      const shape=readBakedGeometry(raw,0,cloth.row);
      expect(shape.getAttribute('aClothA').count).toBeGreaterThan(1000);
      expect(shape.getAttribute('normal').count).toBe(shape.getAttribute('position').count);
      expect(shape.getAttribute('aClothF').itemSize).toBe(2);expect(cloth.sphere?.[3]).toBeGreaterThan(100);shape.dispose();
    }
  }
});

test('an unrelated orchard declares the same dressing contract without any native owner or constructor',()=>{
  const row={name:'orchard-blooms',catalogues:[],packs:{},geometry:{},materials:{},layers:[],statics:[],animations:[],motes:{name:'petals',count:120,seed:91,look:'orchard-petals',drift:.1,driftParam:'offset',pixelParam:'pixels'}};
  expect(v.parse(SceneDressingSchema,row).motes?.count).toBe(120);
  expect(()=>v.parse(SceneDressingSchema,{...row,build:()=>null})).toThrow();
});

test('the orchard fixture constructs and retires the shared client projection',async()=>{
  const shape=new THREE.BoxGeometry(1,2,1);shape.clearGroups();
  const blocks:Uint8Array[]=[],layout=writeGeometry(shape,blocks,'orchard');shape.dispose();
  let encoded='';for(const byte of zlibSync(join(blocks)))encoded+=String.fromCodePoint(byte);
  const scope=new Scope('orchard-row-fixture'),root=new THREE.Group(),camera=new THREE.PerspectiveCamera();
  const system=vi.fn<ShardContext['system']>(),ctx={} as ShardContext;Object.assign(ctx,{system,scope,root,app:{registry:new WorldRegistry()},product:{},game:{runtime:{world:{sky:null,player:{position:new THREE.Vector3()},game:{camera}}}}});
  const rows={name:'orchard',catalogues:[],packs:{},geometry:{marker:{kind:'inline',data:btoa(encoded),row:layout}},materials:{white:{kind:'painterly',rim:.2,bands:.5}},layers:[],animations:[],statics:[{name:'gate',tris:12,members:[],geometry:{shape:'marker'},materials:{paint:'white'},recipe:{version:1,root:'root',materials:[{kind:'port',id:'paint',source:'paint'}],nodes:[{kind:'group',id:'root',children:['marker']},{kind:'mesh',id:'marker',geometry:'shape',material:'paint',missing:'empty',position:[1,2,3]}]}}]};
  const host=await SceneDressing.install(ctx,rows);expect(root.children).toContain(host.group);
  expect(host.group.getObjectByProperty('type','Mesh')?.position.toArray()).toEqual([1,2,3]);
  expect(host.stats().propTris).toBe(12);
  const frame=system.mock.calls[0]?.[0];expect(frame).toMatchObject({id:'client.scene.dressing',phase:'update',after:['main.world'],before:['engine.creatures.update']});
  if(frame===undefined)throw new Error('Missing declared dressing frame');frame.run(.1,1);
  const otherScope=new Scope('second-orchard'),otherRoot=new THREE.Group(),other={} as ShardContext;Object.assign(other,ctx,{scope:otherScope,root:otherRoot});
  const second=await SceneDressing.install(other,rows);expect(second).not.toBe(host);expect(SceneDressing.current(ctx)).toBe(host);expect(SceneDressing.current(other)).toBe(second);
  scope.dispose();expect(root.children).toHaveLength(0);expect(SceneDressing.current(other)).toBe(second);otherScope.dispose();expect(otherRoot.children).toHaveLength(0);
});


test('geometry source addresses remain binary while the JSON address word stays bounded',()=>{
  const bytes=new Uint8Array(8),view=new DataView(bytes.buffer);view.setUint32(0,17000000,true);view.setUint32(4,10000000,true);
  expect(readSceneGeometryAddress(bytes,0)).toBe(17000000);expect(readSceneGeometryAddress(bytes,1)).toBe(10000000);
  expect(()=>readSceneGeometryAddress(bytes,2)).toThrow();expect(()=>readSceneGeometryAddress(bytes,-1)).toThrow();
  for(const tier of ['phone','desktop']as const)for(const row of Object.values(dressingScene(tier).geometry))if(row.kind==='baked'){
    expect(row.address.word).toBeLessThan(1000000);expect(row.address.file).toBe(`world/dressing-addresses-${tier}.bin`);
  }
});

test('the defining dressing contract converts to the admitted named JSON schema',()=>{
  expect(namedJsonSchema(SceneDressingSchema)['type']).toBe('object');
});

test('look bindings remain declared data on an unrelated static scene',async()=>{
  const scope=new Scope('orchard-graph-rows'),root=new THREE.Group(),material=new THREE.MeshBasicMaterial(),setParam=vi.fn();
  lendLooks(scope,{materials:new Map([['orchard-paint',material]]),setParam:(...args)=>{setParam(...args);},setTexture:()=>undefined,bindMeshMap:()=>material});
  const ctx={} as ShardContext;Object.assign(ctx,{scope,root,system:vi.fn(),app:{registry:new WorldRegistry()},product:{},game:{runtime:{world:{sky:null,player:{position:new THREE.Vector3()},game:{camera:new THREE.PerspectiveCamera()}}}}});
  const host=await SceneDressing.install(ctx,{name:'orchard',catalogues:[],packs:{},geometry:{},materials:{paint:{kind:'look',look:'orchard-paint',params:{threshold:.8,tint:[.2,.4,.6]}}},layers:[],statics:[],animations:[]});
  expect(setParam.mock.calls).toEqual([['orchard-paint','threshold',.8],['orchard-paint','tint',[.2,.4,.6]]]);
  expect(SceneDressing.current(ctx)).toBe(host);scope.dispose();material.dispose();
});
