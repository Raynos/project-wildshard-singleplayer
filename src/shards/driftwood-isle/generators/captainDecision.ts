import { CAPTAIN_FIELDS } from './captainFields';
import physics from '../data/physics.generated.json' with {type:'json'};
import { driftwoodGroundSampler } from './groundSampling';
import { DRIFTWOOD_STRIKE_ROWS } from '../data/strikes';
/** The six authored states run on the existing 10 Hz decision owner; movement and lift stay fixed-step. */
const zero = '0'.repeat(64);
export const CAPTAIN_MOVES = [
  { id: 'captain.rise', kind: 'burrow', field: 'rise', rate: 1/1.1 },
  { id: 'captain.sink', kind: 'surface', field: 'rise', rate: 1/.9 },
  { id: 'captain.relocate', kind: 'relocate', point: { kind: 'fields', x: 'burst-x', z: 'burst-z' }, facing: 'target' },
  ...[1.2,1.35,1.7].map((speed,i) => ({ id: `captain.stalk.${i}`, kind: 'stalk', ground: true, above: 0, standOff: 1.955,
    speed, turn: 3, ready: { kind: 'over', radius: 2.3, height: 600 } })),
  ...[.96,1.08,1.36].map((speed,i)=>({id:`captain.home.${i}`,kind:'perch',ground:true,perch:'captain.pool',arrival:1,speed,turn:2.5})),
] as const;
function captainSwing(id:string,windup:number) {return {...DRIFTWOOD_STRIKE_ROWS.swing,id,windup:windup+(windup+.35)*.04,recover:.35-(windup+.35)*.04,cooldown:0};}
export const CAPTAIN_STRIKES = [{...DRIFTWOOD_STRIKE_ROWS.swing,cooldown:0}, {...DRIFTWOOD_STRIKE_ROWS.second,cooldown:0},
  captainSwing('strike.captain.swing.1',.62),captainSwing('strike.captain.swing.2',.5),
  {...DRIFTWOOD_STRIKE_ROWS.burst,windup:0,cooldown:0}];
export const CAPTAIN_BRAIN = { archetype: 'decision' as const, data: { script: 'driftwood.captain.decision', actor: 'driftwood.captain',
  marks: { fight: 'awake', phase: 'phase' }, strikeEffects: [],
} };
export const CAPTAIN_BODY = { kind: 'animal', motion: 'ground', attack: 'keeper', stunned: 'none', contact: {kind:'environment',halfArc:70*Math.PI/180},
  actions: {stateKey:'st',states:['hide','rise','stalk','attack','hide','hide'],actions:[]}, offset:{field:'rise',from:-2.8,to:0},
} as const;
export const CAPTAIN_DECISION = [{ id:'driftwood.captain.decision',abi:'1.0',side:'sim',module:`blobs/wasm/${zero}.wasm`,source:'behaviour/captain.as',
  binding:{shard:true},pages:1,onFail:'hold',tick:10,on:['start','stop','tick','death','move.done','strike.done'],
  reads:['nearestPlayer','hpShare','x','z','field','distance','random','strikeState'],commands:['move','stop','strike','field'],
  actors:{captain:'driftwood.captain'},moves:{rise:'captain.rise',sink:'captain.sink',relocate:'captain.relocate',home:'captain.home.0',homeFast:'captain.home.1',homeRage:'captain.home.2',
    stalk:'captain.stalk.0',stalkFast:'captain.stalk.1',stalkRage:'captain.stalk.2'},
  strikes:{swing:'strike.captain.swing',fast:'strike.captain.swing.1',rage:'strike.captain.swing.2',second:'strike.captain.second-cut',burst:'strike.captain.burst'},
  fields:Object.fromEntries(CAPTAIN_FIELDS.map(row=>[row.name,row.name])),params:{},timers:[],stateVersion:1,state:[{name:'resetSubt',type:'bool',default:false,scope:'binding'},{name:'resetCd',type:'f64',default:-1,min:-1,max:2,scope:'binding'}],
}] as const;

const pool=physics.captain.pool;
export const CAPTAIN_TARGETS={targets:[],spots:[{id:'captain.pool',at:[pool.x,driftwoodGroundSampler()(pool.x,pool.z),pool.z],yaw:pool.yaw%(2*Math.PI)}]};
