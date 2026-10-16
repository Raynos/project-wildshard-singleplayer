import type {RuntimeClosure} from './shard-runtime-closure.mjs';
import type {ShardLines,PortHeadline} from './shard-platform.mjs';
import type {OutputContent} from './shard-output-content.mjs';

export type OutputReportRow=RuntimeClosure&{customPercent:number|null;port:PortHeadline|null;content?:OutputContent}&Partial<ShardLines>;
export function outputReport(root:string,options?:{build?:boolean;products?:string}):Promise<{rows:Record<string,OutputReportRow>;measures:Record<string,ShardLines>;failures:string[]}>;
export function refreshOutputReports(root:string,measures:Record<string,ShardLines>):void;
