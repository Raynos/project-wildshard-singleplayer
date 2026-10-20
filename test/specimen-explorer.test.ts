import {expect,test,vi} from 'vitest';
import * as THREE from 'three';
import {zlibSync} from 'fflate';
import {createShardProduct} from '../src/game/shardfile/shardProduct';
import {explorerRoster} from '../src/game/models/explorerCatalogue';
import {emptyShardfile} from '../src/sdk/author';
import {nameBlob,emitNamedBlobs} from '../src/sdk/blobs';
import {namedJsonSchema} from '../src/sdk/formatJsonSchema';
import {SpecimenBookSchema} from '../src/format/specimenCatalogue';
import {parseExplorerCatalogue} from '../src/format/explorerCatalogue';
import {initializeTier,TIER} from '../src/engine/core/tier';
import {WorldRegistry} from '../src/engine/world/registry';
import {modelContext} from '../src/engine/models/model';
import {SkyRig} from '../src/engine/world/skyRig';

function fixture(){
  const vertices=Float32Array.from([0,0,0,1,0,0,0,1,0]);let data='';for(const byte of zlibSync(new Uint8Array(vertices.buffer)))data+=String.fromCodePoint(byte);
  const book={rows:[{key:'leaf',model:{id:'orchard/leaf',name:'Pear leaf',file:'orchard.json',category:'nature',pipeline:'code',defaults:{}},source:{kind:'inline',data:btoa(data),geometry:{attrs:[['position','f32',3,false]],count:3,index:null,indexCount:0,box:false,expand:false},material:{id:'orchard-leaf',family:'painterly'}}}],packed:{bin:'/assets/orchard/empty.bin',bytes:0,rows:[]},materials:{}};
  const declared=emitNamedBlobs([nameBlob('models/leaves.json','json',new TextEncoder().encode(JSON.stringify(book)),{jsonSchema:namedJsonSchema(SpecimenBookSchema)})]);
  const catalogue=parseExplorerCatalogue({version:1,entries:[{kind:'specimen',books:{phone:'models/leaves.json',desktop:'models/leaves.json'},model:'leaf',tierCopies:{phone:7,desktop:18},drawnAs:'instanced'}]});
  return createShardProduct({slug:'orchard',revision:1,shardfile:emptyShardfile({slug:'orchard',name:'Orchard',author:'Fixture',revision:1,seed:7}),sections:new Map([['explore/catalogue',catalogue]]),files:new Map(declared.files.flatMap(row=>row.name===undefined?[]:[[row.name,{hash:row.hash,url:row.hash,...(row.jsonSchema===undefined?{}:{jsonSchema:row.jsonSchema})}]])),read:hash=>{const bytes=declared.assets.get(hash);if(bytes===undefined)throw new Error('Missing leaf book');return Promise.resolve(bytes);},check:true});
}

test('an unrelated shard lists and builds its cold specimen book at both tiers',async()=>{
  const previous=TIER;
  try{
    for(const tier of ['phone','desktop']as const){
      initializeTier(tier);const product=fixture(),entries=await explorerRoster(product),registry=new WorldRegistry();
      const sky:unknown=Object.create(SkyRig.prototype);if(!(sky instanceof SkyRig))throw new Error('Missing sky');
      Object.assign(sky,{csm:{lights:[]},sunDir:new THREE.Vector3(0,1,0)});vi.spyOn(sky,'setupMaterial').mockImplementation(()=>undefined);
      const entry=entries[0];if(entry===undefined)throw new Error('Missing leaf card');entry.list(modelContext(sky),()=>[],registry);
      const card=registry.models()[0];expect(card).toMatchObject({id:'orchard/leaf',name:'Pear leaf',copies:tier==='phone'?7:18,drawnAs:'instanced'});
      const object=card?.object(),mesh=object?.getObjectByProperty('type','Mesh');if(!(mesh instanceof THREE.Mesh))throw new Error('Missing leaf specimen');
      const geometry:unknown=mesh.geometry;if(!(geometry instanceof THREE.BufferGeometry))throw new Error('Missing leaf shape');const position:unknown=geometry.getAttribute('position');if(!(position instanceof THREE.BufferAttribute))throw new Error('Missing leaf positions');expect(position.count).toBe(3);geometry.dispose();
    }
    const product=fixture();vi.spyOn(product,'json').mockResolvedValue({rows:[]});await expect(explorerRoster(product)).rejects.toMatchObject({item:'explore/catalogue',reason:'schema'});
  }finally{initializeTier(previous);vi.restoreAllMocks();}
});
