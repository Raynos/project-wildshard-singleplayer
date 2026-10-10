import type { AuthoringAudit } from './authoring-inputs.mjs';
/** A job reports exact bytes only after a cold producer really ran without trusted source directories. */
export interface CleanRoomJob {id:string;entry:string;status:'blocked'|'matched'|'different'|'failed';reasons:string[];outputs:{file:string;expected:string|null;generated:string|null;exact:boolean}[]}
/** Report-only migration evidence; unsupported shardfile producers are explicit rather than implied by asset matches. */
export interface CleanRoomReport {schema:'generation-clean-room/1';pin:string;reportOnly:true;platform:string;arch:string;node:string;removed:string[];jobs:CleanRoomJob[];unregistered:string[];sourceProbes:(AuthoringAudit & {shard:string})[];shardfiles:{shard:string;status:'matched'|'unavailable';reason:string}[]}
/** Build a temporary pinned archive, delete its runtime/legacy/generated outputs, and use a fresh isolated cache. */
export function cleanRoomGeneration(root:string,options:{pin:string;onUpdate?:(report:CleanRoomReport)=>void}):Promise<CleanRoomReport>;
