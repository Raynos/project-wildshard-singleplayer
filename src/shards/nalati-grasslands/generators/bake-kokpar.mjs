import { buildCourseProgram } from '@wildshard/commons/practiceCourse';
import { compileDecisionScripts, readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

const { KOKPAR:k }=JSON.parse(readFileSync(new URL('../data/layout.generated.json',import.meta.url),'utf8'));
const goals=[0,Math.PI].map(t=>{const x=Math.cos(t)*k.rx*0.82,z=Math.sin(t)*k.rz*0.82;
 return {x:k.x+x*Math.cos(k.rot)+z*Math.sin(k.rot),z:k.z-x*Math.sin(k.rot)+z*Math.cos(k.rot)};});
const {OVAL,LINE_X,HORSE_START,RIDER_START,FIELD_AT,RIDER_PITCH,SHOULDER}=await import('./horseCourse.ts');
const quest=JSON.parse(readFileSync(new URL('../data/questContent.json',import.meta.url),'utf8'));
if(Math.max(quest.clueFlags.length,quest.featherFlags.length,quest.featherElites.length)>32)throw new Error('Chapter table exceeds its bounded loop');
const fields=['bowPower','bowThreshold','bowBaseDamage','bowPierce','bowCrush','bowCrushScale','bonded','argymaq','inside','king','tied','titan','clueStep',
 ...quest.clueFlags.map((_,i)=>`clue${i}`),...quest.featherFlags.map((_,i)=>`feather${i}`),
 ...quest.featherElites.flatMap((_,i)=>[`elite${i}`,`felled${i}`]),'carrying','left','slow','cheer','warned','dt','playerX','playerZ','goatX','goatZ','mounted','horse','fast','practice','horseX','horseZ'];
const channels=['bowSun','bowDamage','carrying','left','slow','cheer','warned','event','pose','goal','warning','qBonded','qArgymaq','qInside','qKing','qTied','qTitan',
 ...quest.clueFlags.map((_,i)=>`qClue${i}`),...quest.featherFlags.flatMap((_,i)=>[`qFeather${i}`,`qNotice${i}`]),
 ...quest.featherElites.map((_,i)=>`qElite${i}`)],signals=['bow','step','win','quest','carving','feathers'];
const aliases=values=>Object.fromEntries(values.map(name=>[name,name]));
const registry=values=>new Map([...values].sort((a,b)=>a<b?-1:a>b?1:0).map((name,i)=>[name,i+1]));
const row={id:'nalati.kokpar',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/kokpar.as',
 binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],
 params:{clues:quest.clueFlags.length,elites:quest.featherElites.length,feathers:quest.featherFlags.length,homeX:k.x,homeZ:k.z,fieldRadius:Math.max(k.rx,k.rz)+22,goal0X:goals[0].x,goal0Z:goals[0].z,goal1X:goals[1].x,goal1Z:goals[1].z},
 reads:['field'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals)};
const built=await compileDecisionScripts([row],{fields:registry(fields),channels:registry(channels),signals:registry(signals)},
 readDecisionSources(fileURLToPath(new URL('../',import.meta.url))),{asLineCeiling:2837,singleSignal:true});
const script=built.rows.at(0),blob=built.blobs.at(0);
if(script===undefined||blob===undefined)throw new Error('Missing kokpar program');
const course=await buildCourseProgram('oval',{courseRadius:OVAL.radius,courseWidth:OVAL.width,courseLine:LINE_X,
 resetX:RIDER_START.x,resetZ:RIDER_START.z,resetPitch:RIDER_PITCH,resetPrevX:(FIELD_AT.x+RIDER_START.x)-FIELD_AT.x,
 resetYaw:Math.atan2(-((FIELD_AT.x+HORSE_START.x)+SHOULDER-(FIELD_AT.x+RIDER_START.x)),-((FIELD_AT.z+HORSE_START.z)-(FIELD_AT.z+RIDER_START.z)))});
const data={program:{script,bytes:Buffer.from(blob.bytes).toString('base64')},course,home:{x:k.x,z:k.z},goals,
 messages:{'1':'You have the goat! Into a tai-qazan — keep galloping, the riders are on you',
 '2':'You let go of the goat — it goes back to the middle','3':'Off the field — the goat goes back to the middle',
 '4':'Time! The riders take the goat back','5':'A rider leans in and snatches the goat back — keep moving!',
 '6':'15 seconds — find a tai-qazan!','7':'TAI-QAZAN! The riders roar and fling their hats — the round is yours'}};
const bytes=`${JSON.stringify(data,null,2)}\n`,target=new URL('../data/kokpar.generated.json',import.meta.url);
if(process.argv.includes('--check')) {if(readFileSync(target,'utf8')!==bytes)throw new Error('Kokpar program is stale');}
else writeFileSync(target,bytes);
console.info(`nalati-kokpar: ${built.lines}/${built.ceiling} authored AS lines`);
