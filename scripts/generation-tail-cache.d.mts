/** Verify local tables after a completed, independently verified generation phase. */
export function generationTailCached(root: string, step: 'shards-before' | 'boot' | 'shards-after', run: () => unknown): Promise<boolean>;
