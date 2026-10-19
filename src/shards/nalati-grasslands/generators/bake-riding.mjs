import { compileDecisionScripts, readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const data=JSON.parse(readFileSync(new URL('../data/ridingRules.json',import.meta.url),'utf8'));
const authored=readDecisionSources(root),programs={initial:data.initial};
const aliases=names=>Object.fromEntries(names.map(name=>[name,name]));
const registry=names=>new Map([...names].sort((a,b)=>a<b?-1:a>b?1:0).map((name,index)=>[name,index+1]));
for(const [key,file] of Object.entries({approach:'tamingApproach',breaking:'tamingBreak',riding:'riding'})){
 const text=readFileSync(new URL(`../behaviour/${file}.as`,import.meta.url),'utf8');
 const names=prefix=>[...new Set([...text.matchAll(new RegExp(`${prefix}\\.([A-Za-z0-9_]+)`,'g'))].map(match=>match[1]))];
 const fields=names('Field'),channels=names('Channel'),signals=names('Signal');
 if(key==='breaking')signals.push('step');
 const source={id:`nalati.${file}`,abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:`behaviour/${file}.as`,binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:Object.fromEntries(names('Params').map(name=>[name,data.params[name]])),reads:['field'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals)};
 const built=await compileDecisionScripts([source],{fields:registry(fields),channels:registry(channels),signals:registry(signals)},authored,{asLineCeiling:2837});
 const script=built.rows.at(0),blob=built.blobs.at(0);
 if(script===undefined||blob===undefined)throw new Error('Missing riding projection');
 programs[key]={script,bytes:Buffer.from(blob.bytes).toString('base64')};
}
const writer=byteWriter(process.argv.includes('--check'),'nalati-riding');
writer.put(fileURLToPath(new URL('../behaviour/riding.generated.json',import.meta.url)),jsonBytes(programs));writer.finish();
