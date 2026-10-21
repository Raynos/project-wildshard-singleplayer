/** Disk prefetch never evicts an active working set to create room. These ports only ask for persistence and quota. */
export interface PrefetchStorage {
  persist: () => Promise<boolean>;
  estimate: () => Promise<{ usage?: number; quota?: number }>;
}
export interface PrefetchReservation {
  /** Settle once: a cache hit or failed write stores zero; a successful write reports its actual stored body bytes. */
  finish: (storedBytes: number) => void;
}
function freeBytes(estimate: { usage?: number; quota?: number }, headroom: number): number | null {
  const { usage, quota } = estimate;
  if (usage === undefined || quota === undefined || !Number.isSafeInteger(usage) || !Number.isSafeInteger(quota)
    || usage < 0 || quota <= 0) return null;
  return Math.max(0, quota - usage - headroom);
}

/** Conservative disk allowance: stale estimates cannot forget this run's writes, and concurrent requests reserve together. */
export class PrefetchQuota {
  private pending = 0;
  private spent = 0;
  private readonly storage: PrefetchStorage;
  private readonly initialFree: number;
  private readonly headroom: number;
  readonly persistent: boolean;
  private constructor(storage: PrefetchStorage, initialFree: number, headroom: number, persistent: boolean) {
    this.storage = storage; this.initialFree = initialFree; this.headroom = headroom; this.persistent = persistent;
  }

  /** Persistence denial is nonfatal. Missing quota information quietly declines new prefetch writes. */
  static async open(storage: PrefetchStorage, headroom: number): Promise<PrefetchQuota | null> {
    if (!Number.isSafeInteger(headroom) || headroom < 0) throw new Error('Invalid prefetch headroom');
    let persistent = false;
    try { persistent = await storage.persist(); } catch { /* A denied persistence request does not prevent safe bounded writes. */ }
    try {
      const available = freeBytes(await storage.estimate(), headroom);
      return available === null ? null : new PrefetchQuota(storage, available, headroom, persistent);
    } catch { return null; }
  }

  /** Call after a disk-cache probe: cached files need no reservation, even when the quota is full. */
  async reserve(bytes: number): Promise<PrefetchReservation | null> {
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid prefetch file size');
    let current: number | null;
    try { current = freeBytes(await this.storage.estimate(), this.headroom); } catch { return null; }
    if (current === null || bytes > Math.min(this.initialFree - this.spent - this.pending, current - this.pending)) return null;
    this.pending += bytes;
    const state = { finished: false };
    return { finish: (storedBytes): void => {
      if (state.finished) return;
      if (!Number.isSafeInteger(storedBytes) || storedBytes < 0 || storedBytes > bytes) throw new Error('Invalid prefetch write receipt');
      state.finished = true; this.pending -= bytes; this.spent += storedBytes;
    } };
  }
}
