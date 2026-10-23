// oxlint-disable-next-line import/no-nodejs-modules -- Pin the exact former inline geometry from the registered producer.
import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {CARRIED_QUEST_SOURCES,carriedQuestRows} from '../src/shards/nalati-grasslands/generators/carriedQuest';
import {prepareSpecimenCatalogue} from '../src/game/models/specimenCatalogue';
import {hashImmutableBytes} from '../src/sdk/immutable';
import {readNamedBlob} from '../src/sdk/blobs';
import {Scope} from '../src/engine/app/scope';
import {createShardProduct} from '../src/game/shardfile/shardProduct';
import {emptyShardfile} from '../src/sdk/author';

const hash='ec1282219cd79471dbbdfa8d58e801ebb4b95e73d44106f7e325eb0fc9028440';
test('the carried specimen prepares the exact original geometry through its named product file',async()=>{
  const source=CARRIED_QUEST_SOURCES[0];if(source===undefined)throw new Error('Missing carried source');
  expect(source).toEqual({name:'models/specimens/quest-prop.bin',kind:'bin',source:'data/quest-prop.generated.bin'});
  const bytes=Uint8Array.from(readFileSync(`src/shards/nalati-grasslands/${source.source}`)),scope=new Scope('quest-prop.raw');
  expect(bytes.byteLength).toBe(14904);expect(hashImmutableBytes(bytes)).toBe(hash);
  const product=createShardProduct({slug:'raw-delivery',revision:1,shardfile:emptyShardfile({slug:'raw-delivery',name:'Delivery',author:'Fixture',revision:1,seed:1}),
    sections:new Map(),files:new Map([[source.name,{hash,url:source.name}]]),read:()=>Promise.resolve(bytes)});
  try{
    const files=await prepareSpecimenCatalogue(product,carriedQuestRows.model,scope);
    expect(files.size).toBe(1);expect(files.get(source.name)).toBe(bytes);
    expect(carriedQuestRows.model[0]?.source).toMatchObject({kind:'file',file:source.name});
    const blob=await readNamedBlob('src/shards/nalati-grasslands',source.name,source.source,'bin');
    expect(blob.bytes).toEqual(bytes);expect(blob.file.hash).toBe(hash);expect(blob.file.decoded).toBe(14904);
  }finally{scope.dispose();}
});
