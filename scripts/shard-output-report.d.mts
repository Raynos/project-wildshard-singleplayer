import type {RuntimeClosure} from './shard-runtime-closure.mjs';
import type {ShardLines,PortHeadline} from './shard-platform.mjs';
import type {OutputContent} from './shard-output-content.mjs';
import type {M3Progress,GridReady,planProgress} from './shard-milestones.mjs';

export type OutputReportRow=RuntimeClosure&{customPercent:number|null;port:PortHeadline|null;content?:OutputContent;m3:M3Progress|null;gridReady:GridReady}&Partial<ShardLines>;
export function outputReport(root:string,options?:{build?:boolean;products?:string}):Promise<{rows:Record<string,OutputReportRow>;measures:Record<string,ShardLines>;progress:ReturnType<typeof planProgress>;failures:string[]}>;
export function refreshOutputReports(root:string,measures:Record<string,ShardLines>):void;
