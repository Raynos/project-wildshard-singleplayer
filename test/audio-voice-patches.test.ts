import { afterEach, expect, it, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import type { Audio } from '../src/engine/audio/Audio';
import { AudioVoicePatches } from '../src/game/audio/voicePatches';
import { parseAudioData } from '../src/format/audio';
import rows from '../src/shards/nalati-grasslands/data/voicePatches.json' with { type:'json' };
import audio from '../src/shards/nalati-grasslands/data/audio.generated.json' with { type:'json' };
import { VoicePatchesSchema } from '../src/format/voicePatches';
import { parse } from 'valibot';
import { legacyDouble } from './fake/FakeGame';
import { AudioSceneDirector, audioPathProbe } from '../src/game/audio/sceneDirector';
import { Vector3 } from 'three';
import type { Player } from '../src/engine/player/Player';

const scopes:Scope[]=[];
afterEach(()=>{for(const scope of scopes)scope.dispose();scopes.length=0;});
function requireCue(input:ReturnType<typeof parse<typeof VoicePatchesSchema>>,id:string){const cue=input.cues[id];if(cue===undefined)throw new Error('Missing fixture cue');return cue;}
function fixture(input:unknown=rows){
 const scope=new Scope('voice.fixture');scopes.push(scope);
 const mixer={ready:true,ctx:{currentTime:10} as AudioContext,sfx:{} as GainNode,shot:vi.fn(()=>false),playPhrase:vi.fn(),tally:vi.fn(),loop:vi.fn(()=>undefined)};
 const host=new AudioVoicePatches(legacyDouble<Audio>(mixer),parseAudioData(audio.audio),input,scope);
 return {host,mixer};
}
it('keeps sampled voices ahead of their synth and plays the release layer',()=>{
 const {host,mixer}=fixture();mixer.shot.mockReturnValue(true);
 host.play('bowTwang',{power:.8});
 expect(mixer.shot.mock.calls).toHaveLength(2);expect(mixer.playPhrase).not.toHaveBeenCalled();
 mixer.shot.mockReturnValue(false);host.play('bowDraw');expect(mixer.playPhrase).toHaveBeenCalledTimes(1);
});
it('bounds hoof density and selects the declared ground sample',()=>{
 const {host,mixer}=fixture();host.play('hooves',{at:10},'wood');host.play('hooves',{at:10.01},'wood');host.play('hooves',{at:10.1},'gravel');
 expect(mixer.shot).toHaveBeenCalledTimes(2);expect(mixer.shot).toHaveBeenLastCalledWith('hoof-gravel',expect.objectContaining({gain:.8,t:10.1}));
});
it('keeps an unrelated fixture shard entirely row driven',()=>{
 const second=parse(VoicePatchesSchema,{initial:{},bed:'cavern',calls:[],groups:{},cues:{drip:{defaults:{gain:.3},values:[],layers:[{cue:'echo',count:2,values:[],afterSample:true}],sample:{id:'drip',surface:false,gain:'gain',rate:1,delay:0}},echo:{defaults:{},values:[],layers:[],phrase:'native.arrowWhoosh'}}});
 second.cues['echo']={defaults:{power:.5,swing:0},values:[],layers:[],phrase:'native.arrowWhoosh'};
 const {host,mixer}=fixture(second);mixer.shot.mockReturnValue(true);host.play('drip');
 expect(mixer.playPhrase).toHaveBeenCalledTimes(2);
});
it('does not allocate a storm when both observed levels are zero',()=>{
 const {host,mixer}=fixture();host.setGroup('storm',{rain:0,stormwind:0});expect(mixer.shot).not.toHaveBeenCalled();
 expect(host.observations).toEqual({rain:0,stormwind:0});
});
it('refuses missing phrase rows and recursive layers',()=>{
 const broken=structuredClone(rows);const draw=broken.cues.bowDraw;draw.phrase='absent';expect(()=>fixture(broken)).toThrow('absent');
 const recursive=parse(VoicePatchesSchema,structuredClone(rows));requireCue(recursive,'bowDraw').layers.push({cue:'bowDraw',count:1,values:[],afterSample:true});
 const {host}=fixture(recursive);expect(()=>host.play('bowDraw')).toThrow('recursion');
});

it('uses scene geometry and surfaces from an unrelated orchard fixture',()=>{
 const data=parseAudioData(audio.audio);if(data.scene===undefined)throw new Error('Missing scene');
 data.scene.fields.channels={};data.scene.paths={walk:[[-10,0],[10,0]]};
 data.scene.surfaces={fallback:'grass',rules:[{kind:'rect',x:5,z:5,width:2,depth:4,surface:'wood'},{kind:'path',ids:['walk'],below:1,surface:'gravel'}]};
 const scene=new AudioSceneDirector(data,legacyDouble<Player>({position:new Vector3(),yaw:0}));
 expect(scene.surfaceAt(5,5)).toBe('wood');expect(scene.surfaceAt(1,.5)).toBe('gravel');expect(scene.surfaceAt(1,3)).toBe('grass');
 expect(audioPathProbe([[0,0],[0,10]],3,5)).toEqual({distance:3,x:-1,z:0});
});
