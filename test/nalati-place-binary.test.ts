// oxlint-disable-next-line import/no-nodejs-modules -- Verify the registered producer's exact sidecar bytes under Node.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare independent SHA-256 receipts from the original inflated rasters.
import {createHash} from 'node:crypto';
import * as v from 'valibot';
import {expect,test} from 'vitest';
import {SceneFloorSchema} from '../src/format/sceneDressing';
import {readSceneFloors} from '../src/game/shardfile/sceneDressing';
import {prepareBinarySources} from '../src/game/models/binarySource';
import {createShardProduct} from '../src/game/shardfile/shardProduct';
import {emptyShardfile} from '../src/sdk/author';
import {Scope} from '../src/engine/app/scope';

const source=v.parse(v.object({floorSources:v.array(v.object({name:v.string(),source:v.string()})),places:v.object({rows:v.array(v.object({members:v.array(v.tuple([v.string(),v.object({floors:v.array(SceneFloorSchema)})]))}))})}),
  JSON.parse(readFileSync('src/shards/nalati-grasslands/data/placeRuntime.generated.json','utf8')));
const fields=source.places.rows.flatMap(row=>row.members.flatMap(([,member])=>member.floors.filter(floor=>'file'in floor)));
const original=[
  {x:180,z:85,size:24.849907960416758,res:312,bytes:389376,hash:'895bd0eff0cc3cd710b4a16e624c9dc962bc35e90e8f8985c8dfab0bc2ee3cf4'},
  {x:-172.1,z:75,size:17,res:214,bytes:183184,hash:'31f46016e071151f68724c5b8937a4147e01ef99ff6fb24da29b47f7de391029'},
];

test('the two named floor rasters retain original placement and every finite/NaN word',async()=>{
  const scope=new Scope('floor.binary.receipt'),blocks=new Map(source.floorSources.map(file=>[file.name,Uint8Array.from(readFileSync(`src/shards/nalati-grasslands/${file.source}`))]));
  const hashes=new Map([...blocks].map(([name,bytes])=>[name,createHash('sha256').update(bytes).digest('hex')]));
  const product=createShardProduct({slug:'floor-place',revision:1,shardfile:emptyShardfile({slug:'floor-place',name:'Floor',author:'Test',revision:1,seed:1}),sections:new Map(),
    files:new Map([...hashes].map(([name,hash])=>[name,{hash,url:name}])),read:hash=>{const entry=[...hashes].find(([,value])=>value===hash),bytes=entry===undefined?undefined:blocks.get(entry[0]);if(bytes===undefined)throw new Error('Missing original floor');return Promise.resolve(bytes);}});
  const files=await prepareBinarySources(product,fields.map(field=>({source:{file:field.file},bytes:field.res*field.res*4})),scope);
  try{
  expect(fields).toHaveLength(2);expect(source.floorSources).toHaveLength(2);
  for(const [index,row]of fields.entries()){
    if(!('file'in row))throw new Error('Missing raw floor');
    const descriptor=source.floorSources.find(file=>file.name===row.file),expected=original[index];
    if(descriptor===undefined||expected===undefined)throw new Error('Missing original floor source');
    const bytes=files.get(descriptor.name);if(bytes===undefined)throw new Error('Missing prepared floor');
    expect({x:row.x,z:row.z,size:row.size,res:row.res}).toEqual({x:expected.x,z:expected.z,size:expected.size,res:expected.res});
    expect(bytes.byteLength).toBe(expected.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(expected.hash);
    expect(new Float32Array(bytes.buffer).some(value=>Number.isNaN(value))).toBe(true);
    const [floor]=readSceneFloors([row],files);
    expect(floor).toBeTypeOf('function');
  }
  }finally{scope.dispose();}
});
