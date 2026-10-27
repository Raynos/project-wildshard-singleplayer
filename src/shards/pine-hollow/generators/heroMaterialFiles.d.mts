import type { PineSources } from './pineSources';
/** One hero GLB (src/shards/pine-hollow/generators/heroMaterialFiles.mjs). */
export function heroModelSource(id: string, phone?: boolean): string;
/** The hero GLBs the rest shapes are cut from. */
export function heroModelSources(): string[];
/** The GPU twin tables the candidates come from, as source keys. */
export const HERO_TABLES: string[];
/** Every material payload a hero row may load. */
export function heroMaterialCandidates(sources: PineSources): string[];
/** The folders the candidates live in. */
export function heroMaterialFolders(sources: PineSources): string[];
/** Each existing payload's original URL mapped to its compacted file's product name. */
export function heroMaterialAliases(sources: PineSources): Record<string, string>;
/** The compacted payloads by product name. */
export function heroMaterialFiles(sources: PineSources): [string, Uint8Array][];
