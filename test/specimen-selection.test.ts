import { parse } from 'valibot';
import { SpecimenAssetSchema } from '../src/format/specimenCatalogue';
import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { staticGlb } from '../src/sdk/bake/glb';
import { Rng } from '../src/engine/core/rng';
import { modelContext, paramsOf } from '../src/engine/models/model';
import { SkyRig } from '../src/engine/world/skyRig';
import { defineSpecimenCatalogue, loadBoundSpecimen, awaitSpecimenAssets } from '../src/game/models/specimenCatalogue';
import { balbal } from '../src/shards/nalati-grasslands/models/balbal';
import rows from '../src/shards/nalati-grasslands/boot/balbalSpecimen.generated.json' with {type:'json'};

function skyFixture():SkyRig{
  const sky:unknown=Object.create(SkyRig.prototype);
  if(!(sky instanceof SkyRig))throw new Error('Missing fixture sky');
  Reflect.set(sky,'csm',{lights:[]});Reflect.set(sky,'sunDir',new THREE.Vector3(0,1,0));
  vi.spyOn(sky,'setupMaterial').mockImplementation(()=>undefined);return sky;
}

test('parameter rows select both carved copies and refuse unauthored shapes',()=>{
  const sky=skyFixture(),context=modelContext(sky);
  try{
    expect(balbal.variants?.map(row=>row.id)).toEqual(['generated','bare','capped']);
    for(const id of ['bare','capped']){
      const params=paramsOf(balbal,id,undefined),built=balbal.build(context,params,new Rng(1));
      if(!(built instanceof THREE.Group))throw new Error('Missing carving');
      const mesh=built.children[0];if(!(mesh instanceof THREE.Mesh))throw new Error('Missing carving mesh');
      const shape:unknown=mesh.geometry;if(!(shape instanceof THREE.BufferGeometry))throw new Error('Missing carving geometry');
      const position:unknown=shape.getAttribute('position');if(!(position instanceof THREE.BufferAttribute))throw new Error('Missing carving position');
      expect(position.count).toBeGreaterThan(20);
      expect(mesh.castShadow&&mesh.receiveShadow).toBe(true);
      shape.dispose();
    }
    const orchard=defineSpecimenCatalogue<{crate:{stored:boolean}}>([{...rows.catalogue[0],key:'crate',model:{id:'orchard/crate',name:'Harvest crate',category:'props',pipeline:'code',file:'orchard.json',defaults:{stored:true}},
      source:{kind:'selection',variants:[{params:{stored:true},source:rows.catalogue[0]?.source.kind==='selection'?rows.catalogue[0].source.variants[1]?.source:undefined}]}}]).model('crate');
    expect(orchard.build(context,{stored:true},new Rng(1))).toBeInstanceOf(THREE.Group);
    expect(()=>orchard.build(context,{stored:false},new Rng(1))).toThrow('No authored specimen');
  }finally{vi.restoreAllMocks();}
});

test('fitted assets share the source loan without mutating it or leaking transforms into other variants',async()=>{
  const geometry=new THREE.BoxGeometry(1,2,3),material=new THREE.MeshStandardMaterial(),bytes=staticGlb([{name:'fruit',geometry,material}]);
  const gltf=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,''),load=vi.spyOn(GLTFLoader.prototype,'loadAsync').mockResolvedValue(gltf),sky=skyFixture();
  const {retainedAttribute:_retained,transform:_transform,...source}=rows.generated;
  const asset=parse(SpecimenAssetSchema,{...source,url:'/assets/orchard/fruit.glb',phoneUrl:'/assets/orchard/fruit.glb'});
  try{
    const base=await loadBoundSpecimen(sky,asset),fitted=await loadBoundSpecimen(sky,{...asset,transform:{yaw:Math.PI/2,scale:3}});
    const expected=base.geometry.clone().rotateY(Math.PI/2).scale(3,3,3);
    expect(fitted.geometry.getAttribute('position').array).toEqual(expected.getAttribute('position').array);
    expect(fitted.geometry).not.toBe(base.geometry);expect(fitted.material).toBe(base.material);
    expect((await loadBoundSpecimen(sky,asset)).geometry).toBe(base.geometry);expect(load).toHaveBeenCalledOnce();
    const catalogue=defineSpecimenCatalogue<{fruit:object}>([{key:'fruit',model:{id:'orchard/fruit',name:'Fruit',category:'props',pipeline:'code',file:'orchard.json',defaults:{}},source:{kind:'asset',asset:{...asset,transform:{yaw:Math.PI/2,scale:3}}}}]);
    const built=catalogue.model('fruit').build(modelContext(sky),{},new Rng(1));await awaitSpecimenAssets(sky);await Promise.resolve();
    if(!(built instanceof THREE.Group))throw new Error('Missing asset specimen');
    const mesh=built.children[0];if(!(mesh instanceof THREE.Mesh))throw new Error('Missing fitted specimen');
    expect(mesh.geometry).toBe(fitted.geometry);expected.dispose();
  }finally{vi.restoreAllMocks();geometry.dispose();material.dispose();}
});
