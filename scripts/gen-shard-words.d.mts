export interface ShardWords { slugs: string[]; words: string[]; sharedAssets: string[]; shards: Record<string, { name: string; ids: string[]; settings: string[]; assets: string[] }> }
export function shardWordData(root: string): ShardWords;
export function genShardWords(root?: string, check?: boolean): void;
