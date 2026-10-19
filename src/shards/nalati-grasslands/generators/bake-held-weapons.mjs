import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {compileDecisionScripts} from '@wildshard/sdk/buildDecisionScripts';
import {byteWriter,jsonBytes} from '../../../../scripts/bake-output.mjs';
import profile from '../data/weaponPowers.json' with {type:'json'};

const declarations={"polearm":{"file":"heldPolearm.as","fields":["activeEnd","ads","ammo","angle","attack","baseDamage","capacity","closing","cone","count","distance","dt","enabled","height","held","hit","id","kind","lanceReach","live","minSpeed","mounted","pickupHeight","pickupRadius","previousAds","queued","radius","random","recovery","rehit","release","since","speed","speedDamage","survive","tap","threw","throwRelease","throwWindup","throwing","thrust","total","wind","windup"],"channels":["charge","damage","dry","hit","lance","launch","pickup","previousAds","queued","recover","release","start","strike","target","threw","throwing","thrust","wind"]},"blade":{"file":"heldBlade.as","fields":["attack","baseDamage","behind","chain","chainMax","chainStep","chainWindow","charging","cooldown","count","distance","dt","forward","hits","links","live","look","mounted","passCooldown","sense","side","speed","speedDivisor"],"channels":["chain","cooldown","damage","links","side"]},"power":{"file":"heldPower.as","fields":["along","arcRadius","call","callDamage","callRadius","callTime","callX","callZ","clearArcs","count","crescentDamage","crescentRange","crescentWidth","dt","gallopMin","heavy","id","live","mounted","radius","scale","side","speed","storm","stormArcs","stormMultiplier","swing","x","y","z"],"channels":["action","aoe0","aoe1","aoe2","aoe3","arc1","arc2","call","callDamage","damage","detonate","target"]}};
const aliases=names=>Object.fromEntries(names.map(name=>[name,name]));
const registry=names=>new Map([...names].sort((a,b)=>a<b?-1:a>b?1:0).map((name,index)=>[name,index+1]));
const programs={};
for(const [key,{file,fields,channels}] of Object.entries(declarations)){
 const source=`behaviour/${file}`,row={id:`nalati.${key}-weapon`,abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source,binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{},reads:['field'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:{step:'step'}};
 const built=await compileDecisionScripts([row],{fields:registry(fields),channels:registry(channels),signals:registry(['step'])},new Map([[source,readFileSync(new URL(`../${source}`,import.meta.url),'utf8')]]),{asLineCeiling:200});
 const script=built.rows.at(0),blob=built.blobs.at(0);if(script===undefined||blob===undefined)throw new Error('Missing held weapon program');programs[key]={script,bytes:Buffer.from(blob.bytes).toString('base64')};
}
const writer=byteWriter(process.argv.includes('--check'),'nalati-held-weapons');
writer.put(fileURLToPath(new URL('../data/heldWeapons.generated.json',import.meta.url)),jsonBytes({...profile,programs}));writer.finish();
