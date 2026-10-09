export const DEFAULT_MAP_INPUTS: string[];
export const MAP_METRES: number;
export function mapSettings(shardDir: string): { inputs: string[]; hide: string[]; heightHide: string[]; keep: string[]; hideStanding: string[]; clipBelow: number | null; clipAbove: number | null; style: ({ kind: string } & Record<string, unknown>) | null };
export function mapInputs(shardDir: string): string[];
export function mapTilesHash(shardDir: string): string;
export function mapShards(repoRoot: string): { slug: string; dir: string }[];
