// oxlint-disable-next-line import/no-nodejs-modules -- Verify original compressed and decoded raster bytes.
import {createHash} from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Same raw source files as the admitted product.
import {readFileSync} from 'node:fs';
import {afterEach,expect,test,vi} from 'vitest';
import {Vector3} from 'three';
import {parseAudioData,AudioDataSchema} from '../src/format/audio';
import * as v from 'valibot';
import {readScalarChannel} from '../src/engine/world/scalarChannel';
import {Scope} from '../src/engine/app/scope';
import type {Player} from '../src/engine/player/Player';
import {AudioSceneDirector,clientAudioScene,installClientAudioScene} from '../src/game/audio/sceneDirector';
import type {ShardContext} from '../src/game/plugin/context';
import {createShardProduct} from '../src/game/shardfile/shardProduct';
import {emptyShardfile} from '../src/sdk/author';

import {legacyDouble} from './fake/FakeGame';

const audio=v.parse(v.object({audio:AudioDataSchema}),JSON.parse(readFileSync('src/shards/nalati-grasslands/data/audio.generated.json','utf8')));
const originals = [
 ['river','d2bdc7a50c3f3119ed15ca03154a6ed6039ea4fd1f0bc32e479d4844e30ef0e6','1ef935050117896e0590bc51775ee5bac2366399a2dc2def7d55f41e02319812'],
 ['valley','2c2b942ba2fbd3b001945de545c706a5312f12bb6f1bfc25109e6706e8e99af2','2d589f3b5f47dd604d6c3ee6f29cbf28f1627b996af0ddd13faea969c0c02bf5'],
 ['bowl','20c087521628bdd91ef810182b036f78a6042bc8cc96eb5f25c9c29df3cfebdf','f0ea552fd089a1537f08037ab907dd5f6384f5823be24c983b09e032570919e5'],
 ['snow','2a785d244fcf7943b6ca3e47f54c5e675566a589af53cdf9488711d49d34caa3','9fdefa4ce94fc8b61be6d4e4a56fd30ccbd2719618422955855e175c6a2ca1ef'],
] as const;
const blocks=new Map(originals.map(([id])=>[`audio/fields/${id}.bin`,Uint8Array.from(readFileSync(`src/shards/nalati-grasslands/data/audio-${id}.bin`))]));
const scopes:Scope[]=[];
afterEach(()=>{for(const scope of scopes.splice(0))scope.dispose();});
const player=legacyDouble<Player>({position:new Vector3(),yaw:0});
function data(){return parseAudioData(audio.audio);}
function context(read:(name:string)=>Promise<Uint8Array>){
 const scope=new Scope('audio.fixture');scopes.push(scope);
 const source={...emptyShardfile({slug:'orchard',name:'Orchard',author:'Fixture',revision:1,seed:1}),audio:data()};
 const product=createShardProduct({slug:'orchard',revision:1,shardfile:source,sections:new Map(),files:new Map([...blocks.keys()].map(name=>[name,{hash:name,url:name}])),read});
 const world=legacyDouble<NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>>({player});
 const runtime=legacyDouble<NonNullable<ShardContext['game']['runtime']>>({world});
 const game=legacyDouble<ShardContext['game']>({runtime,declaredAudio:data()});
 const subscriptions:string[]=[];const on=vi.fn((name:string):void=>{subscriptions.push(name);});
 return {scope,world,runtime,on,ctx:legacyDouble<ShardContext>({scope,product,game,on})};
}
function block(name:string){const bytes=blocks.get(name);if(bytes===undefined)throw new Error('Missing fixture block');return bytes;}

test('raw fields retain original compressed bytes, float storage and surface decisions',()=>{
 const raw=data(),old=data();if(raw.scene===undefined||old.scene===undefined)throw new Error('Missing audio scene');
 for(const [id,compressed,decoded]of originals){
  const row=raw.scene.fields.channels[id];if(row===undefined||Array.isArray(row))throw new Error('Missing raw row');
  const bytes=block(`audio/fields/${id}.bin`),values=readScalarChannel(row,blocks);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(compressed);
  expect(createHash('sha256').update(new Uint8Array(values.buffer,values.byteOffset,values.byteLength)).digest('hex')).toBe(decoded);
  old.scene.fields.channels[id]=Buffer.from(bytes).toString('base64').match(/.{1,4096}/gu)??[];
 }
 const actual=new AudioSceneDirector(raw,player),oracle=new AudioSceneDirector(old,player);
 expect(actual.fieldFiles).toHaveLength(4);expect(oracle.fieldFiles).toEqual([]);actual.prepareFields(blocks);
 for(const [id]of originals)for(const above of [0,.01,.1,.25,.5,.75,.9,.99,1]){
  actual.rows.surfaces.rules=[{kind:'field',id,above,surface:'wood'}];oracle.rows.surfaces.rules=[{kind:'field',id,above,surface:'wood'}];
  for(const x of [-249,-170,-80,0,80,170,249])for(const z of [-249,-170,-80,0,80,170,249])expect(actual.surfaceAt(x,z)).toBe(oracle.surfaceAt(x,z));
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
