import type {CustomSource} from './shard-platform.mjs';

export type Component = 'C1'|'C2'|'C3'|'C4'|'C5'|'C6'|'C7'|'C8'|'C9';
export interface ComponentSpan {path:string;kind:CustomSource['kind'];component:Component;lines:number;start?:number;end?:number;reason:string}
export interface ComponentInventory {shard:string;counts:Record<Component,number>;total:number;unknown:string[];spans:ComponentSpan[]}
export interface ShardWaveRow {id:string;status:string;current:boolean;shards:{slug:string;name:string}[]}
export interface ComponentWave {id:string;status:string;current:boolean;shards:string[];names:Record<string,string>;unknown:Record<string,string[]|null>;closed:number;total:number;components:Record<Component,{closed:boolean;lines:Record<string,number|null>}>}
export const SHARD_WAVES:ShardWaveRow[];
export const COMPONENT_SHARDS:readonly string[];
export const W1_SHARDS:readonly string[];
export const COMPONENTS:Record<Component,string>;
export function componentInventory(root:string,shard:string,sources:CustomSource[],canonical:number):ComponentInventory;
export function componentWave(rows:Record<string,{components?:ComponentInventory}>,id?:string):ComponentWave;
export function componentMarkdown(rows:Record<string,{components?:ComponentInventory}>):string[];
