// oxlint-disable-next-line import/no-nodejs-modules -- Same raw source files as the admitted product.
import {readFileSync} from 'node:fs';
import {afterEach,expect,test,vi} from 'vitest';
import {Vector3} from 'three';
import {unzlibSync} from 'fflate';
import {bakedSamplers} from '../src/format/bakedTerrainSampling';
import {AudioSceneSchema} from '../src/format/audioScene';
import {namedJsonSchema} from '../src/sdk/formatJsonSchema';
import {preparedProductEnvelope} from './fixtures/prepared-product-envelope';
import {admitClientPlan} from '../src/game/shardfile/clientPlan';
import {jsonDataNodes,isJsonData} from '../src/format/json';
import {parseAudioData,AudioDataSchema} from '../src/format/audio';
import * as v from 'valibot';
import {readScalarChannel} from '../src/engine/world/scalarChannel';
import {Scope} from '../src/engine/app/scope';
import type {Player} from '../src/engine/player/Player';
import {AudioSceneDirector,clientAudioScene,installClientAudioScene} from '../src/game/audio/sceneDirector';
import type {ShardContext} from '../src/game/plugin/context';
import {createShardProduct} from '../src/game/shardfile/shardProduct';
import {emptyShardfile} from '../src/sdk/author';

import {legacyDouble} from '@wildshard/engine/test/FakeGame';

const audio=v.parse(v.object({audio:AudioDataSchema}),JSON.parse(readFileSync('test/fixtures/nalati-audio-original.json','utf8')));
const originals = ['river','valley','bowl','snow'] as const;
const blocks=new Map(originals.map(id=>[`audio/fields/${id}.bin`,Uint8Array.from(readFileSync(`src/shards/nalati-grasslands/data/audio-${id}.bin`))]));
const scopes:Scope[]=[];
afterEach(()=>{for(const scope of scopes.splice(0))scope.dispose();});
const player=legacyDouble<Player>({position:new Vector3(),yaw:0});
function data(){return parseAudioData(audio.audio);}
function context(read:(name:string)=>Promise<Uint8Array>,named=false){
 const scope=new Scope('audio.fixture');scopes.push(scope);
 const declared=data();if(named){delete declared.scene;declared.sceneFile='audio/scene.json';}
 const files=new Map<string,{hash:string;url:string;jsonSchema?:Readonly<Record<string,unknown>>}>([...blocks.keys()].map(name=>[name,{hash:name,url:name}]));
 if(named)files.set('audio/scene.json',{hash:'audio/scene.json',url:'audio/scene.json',jsonSchema:namedJsonSchema(AudioSceneSchema)});
 const source={...emptyShardfile({slug:'orchard',name:'Orchard',author:'Fixture',revision:1,seed:1}),audio:declared};
 const product=createShardProduct({slug:'orchard',revision:1,shardfile:source,sections:new Map(),files,read});
 const world=legacyDouble<NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>>({player});
 const runtime=legacyDouble<NonNullable<ShardContext['game']['runtime']>>({world});
 const game=legacyDouble<ShardContext['game']>({runtime,declaredAudio:declared});
 const subscriptions:string[]=[];const on=vi.fn((name:string):void=>{subscriptions.push(name);});
 return {scope,world,runtime,on,ctx:legacyDouble<ShardContext>({scope,product,game,on})};
}
function block(name:string){const bytes=blocks.get(name);if(bytes===undefined)throw new Error('Missing fixture block');return bytes;}

test('raw fields decode to their float storage and keep the surface decisions',()=>{
 const raw=data();if(raw.scene===undefined)throw new Error('Missing audio scene');
 const originalFields=new Map<string,(x:number,z:number)=>number>();
 for(const id of originals){
  const row=raw.scene.fields.channels[id];if(row===undefined||Array.isArray(row))throw new Error('Missing raw row');
  const bytes=block(`audio/fields/${id}.bin`),values=readScalarChannel(row,blocks);
  const inflated=unzlibSync(bytes),heights=new Float32Array(inflated.buffer,inflated.byteOffset,inflated.byteLength/4);
  expect(values).toEqual(heights);
  originalFields.set(id,bakedSamplers({res:raw.scene.fields.res,size:raw.scene.fields.size,heights,seed:0,landscapeHash:0,splat:new Uint8Array(0),undergrowth:null}).heightAt);
 }
 const actual=new AudioSceneDirector(raw,player);
 expect(actual.fieldFiles).toHaveLength(4);actual.prepareFields(blocks);
 for(const id of originals)for(const above of [0,.01,.1,.25,.5,.75,.9,.99,1]){
  actual.rows.surfaces.rules=[{kind:'field',id,above,surface:'wood'}];
  const original=originalFields.get(id);if(original===undefined)throw new Error('Missing original sampler');
  for(const x of [-249,-170,-80,0,80,170,249])for(const z of [-249,-170,-80,0,80,170,249])expect(actual.surfaceAt(x,z)).toBe(original(x,z)>above?'wood':raw.scene.surfaces.fallback);
 }
});

test('entered preparation reads all four verified files before one listener publication',async()=>{
 const read=vi.fn((name:string)=>Promise.resolve(block(name))),f=context(read);
 const pending=installClientAudioScene(f.ctx);expect(f.on).not.toHaveBeenCalled();expect(()=>clientAudioScene(f.ctx)).toThrow('not installed');
 await pending;expect(read.mock.calls.map(call=>call[0])).toEqual(Object.keys(data().scene?.fields.channels??{}).map(id=>`audio/fields/${id}.bin`));expect(f.on).toHaveBeenCalledTimes(3);
 expect(clientAudioScene(f.ctx).surfaceAt(0,0)).toMatch(/grass|wood|gravel/u);
 expect(()=>installClientAudioScene(f.ctx)).toThrow('already installed');
});

test.each(['disposed','world replaced','player replaced','rows replaced','reader replaced','malformed suffix'])('refuses %s without publishing listeners',async reason=>{
 let release:((bytes:Uint8Array)=>void)|undefined;
 const first=new Promise<Uint8Array>(resolve=>{release=resolve;});
 const f=context(name=>name==='audio/fields/river.bin'?first:Promise.resolve(reason==='malformed suffix'&&name.endsWith('snow.bin')?new Uint8Array([1,2,3]):block(name)));
 const pending=installClientAudioScene(f.ctx);
 const refusal=expect(pending).rejects.toThrow();
 if(reason==='disposed')f.scope.dispose();
 if(reason==='world replaced')f.runtime.world=legacyDouble<typeof f.world>({player});
 if(reason==='player replaced')f.world.player=legacyDouble<Player>({position:new Vector3(),yaw:0});
 if(reason==='rows replaced')Object.defineProperty(f.ctx.game,'declaredAudio',{value:data()});
 if(reason==='reader replaced')Object.defineProperty(f.ctx.product,'file',{value:()=>Promise.resolve(block('audio/fields/river.bin'))});
 if(release===undefined)throw new Error('Missing read barrier');release(block('audio/fields/river.bin'));
 await refusal;expect(f.on).not.toHaveBeenCalled();expect(()=>clientAudioScene(f.ctx)).toThrow('not installed');
});

test.each(['type','count'])('refuses an incompatible raw field %s before preparation',field=>{
 const input=data();if(input.scene===undefined)throw new Error('Missing scene');
 const row=input.scene.fields.channels['river'];if(row===undefined||Array.isArray(row))throw new Error('Missing raw field');
 if(field==='type')row.type='f64';else row.count--;
 expect(()=>parseAudioData(input)).toThrow('Audio field requires one f32 per sample');
});

test('a named scene resolves through the original product before reading its field blocks',async()=>{
 const bytes=new TextEncoder().encode(JSON.stringify(data().scene));
 const read=vi.fn((name:string)=>Promise.resolve(name==='audio/scene.json'?bytes:block(name))),f=context(read,true);
 await installClientAudioScene(f.ctx);
 expect(read.mock.calls.map(call=>call[0])).toEqual(['audio/scene.json',...Object.keys(data().scene?.fields.channels??{}).map(id=>`audio/fields/${id}.bin`)]);
 expect(f.on).toHaveBeenCalledTimes(3);expect(clientAudioScene(f.ctx).fieldFiles).toHaveLength(4);
});

test('a disposed named-scene owner publishes nothing and never starts field reads',async()=>{
 let release:((bytes:Uint8Array)=>void)|undefined;const file=new Promise<Uint8Array>(resolve=>{release=resolve;});
 const read=vi.fn(()=>file),f=context(read,true),pending=installClientAudioScene(f.ctx),refusal=expect(pending).rejects.toThrow('owner changed');
 f.scope.dispose();if(release===undefined)throw new Error('Missing scene barrier');release(new TextEncoder().encode(JSON.stringify(data().scene)));
 await refusal;expect(read).toHaveBeenCalledTimes(1);expect(f.on).not.toHaveBeenCalled();
});

// Prepare already compiled this exact source; retain native admission and the
// unchanged assertions without running the whole author project again.
const nalatiEnvelope=await preparedProductEnvelope('nalati-grasslands', name=>name==='audio/scene.json');

test('the actual Nalati envelope keeps its complete audio scene outside the 100000-node source budget',()=>{
 const loaded=nalatiEnvelope,nodes=jsonDataNodes(loaded.shard);
 expect(isJsonData(loaded.shard)).toBe(true);expect(nodes).toBeDefined();expect(nodes).toBeLessThanOrEqual(100000);process.stdout.write(`Nalati source JSON nodes ${String(nodes)} (limit 100000)\n`);
 expect(loaded.shard.audio.scene).toBeUndefined();expect(loaded.shard.audio.sceneFile).toBe('audio/scene.json');
 const file=loaded.output.namedFiles?.find(row=>row.name==='audio/scene.json');expect(file).toMatchObject({kind:'json',critical:true});
 const bytes=loaded.assets.get(file?.hash??'');if(bytes===undefined)throw new Error('Missing declared audio scene');
 const hydrated={...loaded.shard.audio,scene:v.parse(AudioSceneSchema,JSON.parse(new TextDecoder().decode(bytes)))};delete hydrated.sceneFile;
 expect(parseAudioData(hydrated).scene).toEqual(data().scene);
});

test('audio feature preflight requires the declared named scene before installation',()=>{
 const f=context(name=>Promise.resolve(block(name)),true),row={version:1,features:[{kind:'audio.scene'}]};
 expect(()=>admitClientPlan(row,f.ctx.product)).not.toThrow();
 f.ctx.product.shardfile.audio.sceneFile='missing.json';
 expect(()=>admitClientPlan(row,f.ctx.product)).toThrow('Audio scene requires its declared profile');expect(f.on).not.toHaveBeenCalled();
});
