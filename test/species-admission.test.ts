import { expect,test } from 'vitest';
import { SpeciesActorsFileSchema } from '@wildshard/format/speciesBookRows';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { nameBlob } from '@wildshard/sdk/blobs';
import { emptyShardfile } from '@wildshard/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import source from '../src/shards/nalati-grasslands/data/species.generated.json' with {type:'json'};

const encode=(value:unknown):Uint8Array=>new TextEncoder().encode(JSON.stringify(value));

test('species named-file admission precedes native catalogue allocation',async()=>{
  const file={species:source.presentation},schema=namedJsonSchema(SpeciesActorsFileSchema);
  const blob=nameBlob('actors/sheep.json','json',encode(file),{jsonSchema:schema});
  const identity={slug:'species-admission',name:'Species admission',author:'Wildshard',revision:1,seed:1};
  const product=(payload:unknown)=>createShardProduct({slug:identity.slug,revision:1,shardfile:emptyShardfile(identity),sections:new Map(),
    files:new Map([['actors/sheep.json',{...blob.file,url:'https://example.test/species'}]]),read:()=>Promise.resolve(encode(payload))});
  expect(await product(file).json('actors/sheep.json')).toEqual(file);
  const view=source.presentation,first=view.lookBook.rows[0];if(first===undefined)throw new Error('Missing real species row');
  for(const species of [
    {...view,packedBodies:{...view.packedBodies,attrs:[['position','f64',3,false]]}},
    {...view,lookBook:{...view.lookBook,rows:Array.from({length:257},()=>first)}},
    {...view,cracks:{...view.cracks,index:'u16'}},
    {...view,lookBook:{...view.lookBook,rows:[{...first,material:{rim:'bright',bands:.8}}]}},
  ]){
    expect(()=>nameBlob('actors/sheep.json','json',encode({species}),{jsonSchema:schema})).toThrow();
    await expect(product({species}).json('actors/sheep.json')).rejects.toThrow('refuses its schema');
  }
});
