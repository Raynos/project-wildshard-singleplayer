import type {ShardLines, CustomSource, ConversionMeasure} from './shard-platform.mjs';
export interface CustomInventory {shard:string;measured:ConversionMeasure;parts:{name:string;lines:number}[];files:(CustomSource&{group:string;bytes:number;longestLine:number})[]}
export function customInventory(root:string,slug:string,measure:ShardLines):CustomInventory;
export function writeCustomInventories(root:string,slugs:readonly string[],date:string,revision:string):(CustomInventory&{date:string;revision:string})[];
