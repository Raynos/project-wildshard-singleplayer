import { Rng } from '@wildshard/sdk/random';
import { parseSpawnScript } from '@wildshard/format/spawnScripts';
import population from '../data/nightPopulation.generated.json' with { type: 'json' };
import tuning from '../data/populationWaves.json' with { type: 'json' };
import rule from '../data/populationNight.json' with { type: 'json' };

const { spec } = population;
const slots = [...Array.from({length:4},(_,i)=>({id:`roam.${i}`,handle:i+1})),...spec.race.map((_,i)=>({id:`race.${i}`,handle:i+5}))];
const fields = ['x','z','scripted','lookWeight','night','limit','force'].map(source=>({id:source,source}));
const moves = [
 {id:'night.escape',kind:'stalk',ground:true,above:0,standOff:600,speed:tuning.escape.speed,turn:tuning.escape.turn,retreat:true,constantSpeed:true,ready:{kind:'over',radius:.001,height:600}},
 {id:'night.listen',kind:'stalk',ground:true,above:0,standOff:0,speed:0,turn:tuning.listenTurn,ready:{kind:'over',radius:.001,height:600}},
];
const species = spec.roamKinds.map(kind=>({id:kind,kind,variant:rule.variant}));
const sites = [...slots.slice(0,4).map(row=>({id:row.id,slot:row.id,face:'player'})),...spec.race.map((row,i)=>({id:`race.${i}`,slot:`race.${i}`,point:[row.x,row.z],face:[spec.face.x,spec.face.z]}))];
const spawns = [...slots.slice(0,4).flatMap(slot=>species.map(kind=>({id:`${slot.id}.${kind.id}`,species:kind.id,site:slot.id}))),...spec.race.map((row,i)=>({id:`race.${i}`,species:row.kind,site:`race.${i}`}))];
const slotState = (name:string,type:string,def:number|boolean,min?:number,max?:number)=>({name,type,default:def,scope:'binding',...(min===undefined?{}:{min}),...(max===undefined?{}:{max})});
const script = {
 id:'pine.night',abi:'1.0',side:'sim',source:'behaviour/night.as',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,binding:{shard:true},pages:1,onFail:'hold',tick:10,on:['start','tick'],
 reads:['x','z','alive','hpShare','distance','nearestPlayer','field','flag','groundHeight','moving','radial'],commands:['spawn','despawn','move','stop','field','flag','cue','channel'],
 actors:Object.fromEntries(slots.map(row=>[row.id,row.id])),spawns:Object.fromEntries(spawns.map(row=>[row.id,row.id])),
 moves:{escape:'night.escape',listen:'night.listen'},fields:Object.fromEntries(fields.map(row=>[row.id,row.id])),
 flags:{asked:rule.asked,done:rule.done},cues:{call:'call',wake:'wake',flee:'flee',burst:'burst'},channels:{count:'count'},
 stateVersion:1,state:[slotState('lastTick','i32',0,0,2147483647),slotState('rng','f64',new Rng(1337).fork(rule.step).snapshot().state,0,4294967295),slotState('acc','f64',0,0,1),slotState('roam','i32',0,0,15),slotState('race','i32',0,0,7),
 ...Array.from({length:4},(_,i)=>slotState(`flee${i}`,'f64',0,0,4)),...spec.race.map((_,i)=>slotState(`woke${i}`,'bool',false))],
 params:{regionX:spec.region.x,regionZ:spec.region.z,axisX:spec.region.ax,axisZ:spec.region.az,excludeX:spec.exclude.x,excludeZ:spec.exclude.z,excludeR:spec.exclude.blend+tuning.placement.excludeClear,
 millX:spec.mill.x,millZ:spec.mill.z,water:spec.water+tuning.placement.waterClear,bound:tuning.placement.bound,radius:tuning.placement.radius,regionScale:tuning.regionScale,raceRange:tuning.raceRange},
};
/** The compiler and runner share one real slot/recipe catalogue. Placement and lifecycle rules are authored in night.as. */
export const NIGHT_SPAWN = parseSpawnScript({step:rule.step,roster:'pine.roster',seed:1337,maximum:spec.max,controlState:rule.state,script,bytes:'',slots,species,sites,spawns,fields,moves,
 flags:[rule.asked,rule.done],cues:['call','wake','flee','burst'],channels:['count'],
 legacy:{spec:JSON.stringify(spec),acc:'acc',rng:'rng',countChannel:'count',groups:[
 {key:'roam',active:'roam',slots:slots.slice(0,4).map(row=>row.id),values:['flee0','flee1','flee2','flee3'],value:'flee',type:'f64'},
 {key:'race',active:'race',slots:slots.slice(4).map(row=>row.id),values:['woke0','woke1','woke2'],value:'woke',type:'bool'},
 ]},
});
