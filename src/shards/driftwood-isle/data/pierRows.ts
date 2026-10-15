/** Shared authored defaults for the three existing Explorer variants. */
import type { PierParams } from '../assets/contracts/pier';

export const PENNANT_WIND = [-0.55,0.83] as const;
export const PIER_DEFAULTS: PierParams = {length:30,width:3,pileDepth:8,landing:null,pennantDir:PENNANT_WIND};
export const PIER_VARIANTS = [
 {id:'jetty',label:'Jetty',params:{}},
 {id:'long',label:'Long jetty',params:{length:60,width:4}},
 {id:'landing',label:'With landing',params:{length:36,width:4,landing:{rampFrom:30.5,landY:-0.8,postGround:[-0.8,-0.8]}}},
] satisfies readonly {id:string;label:string;params:Partial<PierParams>}[];
