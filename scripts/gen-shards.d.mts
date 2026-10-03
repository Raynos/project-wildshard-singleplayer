export function shardFolders(root: string): string[];
export function shardSource(root: string): string;
export function manifestClosure(root: string): Record<string, string[]>;
export function genShards(root?: string, check?: boolean, initializeMissing?: boolean, shard?: string): void;
export function manifestContract(root: string, closure: Record<string, string[]>, fields?: boolean): string[];
