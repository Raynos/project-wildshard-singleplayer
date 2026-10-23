export interface DownloadSample { step?: string; declaredBytes?: string; pendingBytes?: string; downloadPercent?: string }
export function recoveredGridControls(sample: {
  readonly bootEntry?: { readonly reason?: string; readonly saved?: boolean; readonly continuing?: boolean; readonly grid?: boolean } | null;
  readonly world?: { readonly entered?: boolean; readonly paused?: boolean; readonly frameGate?: boolean } | null;
  readonly loaderVisible?: boolean; readonly title?: boolean; readonly error?: string | null;
  readonly origin?: number; readonly at?: number;
} | null): boolean;
export function requireCompiledEntry(href: string, shard: string, accuracy: { readyAt: number; errors: string[]; final: { path?: string } | null }): void;
export function downloadEvidence(samples: readonly DownloadSample[]): { measuredFrames: number; missingFrames: number; denominatorChangesAfterAdmission: number; downloadDrops: number; maxPercentError: number | null; finalDeclaredBytes: number | null };
export function transportEvidence(receipts: readonly { bodyBytes: number; decodedBodyBytes?: number | null }[]): {
  wireBodyBytes: number; networkContentBytes: number | null; unknownContentResponses: number; responses: number; expectedUnit: string; observedUnit: string;
};

/** Observe one native worker candidate; replacement, retirement and timeout refuse. */
export function waitForWaitingWorker<T extends { readonly state: ServiceWorkerState }>(registration: { readonly waiting: T | null; readonly installing: T | null }, timeoutMs?: number): Promise<T>;
