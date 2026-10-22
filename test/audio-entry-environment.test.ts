import { expect, test } from 'vitest';
import * as v from 'valibot';
import { AudioEntryEnvironmentSchema, parseAudioData } from '../src/format/audio';

const audio={cues:[],ambience:null,score:'silent'};
const gameplay={entered:false,score:false,activate:false,restoreShade:false,inputs:{},writers:{},entities:{},commands:{}};
const legacy={objects:{},near:{},floors:{},dusk:{owner:'original',path:[]},
  emitter:{id:'hum',profile:'shrine',point:{owner:'original',path:[]},height:2.5},
  publish:{id:'scene.audio',values:{}}};

const entry = {
  floors:{decks:[null,null,'boat',null,null,'bridge','wreck'],stone:['shrine']},
  bounds:{holdBox:{x:4,z:5,r:6,yMin:-2,yMax:3},caveBox:null},
  near:{palms:{phone:[{x:1,z:2}],desktop:[{x:3,z:4},{x:5,z:6}]}},
  dusk:'shrine',emitter:{id:'hum',profile:'shrine',point:'shrine',height:2.5},
  publish:{id:'scene.audio',hum:'hum',bank:'bank',surfaces:'surfaces',ambience:'ambience'},
};

test('entered audio admits finite loans, ordered floor gaps and separate tier point inventories',()=>{
  const parsed=parseAudioData({...audio,gameplay:{...gameplay,entryEnvironment:entry}});
  expect(parsed.gameplay?.entryEnvironment).toEqual(entry);
  expect(parsed.gameplay).not.toHaveProperty('environment');
  expect(parseAudioData({...audio,gameplay:{...gameplay,environment:legacy}}).gameplay?.environment).toEqual(legacy);
});

test('entered audio rejects reflected references, callbacks, extra fields and missing tier rows',()=>{
  for(const row of [
    {...entry,floors:{decks:[{owner:'world',path:['boat']}]}},
    {...entry,emitter:{...entry.emitter,point:()=>undefined}},
    {...entry,emitter:{...entry.emitter,path:['position']}},
    {...entry,near:{palms:{phone:[]}}},
    {...entry,dusk:'not an owner'},
  ])expect(()=>v.parse(AudioEntryEnvironmentSchema,row)).toThrow();
});

test('entered audio bounds all numeric spatial facts and publication identities',()=>{
  for(const row of [
    {...entry,bounds:{holdBox:{x:0,z:0,r:0,yMin:0,yMax:1}}},
    {...entry,bounds:{holdBox:{x:0,z:0,r:1,yMin:2,yMax:1}}},
    {...entry,near:{palms:{phone:[{x:Number.NaN,z:0}],desktop:[]}}},
    {...entry,near:{palms:{phone:Array.from({length:2049},()=>({x:0,z:0})),desktop:[]}}},
    {...entry,publish:{...entry.publish,hum:'bank'}},
  ])expect(()=>v.parse(AudioEntryEnvironmentSchema,row)).toThrow();
  expect(()=>parseAudioData({...audio,gameplay:{...gameplay,environment:legacy,entryEnvironment:entry}})).toThrow('Exclusive gameplay audio environment');
});
