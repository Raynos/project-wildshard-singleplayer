import { compileDecisionScripts } from '@wildshard/sdk/buildDecisionScripts';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const data=JSON.parse(readFileSync(new URL('../data/ridingRules.json',import.meta.url),'utf8'));
const aliases=names=>Object.fromEntries(names.map(name=>[name,name]));
const registry=names=>new Map([...names].sort((a,b)=>a<b?-1:a>b?1:0).map((name,index)=>[name,index+1]));
const sourceFiles=['mounts','tamingApproach','tamingBreak','riding'];
const authored=new Map(sourceFiles.map(file=>{
 const source=`behaviour/${file}.as`,text=readFileSync(new URL(`../${source}`,import.meta.url),'utf8');
 const baked=text.replaceAll(/Params\.([A-Za-z0-9_]+)/g,(_match,key)=>{const value=data.params[key];if(!Number.isFinite(value))throw new Error(`Missing mounted tuning ${key}`);return `f64(${value})`;}).replace(', Params','');
 return [source,baked];
}));
const text=[...authored.values()].join('\n'),names=prefix=>[...new Set([...text.matchAll(new RegExp(`${prefix}\\.([A-Za-z0-9_]+)`,'g'))].map(match=>match[1]))];
const fields=names('Field'),channels=names('Channel'),signals=names('Signal');
const row={id:'nalati.mounts',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/mounts.as',binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{},reads:['field','radial'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals)};
const built=await compileDecisionScripts([row],{fields:registry(fields),channels:registry(channels),signals:registry(signals)},authored,{asLineCeiling:2837,singleSignal:true});
const script=built.rows.at(0),blob=built.blobs.at(0);if(script===undefined||blob===undefined)throw new Error('Missing mounted projection');
const program={script,bytes:Buffer.from(blob.bytes).toString('base64')},programs={initial:data.initial,approach:program,breaking:program,riding:program};
const writer=byteWriter(process.argv.includes('--check'),'nalati-riding');
writer.put(fileURLToPath(new URL('../behaviour/riding.generated.json',import.meta.url)),jsonBytes(programs));writer.finish();
