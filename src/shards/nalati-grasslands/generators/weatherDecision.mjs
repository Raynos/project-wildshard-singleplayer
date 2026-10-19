import { compileDecisionScripts, readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { fileURLToPath } from 'node:url';

export async function weatherDecision() {
 const fields=["active","after","armed","asked","bearing","bestIndex","bestKind","bestScore","bestX","bestY","bestZ","blocked","building","calmDir","calmGust","calmSpeed","count","crouched","cx","cz","dt","first","gust","index","kind","lowFor","mounted","pendingT","phaseLen","phaseT","px","py","pz","radius","ready","scan","sheltered","storm","titanHeld","top","windGustiness","windSpeed","x","y","z","at","slot","s","ax","az","mode","theta","dir","t","respawn","hold","night","alive","dead","dying","fade","fadeTarget","vx","vz","gone","fireT","quiet","distance","engaged","canter","center","x0","x1","x2","x3","z1","z2","z3","z4","d1","d2","d3","d4"];
 const channels=["arm","asked","bearing","damage","dir","distance","flash","gustiness","index","kind","land","low","lowFor","pendingT","phaseT","radius","score","seconds","speed","x","y","z","s","yaw","mode","theta","t","turn","respawn","spawn","killed","dead","dying","fade","fadeTarget","retire","dx","dy","dz","broken","statue","fireT","shoot"];
 const signals=["arm","hit","low","pick","tick","wind","lineStart","lineSlot","line","target","roster","rider","aim","tonight","warrior","fire","retry"];
 const aliases=names=>Object.fromEntries(names.map(name=>[name,name])),registry=names=>new Map([...names].sort((a,b)=>a<b?-1:a>b?1:0).map((name,index)=>[name,index+1]));
 const source={id:'nalati.weather',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/weather.as',binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{},reads:['field','random','groundHeight','radial'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals)};
 const built=await compileDecisionScripts([source],{fields:registry(fields),channels:registry(channels),signals:registry(signals)},readDecisionSources(fileURLToPath(new URL('../',import.meta.url))),{asLineCeiling:2837});
 const script=built.rows.at(0),blob=built.blobs.at(0);if(script===undefined||blob===undefined)throw new Error('Missing weather reaction program');
 return {script,bytes:Buffer.from(blob.bytes).toString('base64')};
}
