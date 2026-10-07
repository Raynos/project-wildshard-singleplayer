import { CONTENT_CAPS } from '@wildshard/engine/core/config';
import type { ContentCostInput } from '@wildshard/engine/core/contentCost';

/** A measured opaque runtime retains both rulers and the evidence used to derive its full claim. All bytes are decimal. */
export interface AdmissionMeasurement {
  readonly webContentBytes: number; readonly glBytes: number; readonly engineBaseBytes: number;
  readonly rev: string; readonly device: string; readonly evidence: string;
}
/** Trusted callers report only the total-memory envelope here. Parser, hash, script and content-understatement guards are separate. */
export interface MemoryAdmissionRequest {
  readonly stage: 'runtime' | 'declared' | 'actual' | 'resident';
  readonly owner: string; readonly id: string;
  readonly claimedBytes: number; readonly accountedBytes: number;
  readonly playingBytes: number; readonly loadingBytes: number;
  readonly playingCap?: number; readonly loadingCap?: number;
  readonly categories?: Readonly<ContentCostInput>;
  readonly measured?: AdmissionMeasurement;
}
/** G216's visible warning / G217 loading-screen read port: full claims and original caps, never a discounted allocation. */
export interface MemoryAdmissionWarning extends MemoryAdmissionRequest {
  readonly playingCap: number; readonly loadingCap: number;
  readonly playingOverBytes: number; readonly loadingOverBytes: number;
}

/**
 * G216: Developer may exceed the total memory envelope while keeping truthful accounting. Public callers still refuse.
 * The root supplies the live Settings Developer reader; pure Node and author validation default to strict. No DOM,
 * timers, world allocation or service installation occurs here. Warnings are bounded and leave with their page owner.
 */
export class MemoryAdmission {
  private readonly warnings = new Map<string, MemoryAdmissionWarning>();
  private readonly listeners = new Set<() => void>();
  private readonly developer: () => boolean;
  constructor(developer: () => boolean = () => false) { this.developer = developer; }

  /** True for an in-envelope request or a Developer override. False means the caller retains its original refusal path. */
  accept(request: MemoryAdmissionRequest): boolean {
    const playingCap = request.playingCap ?? CONTENT_CAPS.playing, loadingCap = request.loadingCap ?? CONTENT_CAPS.loading;
    if (request.owner.length === 0 || request.id.length === 0 || ![request.claimedBytes, request.accountedBytes, request.playingBytes, request.loadingBytes].every(value => Number.isSafeInteger(value) && value >= 0)
      || ![playingCap, loadingCap].every(value => Number.isFinite(value) && value > 0)) throw new RangeError('Invalid memory admission report');
    const key = `${request.stage}:${request.owner}`;
    const playingOverBytes = Math.max(0, request.playingBytes - playingCap), loadingOverBytes = Math.max(0, request.loadingBytes - loadingCap);
    if (playingOverBytes === 0 && loadingOverBytes === 0) { if (this.warnings.delete(key)) this.notify(); return true; }
    if (!this.developer()) return false;
    const warning = Object.freeze({ ...request, playingCap, loadingCap, playingOverBytes, loadingOverBytes,
      ...(request.categories === undefined ? {} : { categories: Object.freeze({ ...request.categories }) }),
      ...(request.measured === undefined ? {} : { measured: Object.freeze({ ...request.measured }) }),
    });
    this.warnings.delete(key); this.warnings.set(key, warning);
    if (this.warnings.size > 64) {
      const oldest = this.warnings.keys().next().value; if (oldest !== undefined) this.warnings.delete(oldest);
    }
    this.notify(); return true;
  }
  /** Frozen reports in arrival order. The newest resident report includes the full page's category totals. */
  reports(): readonly MemoryAdmissionWarning[] { return Object.freeze([...this.warnings.values()]); }
  /** Scope-owned warning surfaces subscribe, then read reports. Existing pre-bootstrap warnings paint immediately. */
  subscribe(read: () => void): () => void { this.listeners.add(read); read(); return () => { this.listeners.delete(read); }; }
  /** Remove warnings for released resident claims after the total falls back under the envelope. */
  clearResidents(): void { let changed = false; for (const [key, row] of this.warnings) if (row.stage === 'resident') { this.warnings.delete(key); changed = true; } if (changed) this.notify(); }
  /** Released claims stop warning; retained claims report the current full page total even while it remains over cap. */
  syncResidents(ids: ReadonlySet<string>, cost: { accounted: number; playing: number; loading: number; input: ContentCostInput }): void {
    let changed = false;
    for (const [key, row] of this.warnings) {
      if (row.stage !== 'resident') continue;
      const playingOverBytes = Math.max(0, cost.playing - row.playingCap), loadingOverBytes = Math.max(0, cost.loading - row.loadingCap);
      if (!ids.has(row.id) || playingOverBytes + loadingOverBytes === 0) { this.warnings.delete(key); changed = true; continue; }
      if (row.accountedBytes === cost.accounted) continue;
      this.warnings.set(key, Object.freeze({ ...row, accountedBytes: cost.accounted, playingBytes: cost.playing,
        loadingBytes: cost.loading, playingOverBytes, loadingOverBytes, categories: Object.freeze({ ...cost.input }) })); changed = true;
    }
    if (changed) this.notify();
  }
  /** Page disposal forgets every warning and listener; no later admission resurrects a UI subscription. */
  dispose(): void { this.warnings.clear(); this.listeners.clear(); }
  private notify(): void { for (const read of this.listeners) read(); }
}
