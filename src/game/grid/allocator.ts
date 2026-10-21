/**
 * The one residency allocator (SHARD-PLATFORM SF18b, A18): every resident thing the grid keeps (render tiles and far
 * proxies, shard libraries, the commons, whole sims) is charged here through the SF22a cost model
 * (`@wildshard/engine/core/contentCost`) against the §3.2 playing envelope. Owners: the render rings reserve `l0` / `l1` /
 * `far`, the grid simulation registry reserves `sim:`, the shardfile loader reserves `library:` and `commons:`.
 *
 * Admission is synchronous. A claim that does not fit evicts unneeded, unheld claims farthest-first (ties by id, so the
 * same drive evicts the same things) in two phases: each candidate's owner prepares its eviction (the fallible part, such
 * as a sim's durable checkpoint) until the prepared bytes cover the shortfall; then every prepared eviction commits (which
 * cannot fail). If they never cover it, every prepared eviction aborts and nothing is evicted. G556: the envelope is only
 * the eviction target; the limits are per shard, so the claim is then judged by its owner alone ({@link shardCost}) and
 * refused only when that owner is over them (the caller keeps what it has: a coarse tile, a soft wall). `needed` claims are never even prepared. An id already held is
 * shared (refcount), so a dependency used by several shards is charged once. Node-safe: no rendering, no timers.
 */
import { CONTENT_CAPS } from '@wildshard/engine/core/config';
import { contentCost, type ContentCostInput } from '@wildshard/format/contentCost';
import { MemoryAdmission } from '@wildshard/format/product';

/** The cost model's categories; `library` and `sim` map onto its plural fields. */
/** `near`: G342's near-placeholder views, on their own residency line. */
export type ResidencyCategory = 'l0' | 'l1' | 'far' | 'near' | 'library' | 'sim' | 'commons' | 'product' | 'page';
/** One resident thing. `bytes` are its decoded + GPU resident bytes (MB = 10^6). */
export interface ResidencyClaim {
  readonly id: string; readonly category: ResidencyCategory; readonly bytes: number;
  /** stable instance id, or `platform` */
  readonly owner: string;
  /** metres from the camera: eviction order, farthest first */
  readonly distance: number;
  /** the readiness model needs it now: never evicted */
  readonly needed: boolean;
  /** Shared bytes already included in this live whole-runtime claim (a retained commons cache, or a page component inside a
   * measured whole-page home). Retirement makes them independently charged. */
  readonly coveredBy?: string;
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
  /** Reduce an owned allocation after its buffers are released; growth requires ordinary admission. */
  shrink: (bytes: number) => void;
  /** refresh the eviction inputs; the first holder's eviction callbacks stay */
  update: (patch: { distance?: number; needed?: boolean; coveredBy?: string | null }) => void;
  /** protect the claim from eviction while a dependant (a fine child, an in-flight request) uses it; returns the unhold */
  hold: () => () => void;
  release: () => void;
}
/** A frozen row of the allocator's table, for traces and readouts. */
export interface ResidencyEntry { readonly id: string; readonly category: ResidencyCategory; readonly bytes: number; readonly owner: string; readonly distance: number; readonly needed: boolean; readonly refs: number; readonly holds: number; readonly accountedBytes: number; readonly coveredBy?: string }
interface Entry { id: string; category: ResidencyCategory; bytes: number; owner: string; distance: number; needed: boolean; prepare: (() => ResidencyEviction | null) | undefined; refs: number; holds: number; generation: number; coveredBy: string | undefined; baseCredit: number }
interface Coverage { bytes: number; commons: number; page: number; credit: number; children: Set<Entry> }

const field = { l0: 'l0', l1: 'l1', far: 'far', near: 'near', library: 'libraries', sim: 'sims', commons: 'commons', product: 'products', page: 'page' } as const;

/** G556: one owner alone on the cost model (the page's engine base, shared renderer components and overlap, plus its own
 * accounted bytes at the resident factor). The playing / loading limits apply to this, never to the page total. */
export function shardCost(accounted: number, page: ContentCostInput): { playing: number; loading: number; accounted: number } {
  return contentCost({ l0: 0, l1: 0, far: 0, libraries: 0, sims: 0, commons: 0, products: accounted, overlap: page.overlap,
    page: page.page ?? 0, ...(page.engineBase === undefined ? {} : { engineBase: page.engineBase }) });
}

/** One allocator per grid session. `playing` defaults to the §3.2 envelope (1.0 GB, G65). */
export class ResidencyAllocator {
  /** G216: the page's trusted Developer policy; omitted callers retain strict admission. */
  readonly memory: MemoryAdmission;
  private readonly entries_ = new Map<string, Entry>();
  private orderedEntries: readonly Entry[] | null = null;
  private readonly entrySnapshots = new WeakMap<Entry, ResidencyEntry>();
  /** Sim claims whose bytes are a measured whole page or matched runtime increment, the only claims a page component may be covered by. */
  private readonly measured = new Set<string>();
  private readonly totals: Record<ResidencyCategory, number> = { l0: 0, l1: 0, far: 0, near: 0, library: 0, sim: 0, commons: 0, product: 0, page: 0 };
  private credit = 0;
  private nearCount = 0;
  private readonly coverage = new Map<string, Coverage>();
  private readonly evictable = new Set<Entry>();
  private evictionOrder: Entry[] | null = null;

  private readonly playing: number;
  private generation = 0;
  private evicting = false;
  constructor(options: { playing?: number; memory?: MemoryAdmission } = {}) {
    this.memory = options.memory ?? new MemoryAdmission();
    this.playing = options.playing ?? CONTENT_CAPS.playing;
    if (!Number.isFinite(this.playing) || this.playing <= 0) throw new RangeError('Invalid residency envelope');
  }

  /** Admit a claim, or share one already held under the same id; null when it cannot fit even after eviction. */
  reserve(claim: ResidencyClaim): ResidencyLease | null { return this.reserveClaim(claim, 0); }

  /** Split an evidenced renderer component out of the fixed engine baseline. Only the calibrated credit is removed;
   * larger current allocations increase the envelope, and the component remains a visible page-owned claim.
   * `coveredBy` names a measured whole-page home claim that already contains this component (SF57): while it lives, the
   * component charges nothing and returns its calibration credit, since that home's reading subtracted the same base. */
  reservePageComponent(id: string, bytes: number, calibratedCredit: number, coveredBy?: string): ResidencyLease | null {
    if (!Number.isSafeInteger(calibratedCredit) || calibratedCredit < 0 || calibratedCredit > CONTENT_CAPS.engineBase) throw new RangeError('Invalid engine calibration');
    const claim: ResidencyClaim & { baseCredit: number } = { id, category: 'page', bytes, owner: 'platform', needed: true, distance: 0, baseCredit: Math.min(bytes, calibratedCredit), ...(coveredBy === undefined ? {} : { coveredBy }) };
    const existing = this.entries_.get(id);
    if (existing === undefined) return this.reserveClaim(claim, claim.baseCredit);
    if (this.evicting || existing.category !== 'page' || !Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid page component replacement');
    this.validateCoverage(id, 'page', bytes, coveredBy);
    this.input(claim, new Set([id])); // validates the calibration; a shared page component is never refused on the page total (G556)
    this.track(existing, -1);
    existing.bytes = bytes; existing.baseCredit = claim.baseCredit; existing.coveredBy = coveredBy; existing.refs++;
    this.track(existing, 1);
    return this.lease(existing);
  }

  private reserveClaim(claim: ResidencyClaim, baseCredit: number): ResidencyLease | null {
    if (claim.id.length === 0 || claim.owner.length === 0 || !Number.isSafeInteger(claim.bytes) || claim.bytes < 0 || !Number.isFinite(claim.distance) || claim.distance < 0) throw new RangeError('Invalid residency claim');
    if (claim.prepareEvict !== undefined && claim.evictSync !== undefined) throw new Error('A residency claim evicts in one phase or two, not both');
    if (this.evicting) throw new Error('Residency claims cannot be made from an evict callback');
    this.validateCoverage(claim.id, claim.category, claim.bytes, claim.coveredBy);
    const existing = this.entries_.get(claim.id);
    if (existing !== undefined) {
      if (existing.category !== claim.category || existing.bytes !== claim.bytes || existing.baseCredit !== baseCredit) throw new Error(`Residency claim ${claim.id} changed shape`);
      existing.refs++; existing.needed ||= claim.needed; existing.distance = Math.min(existing.distance, claim.distance);
      this.refreshEviction(existing);
      return this.lease(existing);
    }
    const extra = { ...claim, baseCredit };
    if (!this.fits(extra)) {
      this.evicting = true;
      try {
        if (!this.evictFor(extra)) {
          const input = this.input(extra), cost = shardCost((this.ownerBytes().get(claim.owner) ?? 0) + (extra.category === 'page' ? 0 : this.effectiveBytes(extra)), input);
          if (!this.memory.accept({ stage: 'resident', owner: claim.owner, id: claim.id, claimedBytes: claim.bytes,
            accountedBytes: cost.accounted, playingBytes: cost.playing, loadingBytes: cost.loading,
            playingCap: this.playing, categories: input })) return null;
        }
      } finally { this.evicting = false; }
    }
    const sync = claim.evictSync;
    const prepare = claim.prepareEvict ?? (sync === undefined ? undefined : (): ResidencyEviction => ({ commit: sync, abort: () => undefined }));
    const entry: Entry = { id: claim.id, category: claim.category, bytes: claim.bytes, owner: claim.owner, distance: claim.distance, needed: claim.needed, prepare, refs: 1, holds: 0, generation: ++this.generation, coveredBy: claim.coveredBy, baseCredit };
    const children = this.coverage.get(entry.id);
    if (children !== undefined) this.adjustCoverage(children, -1);
    this.entries_.set(entry.id, entry); this.orderedEntries = null; this.track(entry, 1); this.refreshEviction(entry);
    return this.lease(entry);
  }

  /** Each owner's accounted bytes, shared page components excluded (they are in every owner's {@link shardCost}). */
  private ownerBytes(): Map<string, number> {
    const bytes = new Map<string, number>();
    for (const entry of this.entries_.values()) if (entry.category !== 'page') bytes.set(entry.owner, (bytes.get(entry.owner) ?? 0) + this.effectiveBytes(entry));
    return bytes;
  }
  /** Re-judge the retained resident warnings, each by its owner alone (G556). */
  private syncResidents(): void {
    const input = this.input(); // validates the page calibration even with no warning to re-judge
    if (!this.memory.hasResidentWarnings) return;
    const owners = this.ownerBytes();
    this.memory.syncResidents(new Set(this.entries_.keys()), owner => ({ ...shardCost(owners.get(owner) ?? 0, input), input }));
  }

  /** The cost model over everything held now, decode / refinement overlap counted once. */
  cost(): { playing: number; loading: number; accounted: number; input: ContentCostInput } {
    const input = this.input(); return { ...contentCost(input), input };
  }

  /** O14: every held claim's id, owner and bytes in admission order, unsorted and unsnapshotted: for per-tick totals (the
   * cell screens' claimed bytes) that `entries()` re-sorted and froze for every row while a cell's claims came and went. */
  claims(): IterableIterator<Readonly<Pick<ResidencyEntry, 'id' | 'owner' | 'bytes'>>> { return this.entries_.values(); }

  /** The table in id order (deterministic traces). Membership alone changes the order;
   * unchanged rows reuse their frozen snapshot, without retaining departed claims. */
  entries(): readonly ResidencyEntry[] {
    const ordered = this.orderedEntries ??= [...this.entries_.values()].sort((a, b) => a.id.localeCompare(b.id));
    return ordered.map(entry => {
      const before = this.entrySnapshots.get(entry), accountedBytes = this.effectiveBytes(entry);
      if (before !== undefined && before.bytes === entry.bytes && before.distance === entry.distance
        && before.needed === entry.needed && before.refs === entry.refs && before.holds === entry.holds
        && before.coveredBy === entry.coveredBy && before.accountedBytes === accountedBytes) return before;
      const snapshot = Object.freeze({ id: entry.id, category: entry.category, bytes: entry.bytes, owner: entry.owner,
        distance: entry.distance, needed: entry.needed, refs: entry.refs, holds: entry.holds, accountedBytes,
        ...(entry.coveredBy === undefined ? {} : { coveredBy: entry.coveredBy }) });
      this.entrySnapshots.set(entry, snapshot);
      return snapshot;
    });
  }

  /** SF57 / G258: mark a live sim claim as a reviewed measured whole-page reading or matched pre-entry runtime
   * increment, so only page components actually inside that reading may be covered by it. Components subtracted as
   * part of the resident baseline stay independently charged. An estimated or declared claim is never marked. */
  markMeasuredPage(id: string): void {
    const entry = this.entries_.get(id);
    if (entry?.category !== 'sim' || entry.coveredBy !== undefined) throw new Error('Only a live sim claim can be a measured whole page');
    this.measured.add(id);
  }

  /** True while the id is resident (held by at least one lease). */
  has(id: string): boolean { return this.entries_.has(id); }

  /** Remaining bytes of an existing sim's coverage, optionally replacing one child's allocation. */
  coverageRemaining(id: string, replacing?: string): number | null {
    const parent = this.entries_.get(id);
    if (parent?.category !== 'sim') return null;
    const previous = replacing === undefined ? undefined : this.entries_.get(replacing);
    return parent.bytes - (this.coverage.get(id)?.bytes ?? 0) + (previous?.coveredBy === id ? previous.bytes : 0);
  }

  private covered(entry: { coveredBy?: string | undefined }, omitted?: ReadonlySet<string>): boolean {
    return entry.coveredBy !== undefined && omitted?.has(entry.coveredBy) !== true && this.entries_.has(entry.coveredBy);
  }
  private effectiveBytes(entry: { bytes: number; coveredBy?: string | undefined }, omitted?: ReadonlySet<string>): number {
    return this.covered(entry, omitted) ? 0 : entry.bytes;
  }
  private validateCoverage(id: string, category: ResidencyCategory, bytes: number, covering: string | undefined): void {
    if (covering === undefined) return;
    const parent = this.entries_.get(covering);
    // Only a measured whole runtime (a `sim` claim) can contain other bytes: retained commons, or page components (SF57).
    if ((category !== 'commons' && category !== 'page') || parent?.category !== 'sim' || parent.coveredBy !== undefined || id === covering) throw new Error('Invalid runtime cache coverage');
    if (category === 'page' && !this.measured.has(covering)) throw new Error('Page coverage requires a measured whole-page claim');
    const remaining = this.coverageRemaining(covering, id);
    if (remaining === null || bytes > remaining) throw new Error('Runtime cache coverage exceeds its measured bytes');
  }
  private adjustCoverage(group: Coverage, sign: number): void {
    this.totals.commons += sign * group.commons; this.totals.page += sign * group.page; this.credit += sign * group.credit;
  }
  private track(entry: Entry, sign: 1 | -1): void {
    if (!this.covered(entry)) {
      this.totals[entry.category] += sign * entry.bytes;
      if (entry.category === 'page') this.credit += sign * entry.baseCredit;
    }
    if (entry.category === 'near') this.nearCount += sign;
    const covering = entry.coveredBy;
    if (covering === undefined) return;
    let group = this.coverage.get(covering);
    if (group === undefined) { group = { bytes: 0, commons: 0, page: 0, credit: 0, children: new Set() }; this.coverage.set(covering, group); }
    if (sign === 1) group.children.add(entry); else group.children.delete(entry);
    group.bytes += sign * entry.bytes;
    if (entry.category === 'page') { group.page += sign * entry.bytes; group.credit += sign * entry.baseCredit; }
    else group.commons += sign * entry.bytes;
    if (group.children.size === 0) this.coverage.delete(covering);
  }
  private refreshEviction(entry: Entry): void {
    // Only eligible claims enter the sorted index; distance/needed/hold changes invalidate its snapshot.
    if (this.entries_.get(entry.id) === entry && !entry.needed && entry.holds === 0 && entry.prepare !== undefined) {
      this.evictable.add(entry); this.evictionOrder = null;
    } else if (this.evictable.delete(entry)) this.evictionOrder = null;
  }
  private input(extra?: ResidencyClaim & { baseCredit: number }, omitted?: ReadonlySet<string>): ContentCostInput {
    const input: ContentCostInput = { l0: this.totals.l0, l1: this.totals.l1, far: this.totals.far, libraries: this.totals.library,
      sims: this.totals.sim, commons: this.totals.commons, products: this.totals.product, overlap: CONTENT_CAPS.overlap };
    let credit = this.credit, page = this.totals.page, near = this.totals.near, nearCount = this.nearCount;
    if (omitted !== undefined) for (const id of omitted) {
      const e = this.entries_.get(id);
      if (e === undefined) continue;
      if (e.category === 'near') nearCount--;
      if (!this.covered(e)) {
        if (e.category === 'page') { page -= e.bytes; credit -= e.baseCredit; }
        else if (e.category === 'near') near -= e.bytes;
        else { const key = field[e.category]; input[key] = (input[key] ?? 0) - e.bytes; }
      }
      // Removing a parent exposes only surviving children; omitted covered children contributed zero already.
      const group = this.coverage.get(id);
      if (group !== undefined) for (const child of group.children) if (!omitted.has(child.id)) {
        if (child.category === 'page') { page += child.bytes; credit += child.baseCredit; }
        else input.commons += child.bytes;
      }
    }
    if (extra !== undefined) {
      if (extra.category === 'page') { if (!this.covered(extra, omitted)) { page += extra.bytes; credit += extra.baseCredit; } }
      else if (extra.category === 'near') { nearCount++; near += extra.bytes; }
      else { const key = field[extra.category]; input[key] = (input[key] ?? 0) + this.effectiveBytes(extra, omitted); }
    }
    if (nearCount > 0) input.near = near;
    if (credit > CONTENT_CAPS.engineBase) throw new Error('Page calibration exceeds the engine baseline');
    if (page > 0) { input.page = page; input.engineBase = CONTENT_CAPS.engineBase - credit; }
    return input;
  }
  private fits(extra: ResidencyClaim & { baseCredit: number }): boolean { return contentCost(this.input(extra)).playing <= this.playing; }
  /**
   * Prepare unneeded, unheld claims farthest-first until the prepared bytes make room; commit them all, or abort them all
   * and evict nothing. Returns whether the claim now fits.
   */
  private evictFor(extra: ResidencyClaim & { baseCredit: number }): boolean {
    const candidates = this.evictionOrder ??= [...this.evictable].sort((a, b) => b.distance - a.distance || a.id.localeCompare(b.id));
    const prepared: { entry: Entry; eviction: ResidencyEviction }[] = []; const omitted = new Set<string>(); let enough = false;
    for (const entry of candidates) {
      const eviction = entry.prepare?.() ?? null; if (eviction === null) continue;
      prepared.push({ entry, eviction }); omitted.add(entry.id);
      if (contentCost(this.input(extra, omitted)).playing <= this.playing) { enough = true; break; }
    }
    if (!enough) { for (const { eviction } of prepared.reverse()) eviction.abort(); return false; }
    for (const { entry, eviction } of prepared) { this.drop(entry); eviction.commit(); }
    return this.fits(extra);
  }
  private drop(entry: Entry): void {
    if (this.entries_.get(entry.id) !== entry) return;
    this.track(entry, -1); this.entries_.delete(entry.id); this.orderedEntries = null; this.measured.delete(entry.id); this.refreshEviction(entry);
    const children = this.coverage.get(entry.id);
    if (children !== undefined) this.adjustCoverage(children, 1);
    // The table is already authoritative. Derive warning totals only when a resident report can consume them,
    // rather than re-walking every remaining cache allocation after each individual release.
    // Parent/page retirement can expose calibrated page coverage and must still validate that input immediately.
    if (this.memory.hasResidentWarnings || entry.category === 'sim' || entry.category === 'page') this.syncResidents();
  }
  private lease(entry: Entry): ResidencyLease {
    let released = false;
    const live = (): boolean => !released && this.entries_.get(entry.id) === entry;
    return Object.freeze({
      id: entry.id,
      shrink: (bytes: number): void => {
        if (!live()) return;
        if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > entry.bytes || entry.coveredBy !== undefined || this.coverage.has(entry.id) || entry.baseCredit !== 0)
          throw new RangeError('Invalid residency shrink');
        this.track(entry, -1); entry.bytes = bytes; this.track(entry, 1);
        if (this.memory.hasResidentWarnings) this.syncResidents();
      },
      update: (patch: { distance?: number; needed?: boolean; coveredBy?: string | null }): void => {
        if (!live()) return;
        if (patch.distance !== undefined) { if (!Number.isFinite(patch.distance) || patch.distance < 0) throw new RangeError('Invalid residency distance'); entry.distance = patch.distance; }
        if (patch.coveredBy !== undefined) {
          const covering = patch.coveredBy ?? undefined;
          this.validateCoverage(entry.id, entry.category, entry.bytes, covering);
          this.track(entry, -1); entry.coveredBy = covering; this.track(entry, 1);
        }
        if (patch.needed !== undefined) entry.needed = patch.needed;
        this.refreshEviction(entry);
      },
      hold: (): (() => void) => {
        if (!live()) return () => undefined;
        entry.holds++; this.refreshEviction(entry); let held = true;
        return () => { if (held) { held = false; entry.holds--; this.refreshEviction(entry); } };
      },
      release: (): void => {
        if (released) return; released = true;
        if (this.entries_.get(entry.id) !== entry) return;
        if (--entry.refs === 0) this.drop(entry);
      },
    });
  }
}
