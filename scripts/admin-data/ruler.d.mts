/** One legacy shard on the ruler: custom lines ÷ frozen legacy lines (lower is better). */
export interface RulerShard {
  slug:string; name:string; wave:string; goal:number; custom:number; legacy:number; pct:number;
  grid:'pass'|'fail'|'unknown'; criteria:Record<string,string>;
}
/** A measured commit: each shard's custom % then. */
export interface RulerPoint { revision:string; at:string; basis:string; shards:Record<string,number> }
export interface RulerWaveState { id:string; startedAt:string; start:Record<string,number>; endedAt:string|null }
/** Signed platform growth is charged once against each wave's shard cut. */
export interface RulerNetLines {
  wave:string; revision:string; customCut:number|null; platformGrowth:number; netCut:number|null;
  layers:Record<string,{before:number;after:number;growth:number}>;
}
/** progress/shard-platform/ruler/ruler.json (shard-platform-ruler/1), G458 outcome-only. */
export interface Ruler {
  schema:string; command:string; revision:string; committedAt:string; measuredAt:string; basis:string;
  plan:{lower:number;upper:number};
  m3:{cut:number;mustGo:number;fraction:number};
  m2:{ready:number;fail:number;unknown:number;total:number};
  netLines?:RulerNetLines[];
  customSectionFailures?:string[];
  shards:RulerShard[]; native:string[];
  wave:{id:string;label:string;until:string|null;pct:number;shards:string[];goal:number};
  waves:RulerWaveState[]; history:RulerPoint[]; events:{at:string;label:string}[];
}
export const RULER_PATH:string;
export const RULER_CHART:string;
export const RULER_COMMAND:string;
export const RULER_SCHEMA:string;
export const SHARDS:readonly {slug:string;name:string;wave:string;goal:number}[];
export const WAVES:readonly {id:string;label:string;shards:readonly string[];goal:number;until:string|null;start:Record<string,number>|null}[];
export function wavePercent(start:Record<string,number>,now:Record<string,number>,shards:readonly string[],goal:number):number;
export function nextRuler(raw:unknown,prev:Ruler|null,at:{revision:string;committedAt:string;now:string}):Ruler;
export function readRuler(value:unknown):Ruler;
