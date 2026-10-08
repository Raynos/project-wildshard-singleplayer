import type { MemoryReport } from '../memory-report-data.mjs';

export interface Source { path:string; sha256:string; bytes:number }
export interface TextSection { title:string; line:number; markdown:string }
export interface TableRow { line:number; cells:string[] }
export interface MarkdownTable { headers:string[]; rows:TableRow[] }
export interface Finding { rank:number; title:string; line:number; markdown:string; media:string[] }
export interface Media extends Source { url:string; kind:'image'|'video' }
export interface Playtest { id:string; source:Source; title:string; builds:string[]; markdown:string; findings:Finding[]; tables:MarkdownTable[]; media:string[]; missing:string[] }
export interface PlanRow { id:string; line:number; cells:string[] }
export interface Effort { milestone:string; total:number; done:number; left:number; percent:number; approximate:boolean; basis:string; line:number }
export interface ReportedPercent { label:string; percent:number; approximate:boolean }
export interface Plan {
  source:Source; title:string; state:string; stateLine:number;
  /** State's dated, human-reported effort figures; not inferred from source lines or old tables. */
  reportedPercent:ReportedPercent[];
  /** Historical agent-day table; use its context/date, never substitute it for State. */
  effort:{context:string; rows:Effort[]};
  milestones:TextSection[]; rows:PlanRow[]; decisions:PlanRow[];
  /** Text matches in current work/decision rows. The original cells remain the authority. */
  waitingForJake:PlanRow[];
}
export interface ItemizedBlock {side:'GPU'|'RAM';owner:string;system:string;conf:'M'|'E'|'U';bytes:number}
export interface ItemizedSituation {
  id:string;title:string;subtitle:string;pin:string;build:string;settings:string;heapSource:string;
  wcBytes:number;glBytes:number;totalBytes:number;blocks:ItemizedBlock[];
  [key:string]:unknown;
}
export interface ItemizedReport {protocol:string;situations:ItemizedSituation[]}
export type MemoryEntry = {id:string;source:Source;pins:string[];format:'sf64';data:MemoryReport} | {id:string;source:Source;pins:string[];format:'itemized';data:ItemizedReport};
export interface LoadingRun {
  shard:string;cache:'cold'|'warm';timeToPlayableMs:number;
  phases:{name:string;startMs:number;endMs:number;owner:string}[];
  longTasks:{startMs:number;durationMs:number;owner:string}[];
}
export interface LoadingReport {schema:'loading-benchmark/1';pin:string;device:string;runs:LoadingRun[];missing:string[]}
export interface AdminBundle {
  schema:'wildshard-admin/1';revision:string;
  memory:MemoryEntry[];
  loading:{status:'available'|'unavailable';reports:{source:Source;data:LoadingReport}[];missing:string[]};
  playtests:Playtest[]; plan:Plan; media:Media[];
}
