export type Verdict='pass'|'fail'|'unknown';
export interface Criterion {verdict:Verdict;evidence:string}
export interface GridReady {verdict:Verdict;criteria:Record<string,Criterion>}
export interface M3Progress {basis:'source'|'output';customLines:number;legacyLines:number;target:number;mustGo:number;cut:number;fraction:number}
export const MILESTONE_SHARDS:string[];
export function readinessVerdict(criteria:Record<string,Criterion>):Verdict;
export function unknownGridReady(evidence?:string):GridReady;
export function gridReady(root:string,slug:string,products:string):GridReady;
export function m3Progress(slug:string,input:{basis:'source'|'output';customLines:number;legacyLines:number|null}):M3Progress|null;
export function planProgress(rows:Record<string,{m3:M3Progress|null;gridReady:GridReady}|undefined>):{m3:{fraction:number|null;cut:number;mustGo:number;shards:number};m2:{lower:number;upper:number;ready:number;unknown:number;total:number};plan:{lower:number;upper:number}|null};
