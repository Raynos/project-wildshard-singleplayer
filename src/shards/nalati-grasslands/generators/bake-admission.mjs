import { compileDecisionScripts, readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

const fields=['tx','tz','ready','threshold','turn','yaw','look','scale','x','z','radius','normal','height','water','wet','clash','coats','mares','foals','stallion','index','start',
  'elite','packs','groups','variants','bodies','bonds','px','py','pz','cx','cz','dt','bark','rest','wolf','distance','wx','wy','wz','straggler','sx','sy','sz','playerX','playerY','playerZ','elites','retired','dormant','unique','herd','expected','id','initial','nextId','variant','speed','awareness','owned','health','held','dog','state','previousState','laneT','runT','phase2','engaged','bonded','same','rule','phase','storm','kills','line','mode','crouched','elapsed','light','count','strength','dot'];
const channels=['x','z','accept','attempts','yaw','start','count','variant','radius','place','mother','scale','bark','rest','snarl','low','speed','turn','path','state','lookX','lookY','lookZ','look','emit','awareness','time','laneT','runT','capture','signature','lead','adopt','fraction'];
const signals=['steer','riderDamage','spot','accept','begin','yaw','packPlan','dogPlan','herdStart','herdMember','foal','pack','bond','dog','restoreBounds','restorePack','restoreBody','restoreBond','speed','whistle','scare','firstRaid','damage','dispatch','argymaqTick','eliteRule','eliteAux','eliteDamage','visibility','downwind','hearing'];
const aliases=values=>Object.fromEntries(values.map(name=>[name,name]));
const registry=values=>new Map([...values].sort((a,b)=>a<b?-1:a>b?1:0).map((name,index)=>[name,index+1]));
const source={id:'nalati.admission',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/admission.as',
  binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{},
  reads:['field','random','radial'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals)};
const built=await compileDecisionScripts([source],{fields:registry(fields),channels:registry(channels),signals:registry(signals)},
  readDecisionSources(fileURLToPath(new URL('../',import.meta.url))),{asLineCeiling:2837});
const script=built.rows.at(0),blob=built.blobs.at(0);
if(script===undefined||blob===undefined)throw new Error('Missing native admission program');
const bytes=`${JSON.stringify({script,bytes:Buffer.from(blob.bytes).toString('base64')},null,2)}\n`;
const target=new URL('../behaviour/admission.generated.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(target,'utf8')!==bytes)throw new Error('Native admission program is stale');}
else writeFileSync(target,bytes);
console.info(`nalati-admission: ${built.lines}/${built.ceiling} authored AS lines`);
