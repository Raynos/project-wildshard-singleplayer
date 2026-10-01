export interface RetryRequest { path: string; attempt: number; cut?: boolean; status?: number; bytes?: number; error?: string }
export type ChunkModules = Record<string, { name: string; moduleIds: string[] }>;
export function retryProxy(base: string, paths: readonly string[], armed?: boolean): Promise<{ arm: () => void; url: string; log: RetryRequest[]; close: () => Promise<void> }>;
export function retryChunks(modules: ChunkModules): string[];
