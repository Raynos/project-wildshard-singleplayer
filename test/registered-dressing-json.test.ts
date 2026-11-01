import {expect,test} from 'vitest';
import {SceneDressingSchema} from '../src/format/sceneDressing';
import {registeredJsonContract,validateRegisteredJson} from '../src/format/registeredJson';
import {registeredJsonSchema,namedJsonSchema} from '../src/sdk/formatJsonSchema';
import {nameBlob} from '../src/sdk/blobs';
import {encodeCanonicalJson,hashImmutableBytes} from '../src/sdk/immutable';
import {createShardProduct} from '../src/game/shardfile/shardProduct';
import {emptyShardfile} from '../src/sdk/author';
import {fixtureJsonCheck} from './fixtures/productFile';

const name='world/dressing-phone.json';
const value={name:'registered-dressing',catalogues:[],packs:{},geometry:{},materials:{},layers:[],statics:[],animations:[]};
const bytes=new TextEncoder().encode(encodeCanonicalJson(value));
const identity={slug:'dressing-native-contract',name:'Dressing',author:'Fixture',revision:1,seed:1};

test('phone dressing keeps its complete defining native contract and raw wire defaults',()=>{
 expect(registeredJsonContract(name)?.schema).toBe(SceneDressingSchema);
 expect(registeredJsonSchema(name)).toEqual(namedJsonSchema(SceneDressingSchema,{provenance:true}));
 const before=structuredClone(value);validateRegisteredJson(name,value);expect(value).toEqual(before);
 expect(nameBlob(name,'json',bytes,{jsonSchema:registeredJsonSchema(name)}).bytes).toEqual(bytes);
 expect(()=>nameBlob(name,'json',bytes)).toThrow('defining schema');
 expect(registeredJsonContract('world/dressing-desktop.json')).toBeUndefined();
});

test.each([{...value,name:''},{...value,extra:'foreign'},
 {...value,staticModels:[{model:{id:'foreign'},geometry:'missing',material:'missing'}]}])('native full-root checks still refuse malformed rows',bad=>{
 expect(()=>validateRegisteredJson(name,bad)).toThrow();
});

test.each(['missing','foreign'])('metadata %s refuses before any body read',async kind=>{
 let reads=0;const schema=registeredJsonSchema(name),metadata=kind==='missing'?undefined:{...schema,$comment:'foreign'};
 const product=createShardProduct({...identity,shardfile:emptyShardfile(identity),sections:new Map(),jsonCheck:fixtureJsonCheck,
 files:new Map([[name,{hash:hashImmutableBytes(bytes),url:'/same',...(metadata===undefined?{}:{jsonSchema:metadata})}]]),
 read:()=>{reads++;return Promise.resolve(bytes);}});
 await expect(product.json(name)).rejects.toThrow('exact defining format contract');expect(reads).toBe(0);
});

test('existing product reader retains omitted native defaults on decoded wire rows',async()=>{
 let reads=0;const product=createShardProduct({...identity,shardfile:emptyShardfile(identity),sections:new Map(),jsonCheck:fixtureJsonCheck,
 files:new Map([[name,{hash:hashImmutableBytes(bytes),url:'/same',jsonSchema:registeredJsonSchema(name)}]]),
 read:()=>{reads++;return Promise.resolve(bytes);}});
 expect(await product.json(name)).toEqual(value);expect(reads).toBe(1);expect(value).not.toHaveProperty('instances');
});
