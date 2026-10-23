import {afterEach,beforeAll,expect,test,vi} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Every cache fixture is owned beneath the repository tmp directory.
import {existsSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,truncateSync,utimesSync,writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths never leave the owned cache root.
import {join,resolve} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Corruption fixtures rewrite the exact cache wire bytes.
import {Buffer} from 'node:buffer';
import {bakeWorldTexture} from '../src/sdk/bake/textureWasm';
import {cachedWorldTexture} from '../src/sdk/bake/worldTextureMemo';
import {writeImagePixels} from '../src/sdk/bake/image';
import {parseKtx2} from '../src/sdk/assets';
import {hashImmutableBytes} from '../src/sdk/immutable';
import * as v from 'valibot';

const owned:string[]=[];
let image:Uint8Array=new Uint8Array(),reference:Uint8Array=new Uint8Array();
const key='a'.repeat(64);
function fixture():string {
 mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp','world-texture-cache-'));owned.push(root);return root;
}
beforeAll(async()=>{
 vi.stubEnv('WILDSHARD_WORLD_TEXTURE_CACHE',undefined);
 image=await writeImagePixels({width:8,height:4,pixels:Uint8ClampedArray.from({length:8*4*4},(_,i)=>(i*37+Math.floor(i/32)*19)%256)});
 reference=await bakeWorldTexture(image,'srgb');
});
afterEach(()=>{vi.unstubAllEnvs();for(const root of owned.splice(0))rmSync(root,{recursive:true,force:true});});

test.each([
 {role:'srgb' as const,flipY:false,hash:'9b94aa4bb723529cb260c135de4951a699b011073ea36e2300bd5a63aa8aca5e'},
 {role:'srgb' as const,flipY:true,hash:'2c4333e75aa6ca73f226128a1e38ddf32070bffe5d4ddb48f1646148839ff8a1'},
 {role:'linear' as const,flipY:false,hash:'cc3ae3f3ca1ff669e5f1f9112e278458d546becfb6f3bbaf4ef71fd1d4cb7208'},
 {role:'linear' as const,flipY:true,hash:'366d26c6c12741f86a7db9f459c595f7132006f9ba9d558d32b501eea3542d5a'},
])('retains original $role flipY=$flipY encoder bytes cold and warm',async row=>{
 const root=fixture();vi.stubEnv('WILDSHARD_WORLD_TEXTURE_CACHE',root);
 const cold=await bakeWorldTexture(image,row.role,{flipY:row.flipY}),warm=await bakeWorldTexture(image,row.role,{flipY:row.flipY});
 expect(hashImmutableBytes(cold)).toBe(row.hash);expect(warm).toEqual(cold);expect(cold.length).toBe(372);
 expect(readdirSync(root)).toHaveLength(1);
});

test('a hit skips encoding, re-admits its exact bytes and owns the returned storage',()=>{
 const root=fixture(),encode=vi.fn(()=>Uint8Array.from(reference)),admit=vi.fn(parseKtx2);
 const first=cachedWorldTexture(root,key,encode,admit);first.fill(0);
 const second=cachedWorldTexture(root,key,encode,admit);
 expect(second).toEqual(reference);expect(encode).toHaveBeenCalledTimes(1);expect(admit).toHaveBeenCalledTimes(2);
});

test.each(['json','key','hash','base64','schema','oversize'] as const)('re-encodes a %s cache corruption instead of accepting it',kind=>{
 const root=fixture(),encode=vi.fn(()=>Uint8Array.from(reference)),file=join(root,`${key}.json`);
 cachedWorldTexture(root,key,encode,parseKtx2);
 if(kind==='json')writeFileSync(file,'not JSON');
 else if(kind==='oversize')truncateSync(file,33_334_001);
 else{
  const value=v.parse(v.record(v.string(),v.unknown()),JSON.parse(readFileSync(file,'utf8')));
  if(kind==='key')value['key']='b'.repeat(64);
  if(kind==='hash')value['hash']='0'.repeat(64);
  if(kind==='base64')value['bytes']='broken';
  if(kind==='schema')value['schema']=2;
  writeFileSync(file,JSON.stringify(value));
 }
 expect(cachedWorldTexture(root,key,encode,parseKtx2)).toEqual(reference);expect(encode).toHaveBeenCalledTimes(2);
});

test.each(['dimensions','mips','transfer'] as const)('re-encodes a self-consistent cache with wrong %s',async kind=>{
 const root=fixture();vi.stubEnv('WILDSHARD_WORLD_TEXTURE_CACHE',root);
 await bakeWorldTexture(image,'srgb');
 const [name]=readdirSync(root);if(name===undefined)throw new Error('Missing cold cache entry');
 const file=join(root,name),saved=v.parse(v.object({bytes:v.string()}),JSON.parse(readFileSync(file,'utf8')));
 const bytes=Buffer.from(saved.bytes,'base64'),header=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(kind==='dimensions')header.setUint32(20,4,true);
 if(kind==='mips')header.setUint32(40,1,true);
 if(kind==='transfer')bytes[header.getUint32(48,true)+14]=1;
 const value=v.parse(v.record(v.string(),v.unknown()),JSON.parse(readFileSync(file,'utf8')));
 value['bytes']=bytes.toString('base64');value['hash']=hashImmutableBytes(bytes);writeFileSync(file,JSON.stringify(value));
 expect(await bakeWorldTexture(image,'srgb')).toEqual(reference);
 const repaired=v.parse(v.object({hash:v.string()}),JSON.parse(readFileSync(file,'utf8')));
 expect(repaired.hash).toBe(hashImmutableBytes(reference));
});

test('changed decoded pixels, roles and orientation get separate keys; invalid input still refuses',async()=>{
 const root=fixture();vi.stubEnv('WILDSHARD_WORLD_TEXTURE_CACHE',root);
 await bakeWorldTexture(image,'srgb');await bakeWorldTexture(image,'linear');await bakeWorldTexture(image,'srgb',{flipY:true});
 const changed=await writeImagePixels({width:8,height:4,pixels:new Uint8ClampedArray(8*4*4).fill(127)});
 expect(await bakeWorldTexture(changed,'srgb')).not.toEqual(reference);expect(readdirSync(root)).toHaveLength(4);
 await expect(bakeWorldTexture(new Uint8Array([1,2,3]),'srgb')).rejects.toThrow();expect(readdirSync(root)).toHaveLength(4);
});

test('disabled or unwritable storage encodes normally; failed encodes never publish',()=>{
 const root=fixture(),file=join(root,'not-a-directory');writeFileSync(file,'keep');
 const encode=vi.fn(()=>Uint8Array.from(reference));
 expect(cachedWorldTexture(undefined,key,encode,parseKtx2)).toEqual(reference);
 expect(cachedWorldTexture(file,key,encode,parseKtx2)).toEqual(reference);expect(readFileSync(file,'utf8')).toBe('keep');
 expect(()=>cachedWorldTexture(root,key,()=>{throw new Error('encode refused');},parseKtx2)).toThrow('encode refused');
 expect(existsSync(join(root,`${key}.json`))).toBe(false);
 expect(()=>cachedWorldTexture(root,key,()=>reference,()=>{throw new Error('admission refused');})).toThrow('admission refused');
 expect(existsSync(join(root,`${key}.json`))).toBe(false);
});

test('bounds cache count and bytes while preserving unrelated paths',()=>{
 const root=fixture();
 for(let i=0;i<130;i++){
  const file=join(root,`${i.toString(16).padStart(64,'0')}.json`);writeFileSync(file,'old');utimesSync(file,1,1);
 }
 const large=join(root,`${'f'.repeat(64)}.json`);writeFileSync(large,'old');truncateSync(large,128*1024*1024+1);utimesSync(large,0,0);
 writeFileSync(join(root,'keep.txt'),'keep');
 cachedWorldTexture(root,key,()=>reference,parseKtx2);
 expect(readdirSync(root).filter(name=>name.endsWith('.json')).length).toBeLessThanOrEqual(128);
 expect(existsSync(large)).toBe(false);expect(readFileSync(join(root,'keep.txt'),'utf8')).toBe('keep');
 expect(cachedWorldTexture(root,key,()=>{throw new Error('warm encode');},parseKtx2)).toEqual(reference);
});
