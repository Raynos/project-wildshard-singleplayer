import { expect,test } from 'vitest';
import { ArenaScriptFightFileSchema,ArenaScriptGeometrySchema } from '@wildshard/format/arenaScriptRows';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { nameBlob } from '@wildshard/sdk/blobs';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { readArenaScriptData } from '../src/game/boss/arenaScript';
import { emptyShardfile } from '@wildshard/sdk/author';
import titan from '../src/shards/nalati-grasslands/data/stormTitanFight.generated.json' with {type:'json'};
import geometry from '../src/shards/nalati-grasslands/data/stormTitanGeometry.generated.json' with {type:'json'};
import arenaFire from '../src/shards/nalati-grasslands/data/arenaFire.json' with {type:'json'};
import programs from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with {type:'json'};

const encode=(value:unknown):Uint8Array=>new TextEncoder().encode(JSON.stringify(value));

test('real arena payloads have one defining schema at production and product read',async()=>{
  const fight={...titan,arenaScript:titan.TITAN_HOST,programs,arenaFire};
  const fightSchema=namedJsonSchema(ArenaScriptFightFileSchema),geometrySchema=namedJsonSchema(ArenaScriptGeometrySchema);
  const fightBlob=nameBlob('combat/titan-fight.json','json',encode(fight),{jsonSchema:fightSchema});
  const geometryBlob=nameBlob('combat/titan-geometry.json','json',encode(geometry),{jsonSchema:geometrySchema});
  expect(validateNamedJsonSchema(fightSchema,fightBlob.bytes)).toEqual(fight);
  expect(validateNamedJsonSchema(geometrySchema,geometryBlob.bytes)).toEqual(geometry);
  const blobs=[fightBlob,geometryBlob],bytes=new Map(blobs.map(blob=>[blob.file.hash,blob.bytes]));
  const identity={slug:'arena-schema',name:'Arena schema',author:'Wildshard',revision:1,seed:1};
  const product=createShardProduct({slug:identity.slug,revision:1,shardfile:emptyShardfile(identity),sections:new Map(),
    files:new Map(blobs.map(blob=>{const name=blob.file.name;if(name===undefined)throw new Error('Missing named fixture');return [name,{...blob.file,url:`https://example.test/${blob.file.path}`}] as const;})),
    read:hash=>{const value=bytes.get(hash);return value===undefined?Promise.reject(new Error('Missing fixture bytes')):Promise.resolve(value);}});
  const files={fight:'combat/titan-fight.json',geometry:'combat/titan-geometry.json'};
  const read=await readArenaScriptData(product,files);
  expect(read.place.heartHp).toBe(titan.TITAN_HOST.place.heartHp);
  expect(read.geometry.phone).toEqual(geometry.phone);
  const bad={...fight,arenaScript:{...fight.arenaScript,place:{...fight.arenaScript.place,heartHp:'many'}}};
  expect(()=>nameBlob('combat/titan-fight.json','json',encode(bad),{jsonSchema:fightSchema})).toThrow('refuses its schema');
  expect(()=>validateNamedJsonSchema(fightSchema,encode(bad))).toThrow('refuses its schema');
  bytes.set(fightBlob.file.hash,encode(bad));
  await expect(readArenaScriptData(product,files)).rejects.toThrow('refuses its schema');
  const badGeometry={...geometry,phone:'missing'};
  expect(()=>validateNamedJsonSchema(geometrySchema,encode(badGeometry))).toThrow('refuses its schema');
});
