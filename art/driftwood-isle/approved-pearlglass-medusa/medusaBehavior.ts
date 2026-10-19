import { parseDiver } from '../../../src/format/flyers';
import type { StrikeData } from '../../../src/sdk/species';
/** Candidate uses the existing burst diver and native flight motor. No runtime registration. */
export const MEDUSA_SCALE=.35;
export const MEDUSA_FLIGHT={altitude:1.6,above:'world' as const,climbRate:1.8,diveRate:2.2,lockRange:14};
export const MEDUSA_BODY={kind:'animal',motion:'flight',attack:'unlimited',stunned:'look-hold',contact:{kind:'environment',halfArc:70*Math.PI/180}} as const;
export const MEDUSA_STRIKE:StrikeData={id:'driftwood.medusa.pulse',shape:{kind:'sphere',radius:.62},windup:.8,active:.6,recover:1.2,cooldown:3.8,range:7,damage:6,tags:['creature.pearlglass-medusa'],units:'world',weight:{kind:'constant',value:1}};
export function medusaBrain(home:{x:number;z:number;r:number;y:number}){
 return parseDiver({id:'driftwood.brain.medusa',kind:'diver',pattern:'burst',strike:MEDUSA_STRIKE.id,home,circleSpeed:.65,dartSpeed:2.5,noticeRadius:8,shoveSpeed:1.2,liftSpeed:0,targetHeight:1.2});
}
export const MEDUSA_ADMISSION={practiceOnly:true,rewards:[],stores:[],liveFlightPending:true,corpsePending:true,sharedArenaEnabled:false} as const;
