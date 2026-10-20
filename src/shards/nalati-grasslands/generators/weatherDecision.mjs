import { compileDecisionScripts, readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { fileURLToPath } from 'node:url';

/**
 * The steppe storm as weather reactions (G474, @wildshard/game/weather/reactions WeatherReactions) at 10 Hz: the bolt clock runs
 * while nothing is armed; a ready storm arms a strike on the highest point of a cell round the player (the yurts and the
 * covered player excepted) and lands it 1.2 s later; a gust front or a waning storm only flashes in the cloud; GET LOW
 * while the player is the highest thing within 30 m; the wind the phase asks for (the Storm Titan holds his storm open).
 * The page and the renderer-free host add the struck points and the shelters.
 */
const reg=name=>`register.${name}`,inp=name=>`input.${name}`,out=name=>[name,`output.${name}`];
const player=['px','py','pz','crouched','mounted','sheltered'].map(name=>[name,inp(name)]);
export const STORM={version:1,hz:10,hud:{chips:[{state:'building',within:45,title:'Storm in {left}',tone:'soon'},{state:'gust',title:'Storm',tone:'storm'},{state:'storm',title:'Storm {left}',tone:'storm'},{state:'clearing',title:'Clearing',tone:'clearing'}],sub:'WIND {wind} m/s',low:'low'},actions:{event:'lightning',unless:'armed'},active:['gust','storm'],flash:'flash',shelter:{margin:1.5,circles:[]},points:[],steps:[
 {signal:'tick',observe:[['dt','dt'],['armed',reg('armed')],['pendingT',reg('pendingT')],['ready',reg('ready')],['storm','state.storm'],['gust','state.gust'],['bearing',reg('stormFrom')],['flash',reg('flash')]],random:true,
  write:[['pendingT',reg('pendingT')],['land',reg('land')],['arm',reg('arm')],['flash',reg('flash')]],emit:[{event:'flash',when:'distance',fields:[out('distance'),out('bearing')]}]},
 {signal:'arm',when:reg('arm'),observe:[['px',inp('px')],['pz',inp('pz')],['lowFor',reg('lowFor')]],random:true,write:[['x',reg('cx')],['z',reg('cz')],['radius',reg('cradius')]],emit:[]},
 {signal:'pick',when:reg('arm'),observe:[...player,['cx',reg('cx')],['cz',reg('cz')],['radius',reg('cradius')]],probe:{x:reg('cx'),z:reg('cz'),radius:reg('cradius')},
  write:[['x',reg('sx')],['y',reg('sy')],['z',reg('sz')],['kind',reg('skind')],['armed',reg('armed')],['pendingT',reg('pendingT')]],emit:[{event:'telegraph',when:'x',fields:[out('x'),out('y'),out('z'),out('kind')]}]},
 {signal:'hit',when:reg('land'),observe:[...player,['x',reg('sx')],['y',reg('sy')],['z',reg('sz')],['kind',reg('skind')]],write:[['flash',reg('flash')],['armed',reg('armed')],['land',reg('land')]],
  emit:[{event:'strike',when:'distance',fields:[['x',reg('sx')],['y',reg('sy')],['z',reg('sz')],['kind',reg('skind')]]},{event:'flash',when:'distance',fields:[out('distance'),out('bearing')]},{event:'hurt',when:'damage',fields:[out('damage')]},{event:'burn',when:'burn',fields:[['x',reg('sx')],['y',reg('sy')],['z',reg('sz')]]}]},
 {signal:'low',observe:[...player,['dt','dt'],['lowFor',reg('lowFor')],['gust','state.gust'],['storm','state.storm']],probe:{x:inp('px'),z:inp('pz'),radius:30},write:[['low',reg('low')],['lowFor',reg('lowFor')]],emit:[]},
 {signal:'wind',observe:[['titanHeld',inp('held')],...['storm','gust','building','after'].map(state=>[state,`state.${state}`]),['phaseT','phaseT'],['phaseLen','phaseLen'],['asked',reg('asked')],
   ...['calmSpeed','calmDir','calmGust'].map(name=>[name,inp(name)]),['windSpeed',reg('windSpeed')],['windGustiness',reg('windGustiness')]],
  write:[['phaseT','phaseT'],['asked',reg('asked')]],emit:[{event:'wind',when:'speed',fields:[out('speed'),out('dir'),out('gustiness'),out('seconds')]}]},
]};


export async function weatherDecision() {
 const fields=["phase","living","kills","empty","killed","hidden","active","after","armed","asked","bearing","bestIndex","bestKind","bestScore","bestX","bestY","bestZ","blocked","building","calmDir","calmGust","calmSpeed","count","crouched","cx","cz","dt","first","gust","index","kind","lowFor","mounted","pendingT","phaseLen","phaseT","px","py","pz","radius","ready","scan","sheltered","storm","titanHeld","top","windGustiness","windSpeed","x","y","z","at","slot","s","ax","az","mode","theta","dir","t","respawn","hold","night","alive","dead","dying","fade","fadeTarget","vx","vz","gone","fireT","quiet","distance","engaged","flash","canter","center","x0","x1","x2","x3","z1","z2","z3","z4","d1","d2","d3","d4"];
 const channels=["vx","vz","first","phase","kills","dissolve","arm","armed","burn","asked","bearing","damage","dir","distance","flash","gustiness","index","kind","land","low","lowFor","pendingT","phaseT","radius","score","seconds","speed","x","y","z","s","yaw","mode","theta","t","turn","respawn","spawn","killed","dead","dying","fade","fadeTarget","retire","dx","dy","dz","broken","statue","fireT","shoot"];
 const signals=["patrolMotion","warriorCycle","patrolFire","patrolCycle","patrolEmpty","patrolDissolve","arm","hit","low","pick","tick","wind","lineStart","lineSlot","line","target","roster","rider","aim","tonight","warrior","fire","retry"];
 const aliases=names=>Object.fromEntries(names.map(name=>[name,name])),registry=names=>new Map([...names].sort((a,b)=>a<b?-1:a>b?1:0).map((name,index)=>[name,index+1]));
 const source={id:'nalati.weather',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/weather.as',binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{},reads:['field','random','groundHeight','radial'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals)};
 const built=await compileDecisionScripts([source],{fields:registry(fields),channels:registry(channels),signals:registry(signals)},readDecisionSources(fileURLToPath(new URL('../',import.meta.url))),{asLineCeiling:2837,singleSignal:true});
 const script=built.rows.at(0),blob=built.blobs.at(0);if(script===undefined||blob===undefined)throw new Error('Missing weather reaction program');
 return {script,bytes:Buffer.from(blob.bytes).toString('base64')};
}
