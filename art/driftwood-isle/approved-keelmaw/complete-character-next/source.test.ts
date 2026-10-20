import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { packedCreatureBodies } from '../../../../src/game/plugin/geometry';
const directory='art/driftwood-isle/approved-keelmaw/complete-character-next/model/';
const read=(name:string):unknown=>JSON.parse(readFileSync(directory+name,'utf8'));
const numbers=v.array(v.number());
const source=v.parse(v.object({bones:v.array(v.object({name:v.string(),parent:v.nullable(v.string()),pos:v.tuple([v.number(),v.number(),v.number()])})),parts:v.array(v.object({name:v.string(),positions:numbers,colorsLinear:numbers,skinIndices:numbers,skinWeights:numbers,furLen:numbers}))}),read('native-source.json'));
async function load(){const loader=packedCreatureBodies(read('metadata.json'),undefined,()=>Promise.resolve(new Uint8Array(readFileSync(directory+'payload.bin'))));await loader.preload();return loader.copy('keelmaw','keelmaw');}
test('actual strict native consumer preserves every mesh attribute and absolute bind',async()=>{
 const body=await load();expect(body.bones).toEqual(source.bones);expect(body.hardParts).toHaveLength(19);expect(body.dims.rigidCorpse).toBeUndefined();
 const attrs=[['position','positions'],['color','colorsLinear'],['skinIndex','skinIndices'],['skinWeight','skinWeights'],['furLen','furLen']] as const;
 for(const [i,g]of body.hardParts.entries()){const part=source.parts[i];if(part===undefined)throw new Error('Missing part');for(const [attr,key]of attrs)expect(g.getAttribute(attr).array).toEqual(key==='skinIndices'?new Uint16Array(part[key]):new Float32Array(part[key]));g.dispose();}
});
