import type { PineSources } from './pineSources';
/** One hero GLB (src/shards/pine-hollow/generators/heroMaterialFiles.mjs). */
export function heroModelSource(id: string, phone?: boolean): string;
/** The hero GLBs the rest shapes are cut from. */
export function heroModelSources(): string[];
/** The GPU twin tables the candidates come from, as source keys. */
export const HERO_TABLES: string[];
/** The GPU twin tables (desktop / phone KTX2 twins and the phone ASTC6 table) read from the sources. */
export function gpuTables(sources: PineSources): { gpu: { desktop: Record<string, string>; phone: Record<string, string> }; astc: Record<string, string> };
/** Every material payload a hero row may load. */
export function heroMaterialCandidates(sources: PineSources): string[];
/** The folders the candidates live in. */
export function heroMaterialFolders(sources: PineSources): string[];
/** Each existing payload's original URL mapped to its compacted file's product name. */
export function heroMaterialAliases(sources: PineSources): Record<string, string>;
/** The compacted payloads by product name, each with the device tier that fetches it and the model it is a variant of. */
export function heroMaterialFiles(sources: PineSources): [string, Uint8Array, 'phone' | 'desktop' | undefined, string][];
/** The model a material payload is one texture-mode variant of. */
export function materialVariantOf(url: string): string;
/** The device tier a material payload serves (absent: both). */
export function materialTier(sources: PineSources, url: string): 'phone' | 'desktop' | undefined;
