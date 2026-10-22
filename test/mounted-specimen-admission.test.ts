import {expect,test} from 'vitest';
import {MountedSpecimenSeatSchema} from '@wildshard/format/mountedSpecimenRows';
import {namedJsonSchema} from '@wildshard/sdk/formatJsonSchema';
import {nameBlob} from '@wildshard/sdk/blobs';
import {emptyShardfile} from '@wildshard/sdk/author';
import {createShardProduct} from '../src/game/shardfile/shardProduct';
import {MOUNTED_FIGURE as source} from '../src/shards/nalati-grasslands/generators/mountedFigure';

const encode=(input:unknown):Uint8Array=>new TextEncoder().encode(JSON.stringify(input));
test('the actual mounted figure keeps every clip and rejects invalid seats before native construction',async()=>{
  const schema=namedJsonSchema(MountedSpecimenSeatSchema),blob=nameBlob('riding/mounted-figure.json','json',encode(source),{jsonSchema:schema});
  const identity={slug:'seat-admission',name:'Seat admission',author:'Wildshard',revision:1,seed:1};
  const product=(input:unknown)=>createShardProduct({slug:identity.slug,revision:1,shardfile:emptyShardfile(identity),sections:new Map(),
    files:new Map([['riding/mounted-figure.json',{...blob.file,url:'https://example.test/seat'}]]),read:()=>Promise.resolve(encode(input))});
  expect(await product(source).json('riding/mounted-figure.json')).toEqual(source);
  for(const input of [{...source,mount:''},{...source,material:{...source.material,rim:'bright'}},
    {...source,gestures:[{cue:'crack',clock:'crackT',duration:0}]},{...source,gestures:Array.from({length:17},()=>({cue:'crack',clock:'crackT',duration:.2}))}]){
    expect(()=>nameBlob('riding/mounted-figure.json','json',encode(input),{jsonSchema:schema})).toThrow();
    await expect(product(input).json('riding/mounted-figure.json')).rejects.toThrow('refuses its schema');
  }
});
