import type { ShardGenerationJob } from './generate.mjs';
import type { CleanRoomReport } from './generation-clean-room.mjs';
/** A tracked predecessor output, its retained owner and its unchanged SHA256. */
export interface GenerationRemoval {file:string;job:string;shard:string;expected:string}
/** All affected shard jobs are rehearsed cold so a component cannot substitute for its complete product. */
export interface GenerationRemovalPlan {outputs:GenerationRemoval[];shards:string[];jobIds:string[]}
/** Refuse unpinned, replaced, unowned or product-less tracked catalogue output deletions. */
export function planGenerationRemovals(before:readonly ShardGenerationJob[],after:readonly ShardGenerationJob[],deleted:readonly string[],previousHash:(file:string)=>string):GenerationRemovalPlan;
/** Check a fresh exact staged-tree product and its deleted outputs; report-only component matches do not suffice. */
export function assertGenerationRemovalProof(plan:GenerationRemovalPlan,report:CleanRoomReport,pin:string):void;
