import {expect,test} from 'vitest';
import {ForestGroundLayoutSchema} from '../src/format/forestPage';
import {CaveFileSchema,CaveInteriorSchema} from '../src/format/caveInterior';
import {registeredJsonContract,validateRegisteredJson} from '../src/format/registeredJson';
import {registeredJsonSchema,namedJsonSchema} from '../src/sdk/formatJsonSchema';
import {nameBlob} from '../src/sdk/blobs';
import {emptyShardfile} from '../src/sdk/author';
import {createShardProduct} from '../src/game/shardfile/shardProduct';
import {fixtureJsonCheck} from './fixtures/productFile';
import {CAVE_LOOK} from '../src/shards/pine-hollow/generators/cragLook';

const point={x:0,y:0,z:0,nx:0,ny:1,nz:0,rot:0,scale:1,r:.2,g:.3,b:.4};
const floor={counts:[1],layout:{orchard:[point]}};
const meta={version:1,holes:[],cuts:[],spots:[],inside:[],shaft:{top:[0,4,0],foot:[0,0,0],r0:1,r1:1},drips:[],floor:[],tris:{cave:0,far:0,col:0}};
const cave={meta,shell:[]};
const interior={product:'quarry',file:'world/adit.json',frame:{x:40,z:-12,yaw:1.1},
  roof:{url:'/assets/quarry/parts.bin',part:0,rows:{bytes:48,geometries:[{attrs:[['position',3]],count:3,unique:3,own:'u16',indexCount:3}]}},
  rock:{look:'quarry-rock',fill:'aditFill',pbr:'slate',grit:'gravel'},look:CAVE_LOOK};
const contracts=[
  {name:'world/floor.json',schema:ForestGroundLayoutSchema,source:'@wildshard/format/forestPage#ForestGroundLayoutSchema',value:floor,invalid:{...floor,counts:[0]}},
  {name:'world/crag-cave.json',schema:CaveFileSchema,source:'@wildshard/format/caveInterior#CaveFileSchema',value:cave,invalid:{...cave,meta:{...meta,inside:[[1]]}}},
  {name:'world/cave-interior.json',schema:CaveInteriorSchema,source:'@wildshard/format/caveInterior#CaveInteriorSchema',value:interior,invalid:{...interior,look:{...CAVE_LOOK,shaft:{...CAVE_LOOK.shaft,radialSegments:65}}}},
] as const;
const encode=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value));

test.each(contracts)('$name retains its exact defining native contract and bytes',row=>{
  expect(registeredJsonContract(row.name).schema).toBe(row.schema);
  expect(registeredJsonSchema(row.name)).toEqual({...namedJsonSchema(row.schema),$comment:row.source});
  const value=structuredClone(row.value),bytes=encode(value);
  validateRegisteredJson(row.name,value);expect(value).toEqual(row.value);
  expect(nameBlob(row.name,'json',bytes,{jsonSchema:registeredJsonSchema(row.name)}).bytes).toEqual(bytes);
  expect(()=>nameBlob(row.name,'json',bytes)).toThrow('defining schema');
  expect(()=>validateRegisteredJson(row.name,row.invalid)).toThrow();
});

test.each(contracts)('$name refuses missing or foreign metadata before the native file read',async row=>{
  const bytes=encode(row.value),schema=registeredJsonSchema(row.name);
  if(schema===undefined)throw new Error('Missing defining ground schema');
  for(const metadata of [undefined,{...schema,$comment:'foreign-contract'}]){
    let reads=0;
    const identity={slug:'ground-contract',name:'Ground',author:'Fixture',revision:1,seed:1};
    const product=createShardProduct({...identity,shardfile:emptyShardfile(identity),sections:new Map(),jsonCheck:fixtureJsonCheck,
      files:new Map([[row.name,{hash:'a'.repeat(64),url:'/same',...(metadata===undefined?{}:{jsonSchema:metadata})}]]),
      read:()=>{reads++;return Promise.resolve(bytes);}});
    await expect(product.json(row.name)).rejects.toThrow('exact defining format contract');expect(reads).toBe(0);
  }
});
