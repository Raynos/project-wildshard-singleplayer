import type { ResidencyLease } from './allocator';
import { ClientAssets } from '../shardfile/clientAssets';
import type { AdmittedProduct, ProductOptions } from '../shardfile/product';

/** Synchronous preparation inputs are borrowed only until `release`; later borrowers rehydrate verified bytes. */
export interface ProductInputLease { readonly assets: ReadonlyMap<string, Uint8Array>; release: () => Promise<void> }
type Claim = Pick<ResidencyLease, 'shrink' | 'release'>;

/** One admitted grid product's transient inputs, shared by overlapping preparations, never by finished promises. */
export class ProductInputs {
  readonly reader: ClientAssets;
  private readonly assets: Map<string, Uint8Array>;
  private readonly refs: readonly string[];
  private readonly claims: { refs: Set<string>; bytes: number; lease: Claim }[] = [];
  private users = 0;
  private pending = Promise.resolve();
  constructor(private readonly admitted: AdmittedProduct, options: ProductOptions, private readonly reserve: (bytes: number) => Claim, private readonly keep: ReadonlySet<string> = new Set()) {
    this.assets = new Map(admitted.assets); this.refs = [...this.assets.keys()];
    this.reader = new ClientAssets(admitted.source, admitted.assets, options);
  }
  private run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.pending.then(work);
    // The settled queue carries no asset result or rejection into the page lifetime.
    this.pending = result.then(() => undefined, () => undefined); return result;
  }
  /** A decoder's release cannot uncharge a wire still borrowed by another preparation. */
  retains(ref: string): boolean { return this.assets.has(ref) || this.reader.retained.has(ref); }
  /** Metadata needs no input borrow; retire unused cold bytes through the same release authority. */
  releaseUnused(): Promise<void> {
    return this.run(async () => {
      if (this.users !== 0) return;
      const refs = this.refs.filter(ref => this.assets.has(ref) && !this.keep.has(ref));
      if (refs.length === 0) return;
      const released = await this.admitted.releasePreparedTransport?.(refs, 'cache-or-fetch') ?? [];
      for (const ref of released) this.assets.delete(ref);
      this.reader.releaseTransport(released);
      for (const claim of this.claims) {
        for (const ref of released) claim.refs.delete(ref);
        const remaining = [...claim.refs].reduce((sum, ref) => sum + (this.assets.get(ref)?.byteLength ?? 0), 0);
        if (remaining === 0) claim.lease.release();
        else if (remaining < claim.bytes) claim.lease.shrink(remaining);
        claim.bytes = remaining;
      }
      for (let i = this.claims.length - 1; i >= 0; i--) if (this.claims[i]?.bytes === 0) this.claims.splice(i, 1);
    });
  }
  async acquire(): Promise<ProductInputLease> {
    this.users++;
    try {
      await this.run(async () => {
        const missing = this.refs.filter(ref => !this.assets.has(ref));
        if (missing.length === 0) return;
        const source = this.admitted.source;
        const bytes = missing.reduce((sum, ref) => sum + (source.files.find(file => file.hash === ref)?.compressed ?? source.requires.commonsWire[ref.replace(/^commons:/u, '')] ?? 0), 0);
        const lease = this.reserve(bytes), loaded = new Map<string, Uint8Array>();
        try {
          for (const ref of missing) loaded.set(ref, await this.reader.read(ref));
          for (const [ref, value] of loaded) this.assets.set(ref, value);
          this.claims.push({ refs: new Set(missing), bytes, lease });
        } catch (error) { lease.release(); throw error; }
      });
    } catch (error) { this.users--; throw error; }
    let live = true, closing: Promise<void> | undefined;
    return { assets: this.assets, release: () => {
      if (!live) return closing ?? Promise.resolve(); live = false; this.users--;
      closing = this.users === 0 ? this.releaseUnused() : Promise.resolve();
      return closing;
    } };
  }
}
