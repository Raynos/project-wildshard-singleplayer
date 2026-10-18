import { compileDecisionScripts, readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

const fields=["raidT", "pendingT", "raiding", "raids", "taken", "drivenOff", "cracks", "cracksNow", "spawned", "crackCd", "restT", "patrolA", "force", "blocked", "alive", "packAlive", "ready", "present", "tracking", "broken", "preyAlive", "yaw", "time", "seed", "cx", "cz", "distance", "dt", "px", "pz", "wolf", "wx", "wz"];
const channels=["raidT", "pendingT", "raiding", "raids", "taken", "drivenOff", "cracks", "cracksNow", "crackCd", "restT", "patrolA", "spawn", "outcome", "attempt", "crack", "scare", "accept", "x", "z", "yaw", "speed", "turn", "state"];
const signals=["raidFirst", "shepherdSite", "raidStart", "raidReady", "raidBegin", "raidRetry", "raidTick", "shepherd"];
const aliases=values=>Object.fromEntries(values.map(name=>[name,name]));
const registry=values=>new Map([...values].sort((a,b)=>a<b?-1:a>b?1:0).map((name,index)=>[name,index+1]));
const source={id:'nalati.pasture',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/pasture.as',
  binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{},
  reads:['field','random','radial'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals)};
const built=await compileDecisionScripts([source],{fields:registry(fields),channels:registry(channels),signals:registry(signals)},
  readDecisionSources(fileURLToPath(new URL('../',import.meta.url))),{asLineCeiling:2837});
const script=built.rows.at(0),blob=built.blobs.at(0);
if(script===undefined||blob===undefined)throw new Error('Missing native pasture program');
const bytes=`${JSON.stringify({script,bytes:Buffer.from(blob.bytes).toString('base64')},null,2)}\n`;
const target=new URL('../behaviour/pasture.generated.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(target,'utf8')!==bytes)throw new Error('Native pasture program is stale');}
else writeFileSync(target,bytes);
console.info(`nalati-pasture: ${built.lines}/${built.ceiling} authored AS lines`);
