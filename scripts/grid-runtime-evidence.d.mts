import type {Criterion} from './shard-milestones.mjs';

export function runtimeReceiptPaths(root:string):string[];
export function runtimeGridEvidence(root:string,slug:string,revision:string|null,paths:readonly string[],caps:{explorerMB:number;loadingMB:number},keys?:{productKey?:string;runtimeKey?:string}):Partial<Record<'memory'|'oneFrameLooks'|'frameFloor',Criterion>>;
