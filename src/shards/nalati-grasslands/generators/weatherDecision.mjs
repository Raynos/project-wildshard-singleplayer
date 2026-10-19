import { compileDecisionScripts, readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { fileURLToPath } from 'node:url';

export async function weatherDecision() {
 const fields=['scan','first','bestX','bestY','bestZ','bestKind','bestIndex','bestScore','blocked','index','px','py','pz','crouched','mounted','sheltered','lowFor','cx','cz','radius','count','x','z','top','kind','active','dt','armed','pendingT','ready','storm','gust','bearing','y','titanHeld','phaseT','phaseLen','asked','calmSpeed','calmDir','calmGust','windSpeed','windGustiness','building','after'];
 const channels=['score','x','y','z','radius','kind','index','low','lowFor','pendingT','land','arm','distance','flash','bearing','damage','phaseT','asked','speed','dir','gustiness','seconds'];
 const signals=['arm','pick','low','tick','hit','wind'];
 const aliases=names=>Object.fromEntries(names.map(name=>[name,name])),registry=names=>new Map([...names].sort((a,b)=>a<b?-1:a>b?1:0).map((name,index)=>[name,index+1]));
 const source={id:'nalati.weather',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/weather.as',binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{},reads:['field','random','groundHeight','radial'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals)};
 const built=await compileDecisionScripts([source],{fields:registry(fields),channels:registry(channels),signals:registry(signals)},readDecisionSources(fileURLToPath(new URL('../',import.meta.url))),{asLineCeiling:2837});
 const script=built.rows.at(0),blob=built.blobs.at(0);if(script===undefined||blob===undefined)throw new Error('Missing weather reaction program');
 return {script,bytes:Buffer.from(blob.bytes).toString('base64')};
}
