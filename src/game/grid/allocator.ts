/**
 * The one residency allocator (SHARD-PLATFORM SF18b, A18): every resident thing the grid keeps (render tiles and far
 * proxies, shard libraries, the commons, whole sims) is charged here through the SF22a cost model
 * (`@wildshard/engine/core/contentCost`) against the §3.2 playing envelope. Owners: the render rings reserve `l0` / `l1` /
 * `far`, the grid simulation registry reserves `sim:`, the shardfile loader reserves `library:` and `commons:`.
 *
 * Admission is synchronous. A claim that does not fit evicts unneeded, unheld claims farthest-first (ties by id, so the
 * same drive evicts the same things) in two phases: each candidate's owner prepares its eviction (the fallible part, such
 * as a sim's durable checkpoint) until the prepared bytes cover the shortfall; then every prepared eviction commits (which
 * cannot fail). If they never cover it, every prepared eviction aborts, nothing is evicted and the claim is refused (the
 * caller keeps what it has: a coarse tile, a soft wall). `needed` claims are never even prepared. An id already held is
 * shared (refcount), so a dependency used by several shards is charged once. Node-safe: no rendering, no timers.
 */
import { CONTENT_CAPS } from '@wildshard/engine/core/config';
import { contentCost, type ContentCostInput } from '@wildshard/engine/core/contentCost';
import { MemoryAdmission } from './memoryAdmission';

/** The cost model's categories; `library` and `sim` map onto its plural fields. */
export type ResidencyCategory = 'l0' | 'l1' | 'far' | 'library' | 'sim' | 'commons' | 'product';
/** One resident thing. `bytes` are its decoded + GPU resident bytes (MB = 10^6). */
export interface ResidencyClaim {
  readonly id: string; readonly category: ResidencyCategory; readonly bytes: number;
  /** stable instance id, or `platform` */
  readonly owner: string;
  /** metres from the camera: eviction order, farthest first */
  readonly distance: number;
  /** the readiness model needs it now: never evicted */
  readonly needed: boolean;
  /**
   * Two-phase eviction for claims with durability (sims): prepare does the fallible part and returns null when the claim
   * cannot go now; `commit` disposes it and must not fail; `abort` undoes the prepare and keeps it resident.
   */
  readonly prepareEvict?: () => ResidencyEviction | null;
  /** One-phase eviction, allowed only for claims with no durability (render tiles, proxies): disposes, never fails. */
  readonly evictSync?: () => void;
}
/** A prepared eviction: commit disposes the claim (infallible), abort keeps it. */
export interface ResidencyEviction { commit: () => void; abort: () => void }
/** A holder's handle on a claim. The last release frees the bytes. */
export interface ResidencyLease {
  readonly id: string;
  /** refresh the eviction inputs; the first holder's eviction callbacks stay */
  update: (patch: { distance?: number; needed?: boolean }) => void;
  /** protect the claim from eviction while a dependant (a fine child, an in-flight request) uses it; returns the unhold */
  hold: () => () => void;
  release: () => void;
}
/** A frozen row of the allocator's table, for traces and readouts. */
export interface ResidencyEntry { readonly id: string; readonly category: ResidencyCategory; readonly bytes: number; readonly owner: string; readonly distance: number; readonly needed: boolean; readonly refs: number; readonly holds: number }
interface Entry { id: string; category: ResidencyCategory; bytes: number; owner: string; distance: number; needed: boolean; prepare: (() => ResidencyEviction | null) | undefined; refs: number; holds: number; generation: number }

const field = { l0: 'l0', l1: 'l1', far: 'far', library: 'libraries', sim: 'sims', commons: 'commons', product: 'products' } as const;

/** One allocator per grid session. `playing` defaults to the §3.2 envelope (1.0 GB, G65). */
export class ResidencyAllocator {
  /** G216: the page's trusted Developer policy; omitted callers retain strict admission. */
  readonly memory: MemoryAdmission;
  private readonly entries_ = new Map<string, Entry>();
  private readonly totals: Record<ResidencyCategory, number> = { l0: 0, l1: 0, far: 0, library: 0, sim: 0, commons: 0, product: 0 };
  private readonly playing: number;
  private generation = 0;
  private evicting = false;
  constructor(options: { playing?: number; memory?: MemoryAdmission } = {}) {
    this.memory = options.memory ?? new MemoryAdmission();
    this.playing = options.playing ?? CONTENT_CAPS.playing;
    if (!Number.isFinite(this.playing) || this.playing <= 0) throw new RangeError('Invalid residency envelope');
  }

  /** Admit a claim, or share one already held under the same id; null when it cannot fit even after eviction. */
  reserve(claim: ResidencyClaim): ResidencyLease | null {
    if (claim.id.length === 0 || claim.owner.length === 0 || !Number.isSafeInteger(claim.bytes) || claim.bytes < 0 || !Number.isFinite(claim.distance) || claim.distance < 0) throw new RangeError('Invalid residency claim');
    if (claim.prepareEvict !== undefined && claim.evictSync !== undefined) throw new Error('A residency claim evicts in one phase or two, not both');
    if (this.evicting) throw new Error('Residency claims cannot be made from an evict callback');
    const existing = this.entries_.get(claim.id);
    if (existing !== undefined) {
      if (existing.category !== claim.category || existing.bytes !== claim.bytes) throw new Error(`Residency claim ${claim.id} changed shape`);
      existing.refs++; existing.needed ||= claim.needed; existing.distance = Math.min(existing.distance, claim.distance);
      return this.lease(existing);
    }
    if (!this.fits(claim.category, claim.bytes)) {
      this.evicting = true;
      try {
        if (!this.evictFor(claim.category, claim.bytes)) {
          const input = this.input(claim), cost = contentCost(input);
          if (!this.memory.accept({ stage: 'resident', owner: claim.owner, id: claim.id, claimedBytes: claim.bytes,
            accountedBytes: cost.accounted, playingBytes: cost.playing, loadingBytes: cost.loading,
            playingCap: this.playing, categories: input })) return null;
        }
      } finally { this.evicting = false; }
    }
    const sync = claim.evictSync;
    const prepare = claim.prepareEvict ?? (sync === undefined ? undefined : (): ResidencyEviction => ({ commit: sync, abort: () => undefined }));
    const entry: Entry = { id: claim.id, category: claim.category, bytes: claim.bytes, owner: claim.owner, distance: claim.distance, needed: claim.needed, prepare, refs: 1, holds: 0, generation: ++this.generation };
    this.entries_.set(entry.id, entry); this.totals[entry.category] += entry.bytes;
    return this.lease(entry);
  }

  /** The cost model over everything held now, decode / refinement overlap counted once. */
  cost(): { playing: number; loading: number; accounted: number; input: ContentCostInput } {
    const input = this.input(); return { ...contentCost(input), input };
  }

  /** The table in id order (deterministic traces). */
  entries(): readonly ResidencyEntry[] {
    return [...this.entries_.values()].sort((a, b) => a.id.localeCompare(b.id)).map((e) => Object.freeze({ id: e.id, category: e.category, bytes: e.bytes, owner: e.owner, distance: e.distance, needed: e.needed, refs: e.refs, holds: e.holds }));
  }

  /** True while the id is resident (held by at least one lease). */
  has(id: string): boolean { return this.entries_.has(id); }

  private input(extra?: { category: ResidencyCategory; bytes: number }): ContentCostInput {
    const t = { ...this.totals }; if (extra !== undefined) t[extra.category] += extra.bytes;
    const input: ContentCostInput = { l0: 0, l1: 0, far: 0, libraries: 0, sims: 0, commons: 0, overlap: CONTENT_CAPS.overlap };
    for (const category of Object.keys(field) as ResidencyCategory[]) input[field[category]] = t[category];
    return input;
  }
  private fits(category: ResidencyCategory, bytes: number): boolean { return contentCost(this.input({ category, bytes })).playing <= this.playing; }
  /**
   * Prepare unneeded, unheld claims farthest-first until the prepared bytes make room; commit them all, or abort them all
   * and evict nothing. Returns whether the claim now fits.
   */
  private evictFor(category: ResidencyCategory, bytes: number): boolean {
    const candidates = [...this.entries_.values()].filter((e) => !e.needed && e.holds === 0 && e.prepare !== undefined).sort((a, b) => b.distance - a.distance || a.id.localeCompare(b.id));
    const prepared: { entry: Entry; eviction: ResidencyEviction }[] = []; let freed = 0, enough = false;
    for (const entry of candidates) {
      const eviction = entry.prepare?.() ?? null; if (eviction === null) continue;
      prepared.push({ entry, eviction }); freed += entry.bytes;
      if (contentCost(this.input({ category, bytes: bytes - freed })).playing <= this.playing) { enough = true; break; }
    }
    if (!enough) { for (const { eviction } of prepared.reverse()) eviction.abort(); return false; }
    for (const { entry, eviction } of prepared) { this.drop(entry); eviction.commit(); }
    return this.fits(category, bytes);
  }
  private drop(entry: Entry): void {
    if (this.entries_.get(entry.id) !== entry) return;
    this.entries_.delete(entry.id); this.totals[entry.category] -= entry.bytes;
    this.memory.syncResidents(new Set(this.entries_.keys()), this.cost());
  }
  private lease(entry: Entry): ResidencyLease {
    let released = false;
    const live = (): boolean => !released && this.entries_.get(entry.id) === entry;
    return Object.freeze({
      id: entry.id,
      update: (patch: { distance?: number; needed?: boolean }): void => {
        if (!live()) return;
        if (patch.distance !== undefined) { if (!Number.isFinite(patch.distance) || patch.distance < 0) throw new RangeError('Invalid residency distance'); entry.distance = patch.distance; }
        if (patch.needed !== undefined) entry.needed = patch.needed;
      },
      hold: (): (() => void) => {
        if (!live()) return () => undefined;
        entry.holds++; let held = true;
        return () => { if (held) { held = false; entry.holds--; } };
      },
      release: (): void => {
        if (released) return; released = true;
        if (this.entries_.get(entry.id) !== entry) return;
        if (--entry.refs === 0) this.drop(entry);
      },
    });
  }
}
