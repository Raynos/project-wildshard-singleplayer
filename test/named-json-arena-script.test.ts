import { expect,test } from 'vitest';
import { ArenaScriptFightFileSchema,ArenaScriptGeometrySchema } from '@wildshard/format/arenaScriptRows';
import { TimedEncountersSchema,CloudSpecimenSchema } from '@wildshard/format/encounterRows';
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
import night from '../src/shards/nalati-grasslands/data/night.generated.json' with {type:'json'};
import strikes from '../src/shards/nalati-grasslands/data/strikeProfiles.generated.json' with {type:'json'};

const encode=(value:unknown):Uint8Array=>new TextEncoder().encode(JSON.stringify(value));

test('real arena payloads have one defining schema at production and product read',async()=>{
  const fight={arenaScript:titan.TITAN_HOST,programs,arenaFire};
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
  const badFire={...fight,arenaFire:{...arenaFire,flameCount:65537}};
  expect(()=>nameBlob('combat/titan-fight.json','json',encode(badFire),{jsonSchema:fightSchema})).toThrow('refuses its schema');
  expect(()=>validateNamedJsonSchema(fightSchema,encode(badFire))).toThrow('refuses its schema');
  for(const arenaScript of [
    {...fight.arenaScript,field:{...fight.arenaScript.field,width:65}},
    {...fight.arenaScript,support:{...fight.arenaScript.support,actors:{...fight.arenaScript.support.actors,hp:0}}},
    {...fight.arenaScript,whirls:{...fight.arenaScript.whirls,debris:{...fight.arenaScript.whirls.debris,count:65}}},
  ]) {
    expect(()=>nameBlob('combat/titan-fight.json','json',encode({...fight,arenaScript}),{jsonSchema:fightSchema})).toThrow('refuses its schema');
    expect(()=>validateNamedJsonSchema(fightSchema,encode({...fight,arenaScript}))).toThrow('refuses its schema');
  }
});

test('timed encounter admission bounds rosters before native owners allocate',async()=>{
  const rows={...night,presentation:'night',phases:{slots:['night'],patrol:['night']},lightFloor:.2,
    contact:{strike:strikes.arrow,tags:['creature.rider'],origin:'actor'}};
  const schema=namedJsonSchema(TimedEncountersSchema);
  const blob=nameBlob('combat/timed-encounters.json','json',encode(rows),{jsonSchema:schema});
  const identity={slug:'timed-schema',name:'Timed schema',author:'Wildshard',revision:1,seed:1};
  let payload=blob.bytes;
  const product=createShardProduct({slug:identity.slug,revision:1,shardfile:emptyShardfile(identity),sections:new Map(),
    files:new Map([['combat/timed-encounters.json',{...blob.file,url:'https://example.test/timed'}]]),read:()=>Promise.resolve(payload)});
  expect(await product.json('combat/timed-encounters.json')).toEqual(rows);
  for(const bad of [
    {...rows,patrol:{...rows.patrol,actors:{...rows.patrol.actors,count:9}}},
    {...rows,slots:{...rows.slots,select:{...rows.slots.select,count:9}}},
    {...rows,motion:{...rows.motion,parameters:{bad:'not numeric'}}},
    {...rows,view:{...rows.view,tell:{...rows.view.tell,pool:9}}},
    {...rows,ride:{...rows.ride,arrow:{...rows.ride.arrow,maxFlying:65}}},
  ]) {
    expect(()=>nameBlob('combat/timed-encounters.json','json',encode(bad),{jsonSchema:schema})).toThrow('refuses its schema');
    payload=encode(bad);
    await expect(product.json('combat/timed-encounters.json')).rejects.toThrow('refuses its schema');
  }
});


test('cloud specimen file admission refuses invalid materials and puff capacity',async()=>{
  const body={...geometry.body,geometry:{...geometry.body.geometry,eyes:geometry.eyes},poses:geometry.poses};
  const phone={...body,puffs:{...body.puffs,rows:geometry.phone.puffs}},desktop={...body,puffs:{...body.puffs,rows:geometry.desktop.puffs}};
  const rows={name:'cloud-schema',phone,desktop,pose:{rise:1},ports:{place:{ground:0}}};
  const schema=namedJsonSchema(CloudSpecimenSchema);
  const blob=nameBlob('models/cloud.json','json',encode(rows),{jsonSchema:schema});
  let payload=blob.bytes;
  const identity={slug:'cloud-schema',name:'Cloud schema',author:'Wildshard',revision:1,seed:1};
  const product=createShardProduct({slug:identity.slug,revision:1,shardfile:emptyShardfile(identity),sections:new Map(),
    files:new Map([['models/cloud.json',{...blob.file,url:'https://example.test/cloud'}]]),read:()=>Promise.resolve(payload)});
  expect(await product.json('models/cloud.json')).toEqual(rows);
  for(const bad of [
    {...rows,phone:{...phone,puffs:{...phone.puffs,detail:5}}},
    {...rows,phone:{...phone,materials:{...phone.materials,bad:{kind:'fx',mode:'missing',colour:[1,1,1],alpha:1}}}},
  ]) {
    expect(()=>nameBlob('models/cloud.json','json',encode(bad),{jsonSchema:schema})).toThrow('refuses its schema');
    payload=encode(bad);
    await expect(product.json('models/cloud.json')).rejects.toThrow('refuses its schema');
  }
});
