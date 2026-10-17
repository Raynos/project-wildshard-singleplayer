import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
/** The encounter's admitted numeric observations and one-shot mechanic requests. */
export const KING_FIELDS = [
 ['mode',0],['mode-t',0],['strike-cd',2],['burst-cd',4],['summon-cd',0],['chain',0],['phase',0],['fighting',0],['request',0],['rings',0],['adds',0],['lane',0],['pose',0],['home-x',LAYOUT.KINGS_CLEARING.x],['home-z',LAYOUT.KINGS_CLEARING.z],
].map(([key,value],i)=>({id:100+i,name:`king.${String(key)}`,type:'f64' as const,privacy:'public' as const,default:Number(value),min:-10000,max:10000}));
export const KING_MOVES = [
 ...[1.2,1,.8].map((turn,i)=>({id:`king.face.${i}`,kind:'stalk',ground:true,above:0,standOff:0,speed:0,turn,ready:{kind:'over',radius:.001,height:600}})),
 {id:'king.reset',kind:'relocate',point:{kind:'fields',x:'king.home-x',z:'king.home-z'},facing:'target'},
 ...[2.3,2.8,2.3].map((speed,i)=>({id:`king.stalk.${i}`,kind:'stalk',ground:true,above:0,standOff:.9*7.1,speed,turn:1.4,
  ready:{kind:'over',radius:.9*7.1,height:600}})),
 {id:'king.lanes',kind:'stalk',ground:true,above:0,standOff:18,speed:2.4,turn:1.6,ready:{kind:'over',radius:18,height:600}},
] as const;
export const KING_BRAIN = {archetype:'decision',data:{script:'pine.king.decision',actor:'pine.antler-king',marks:{fight:'king.fighting',phase:'king.phase'},strikeEffects:[]}} as const;
export const KING_BODY = {kind:'animal',motion:'ground',attack:'keeper',stunned:'none',contact:{kind:'actor',move:'king.contact',halfArc:Math.PI},
 actions:{stateKey:'king.pose',states:['sidestep'],actions:[]}} as const;
export const KING_DECISION = [{id:'pine.king.decision',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/king.as',binding:{shard:true},pages:1,onFail:'hold',tick:10,
 on:['start','stop','tick','threshold','death','move.done'],reads:['nearestPlayer','distance','field','moving'],commands:['move','stop','field'],
 actors:{king:'pine.antler-king'},moves:{face:'king.face.0',faceCall:'king.face.1',faceOpen:'king.face.2',reset:'king.reset',stalk:'king.stalk.0',stalkFast:'king.stalk.1',stalkLast:'king.stalk.2',lanes:'king.lanes'},
 fields:Object.fromEntries(KING_FIELDS.map(row=>[row.name.slice(5),row.name])),params:{},timers:[],stateVersion:1,state:[{name:'wasLane',type:'bool',default:false,scope:'binding'},...['mode','modeT','strikeCd','burstCd','summonCd','chain'].map(name=>({name,type:'f64',default:0,min:-10000,max:10000,scope:'binding'}))],
}] as const;
