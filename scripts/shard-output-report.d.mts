import type {RuntimeClosure} from './shard-runtime-closure.mjs';
import type {ShardLines,PortHeadline} from './shard-platform.mjs';
import type {OutputContent} from './shard-output-content.mjs';
import type {M3Progress,GridReady,planProgress} from './shard-milestones.mjs';
import type {productScriptMetrics} from './script-scenario-metrics.mjs';
import type {netLineReport,sourceLineDelta} from './shard-net-lines.mjs';

export type OutputReportRow=RuntimeClosure&{customPercent:number|null;port:PortHeadline|null;content?:OutputContent;m3:M3Progress|null;gridReady:GridReady;scriptMetrics:ReturnType<typeof productScriptMetrics>;linesRemovedSince12Z:ReturnType<typeof sourceLineDelta>['shards'][string]|null;legacyLines?:number|null;measurementError?:string;productFailure?:string}&Partial<ShardLines>;
export function outputReport(root:string,options?:{build?:boolean;sourceProgress?:boolean;products?:string;revision?:string|null;receipts?:readonly string[];scriptReceipts?:readonly string[];reportOnly?:boolean;buildProduct?:(args:string[])=>Promise<void>}):Promise<{rows:Record<string,OutputReportRow>;measures:Record<string,ShardLines>;inventory:Record<string,ShardLines>;netLines:ReturnType<typeof netLineReport>;dailyLines:ReturnType<typeof sourceLineDelta>;progress:ReturnType<typeof planProgress>;sectionFailures:string[];productFailures:Record<string,string>;measurementError:string|null}>;
export function refreshOutputReports(root:string,measures:Record<string,ShardLines>):void;
