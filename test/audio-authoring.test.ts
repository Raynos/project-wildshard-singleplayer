import {expect,it} from 'vitest';
import {parseAudioData} from '@wildshard/format/audio';
import {readProjectAssets} from '@wildshard/sdk/project';
import pineSource from '../src/shards/pine-hollow/data/audioSource.json' with {type:'json'};
import pineOutput from '../src/shards/pine-hollow/data/audio.generated.json' with {type:'json'};
import islandSource from '../src/shards/driftwood-isle/data/audioSource.json' with {type:'json'};
import islandOutput from '../src/shards/driftwood-isle/data/audio.generated.json' with {type:'json'};
import cove from '../src/shards/driftwood-isle/data/coveComposition.json' with {type:'json'};
import {islandCoveSpec} from '../src/shards/driftwood-isle/generators/coveLayout';
import {driftwoodGameplayAudioEnvironment} from '../src/shards/driftwood-isle/generators/gameplayAudioEnvironment';

it.each([
  ['pine-hollow',pineSource,pineOutput],['driftwood-isle',islandSource,islandOutput],
] as const)('%s publishes its authored audio through the existing section',async(slug,source,output)=>{
  const rows=parseAudioData(slug==='driftwood-isle'?{...source.audio,gameplay:{...source.audio.gameplay,entryEnvironment:driftwoodGameplayAudioEnvironment(),constants:{cove:{fall:cove.audioFall,cave:cove.audioCave,caveBounds:cove.audioBounds}}}}:source.audio);
  expect(cove.audioBounds).toEqual(islandCoveSpec().caveBounds);
  expect(cove.audioFall.foot).toEqual(islandCoveSpec().fall.foot);
  expect(islandCoveSpec().cave).toMatchObject(cove.audioCave);
  expect(output.audio).toEqual(rows);
  const product=await readProjectAssets(`src/shards/${slug}`);
  expect(product.shard.audio).toEqual(rows);
  // The producer uses the public wire parser: invalid PCM or zone rows still refuse.
  expect(()=>parseAudioData({...source.audio,pcm:{bad:{seed:[1,2],values:[],samples:0}}})).toThrow();
  expect(()=>parseAudioData({...source.audio,zones:{...source.audio.zones,tickHz:0}})).toThrow();
},30000);

it('every declared cove ambience read resolves in the emitted runtime owner',()=>{
  const rows=parseAudioData(islandOutput.audio);
  const reads=rows.zones?.lifecycle?.inputs.filter(row=>row.kind==='read'&&row.owner==='cove')??[];
  expect(reads).toHaveLength(6);
  for(const row of reads){
    if(row.kind!=='read')throw new Error('Expected numeric owner read');
    let value:unknown=rows.gameplay?.constants?.['cove'];
    for(const field of row.path){
      if(typeof value!=='object'||value===null)throw new Error(`Missing cove ambience path: ${row.path.join('.')}`);
      value=Reflect.get(value,field);
    }
    expect(typeof value,row.path.join('.')).toBe('number');
    expect(Number.isFinite(value),row.path.join('.')).toBe(true);
  }
});
