export interface ShardLayout { requiredFiles: string[]; allowedFiles: string[]; folders: string[]; shardfileRequiredFiles?: string[]; dataHomes?: Record<string, string>; legacy: Record<string, { entries: string[]; missing: string[] }> }
export function checkShardLayout(entries: Record<string, string[]>, config: ShardLayout, readManifest?: (file: string) => string, runtimeBaseline?: Record<string, number>, frozen?: { shards: Readonly<Record<string, { primary: string }>> }): string[];
export function shardEntries(paths: string[], selected?: Set<string>, homes?: readonly string[]): Record<string, string[]>;
export function checkShards(root: string, selected?: Set<string>): string[];
