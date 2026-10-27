import {expect,test} from 'vitest';
import {parseAudioData} from '@wildshard/format/audio';
import {encodeCanonicalJson} from '@wildshard/sdk/immutable';
import {NALATI_AUDIO as original} from './fixtures/originalNalatiAudio';
import source from '../src/shards/nalati-grasslands/data/audioSource.json' with {type:'json'};
import patches from '../src/shards/nalati-grasslands/data/voicePatches.json' with {type:'json'};
import scene from '../src/shards/nalati-grasslands/data/audioScene.json' with {type:'json'};
import emitted from './fixtures/nalati-audio-original.json' with {type:'json'};

const actual=parseAudioData({patches,scene,...source});
test('Nalati audio data emits exactly the original section bytes',()=>{
  expect(encodeCanonicalJson({audio:actual})).toBe(encodeCanonicalJson({audio:original}));
  expect(encodeCanonicalJson({audio:actual})).toBe(encodeCanonicalJson(emitted));
});

test('music fallback, ordered ambience and voice effect precedence stay unchanged',()=>{
  expect(actual.music).toStrictEqual(original.music);
  expect(actual.zones).toStrictEqual(original.zones);
  expect(actual.voiceBindings).toStrictEqual(original.voiceBindings);
  expect(actual.routing).toStrictEqual(original.routing);
  expect(actual.synth).toStrictEqual(original.synth);
});

test('the original public audio parser still refuses malformed literal rows',()=>{
  expect(()=>parseAudioData({...actual,zones:{...actual.zones,tickHz:0}})).toThrow();
  expect(()=>parseAudioData({...actual,pcm:{bad:{seed:[1,2],values:[],samples:0}}})).toThrow();
});
