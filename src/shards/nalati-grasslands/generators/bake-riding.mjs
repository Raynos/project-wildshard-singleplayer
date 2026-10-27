import { SEED } from './terrainRecipe.ts';
import { compileReturnProjectionV2 } from '@wildshard/sdk/returnProjectionV2';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const data=JSON.parse(readFileSync(new URL('../data/ridingRules.json',import.meta.url),'utf8'));
const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
const ecology=read('../data/ecology.generated.json'),forager=read('../creatures/marmotForager.json'),seed=SEED;
const population={...data.population,variants:[{kind:ecology.species.kokbori.kind,rows:ecology.species.kokbori.variants.map(({id,scale})=>({id,scale}))}],flocks:ecology.flocks.world.map((row,index)=>({row:{...row,seed:seed+row.seed},dog:ecology.wildlife.flocks[index]?.dog===true})),forager:{row:forager,seed:seed^0x6a2b}};
const canonical=name=>name;
const aliases=names=>Object.fromEntries(names.map(name=>[name,canonical(name)]));
const registry=names=>new Map(names.map(canonical).sort((a,b)=>a<b?-1:a>b?1:0).map((name,index)=>[name,index+1]));
const sourceFiles=['mounts','tamingApproach','tamingBreak','riding','tamingCoordinator','mountsProject'];
const authored=new Map(sourceFiles.map(file=>{
 const source=`behaviour/${file}.as`,text=readFileSync(new URL(`../${source}`,import.meta.url),'utf8');
 const baked=text.replaceAll(/Params\.([A-Za-z0-9_]+)/g,(_match,key)=>{const value=data.params[key];if(!Number.isFinite(value))throw new Error(`Missing mounted tuning ${key}`);return `f64(${value})`;}).replace(', Params','');
 return [source,baked];
}));
const text=[...authored.values()].join('\n'),names=prefix=>[...new Set([...text.matchAll(new RegExp(`${prefix}\\.([A-Za-z0-9_]+)`,'g'))].map(match=>match[1]))];
const fields=names('Field'),channels=names('Channel'),signals=names('Signal');
const row={id:'nalati.mounts',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/mounts.as',binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{},reads:['field','radial'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals)};
const dual=await compileReturnProjectionV2(row,{fields:registry(fields),channels:registry(channels),signals:registry(signals)},authored,{asLineCeiling:3184,projectSource:'behaviour/mountsProject.as',worldActions:true,capture:{fields:[...new Set([...authored.get('behaviour/tamingCoordinator.as').matchAll(/set\(Field\.([A-Za-z0-9_]+)/g)].map(match=>match[1]))],channels:[...new Set([...authored.get('behaviour/tamingCoordinator.as').matchAll(/out\(Channel\.([A-Za-z0-9_]+)/g)].map(match=>match[1]))]},outputCapacity:96});
const program={...dual.legacy,bytes:'',v2:{...dual.candidate,bytes:''}},compiled={witnessBytes:dual.witness.length,source:'behaviour/riding.generated.wasm',bytes:dual.binary.length,hash:dual.candidate.artifact.hash};
const programs={client:data.client,reins:read('../data/reins.json'),population,initial:data.initial,approach:program,breaking:program,riding:program,compiled};
const writer=byteWriter(process.argv.includes('--check'),'nalati-riding');
writer.put(fileURLToPath(new URL('../behaviour/riding.generated.wasm',import.meta.url)),dual.binary);
writer.put(fileURLToPath(new URL('../behaviour/riding-witness.generated.bin',import.meta.url)),dual.witness);
writer.put(fileURLToPath(new URL('../behaviour/riding.generated.json',import.meta.url)),jsonBytes(programs));writer.finish();
