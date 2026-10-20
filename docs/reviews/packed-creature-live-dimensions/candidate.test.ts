import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {packedCreatureBodies} from '../../../src/game/plugin/geometry';
const folder='art/driftwood-isle/approved-bloomthroat-iguana/eight-owner-candidate1';
const pins={'metadata.json':'eeb6d8c0b3842e261ec6e0bdc3ab07b02fa57f6538f959d6c87a31e33ae0063e','payload.bin':'88abdc1c335ddf06a93afe2c4cda6a77c1304286d3cb4a8928d80e3cce5b747c','checkpoint.json':'8fcd56814b798757f662b3c3ff81209c0573137183d0b6ff613c3585f3760663'};
test('current parser transports unchanged historical candidate without granting anatomy admission',async()=>{
 for(const [name,hash]of Object.entries(pins))expect(createHash('sha256').update(readFileSync(`${folder}/${name}`)).digest('hex')).toBe(hash);
 const input:unknown=JSON.parse(readFileSync(`${folder}/metadata.json`,'utf8'));
 const loader=packedCreatureBodies(input,undefined,()=>Promise.resolve(new Uint8Array(readFileSync(`${folder}/payload.bin`))));await loader.preload();
 const a=loader.copy('bloomthroat-iguana','bloomthroat-iguana'),b=loader.copy('bloomthroat-iguana','bloomthroat-iguana');
 expect(a.bones).toHaveLength(8);expect(a.hardParts).toHaveLength(16);expect(a.dims.bodyAt).toEqual([0,.16500000000000004,.06999999999999995]);expect(a.dims.bodyPitch).toBe(.3201707768798952);expect(a.dims.fore?.bone).toBe('bloom0');expect(a.dims.rigidCorpse?.parts.reduce((n,p)=>n+p.points.length,0)).toBe(457);
 expect(a.dims).toEqual(b.dims);expect(a.dims.bodyAt).not.toBe(b.dims.bodyAt);expect(a.dims.headAt).not.toBe(b.dims.headAt);expect(a.dims.fore?.at).not.toBe(b.dims.fore?.at);
 for(const body of [a,b])for(const geometry of body.hardParts)geometry.dispose();
 for(const [name,hash]of Object.entries(pins))expect(createHash('sha256').update(readFileSync(`${folder}/${name}`)).digest('hex')).toBe(hash);
});
