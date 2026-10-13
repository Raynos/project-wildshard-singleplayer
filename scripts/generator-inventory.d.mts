import type { ShardLines } from './shard-platform.mjs';

/** One declared explorer entry, retaining its registration and defining source. */
export interface GeneratorEntry {shard:string;explorer:'Model'|'Set'|'World';id:string;name:string;source:string;lines:number;status:'generator in shard folder'|'legacy three.js builder'|'runtime-in-Node bake';owner:string;registry:string}
export interface GeneratorTotal {shard:string;ported:number;left:number;portedLines:number;leftLines:number;explorers:Record<'Model'|'Set'|'World',number>}
export interface GeneratorInventory {rows:GeneratorEntry[];totals:GeneratorTotal[];gaps:string[]}
export const GENERATOR_INVENTORY:'docs/plans/shard-platform/generator-inventory.md';
export function generatorInventory(root:string):GeneratorInventory;
export function writeGeneratorInventory(root:string,measures?:Record<string,ShardLines>):GeneratorInventory;
