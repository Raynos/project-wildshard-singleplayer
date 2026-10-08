export const DEFAULT_MAP_INPUTS: string[];
export const MAP_METRES: number;
export function mapSettings(shardDir: string): { inputs: string[]; hide: string[]; clipBelow: number | null };
export function mapInputs(shardDir: string): string[];
export function mapTilesHash(shardDir: string): string;
export function mapShards(repoRoot: string): { slug: string; dir: string }[];
