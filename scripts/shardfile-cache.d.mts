export const KEY_FILE: string;
export function readBuildKey(directory: string): string;
export function shardfileCacheRoot(env?: NodeJS.ProcessEnv): string;
/** Every candidate input file under root with its content hash (stat-memoized). */
export function treeHashes(root: string): Map<string, string>;
/** The content key of one shard's product. */
export function shardfileKey(files: Map<string, string>, slug: string, built: string[], args: string[]): string;
export function reuseOrBuild(job: { slug: string; key: string; destination: string; cacheRoot?: string; fresh?: boolean; build: (out: string) => Promise<void> }): Promise<'slot' | 'cache' | 'built'>;

export function publishProduct(from: string, to: string): void;
