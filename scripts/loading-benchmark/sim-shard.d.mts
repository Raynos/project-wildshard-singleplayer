export interface DownloadSample { step?: string; declaredBytes?: string; pendingBytes?: string; downloadPercent?: string }
export function requireCompiledEntry(href: string, shard: string, accuracy: { readyAt: number; errors: string[]; final: { path?: string } | null }): void;
export function downloadEvidence(samples: readonly DownloadSample[]): { measuredFrames: number; missingFrames: number; denominatorChangesAfterAdmission: number; downloadDrops: number; maxPercentError: number | null; finalDeclaredBytes: number | null };
