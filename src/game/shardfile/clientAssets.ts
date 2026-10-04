import { boundedResponse, type ProductOptions } from './product';
import type { Shardfile } from './schema';

/** Release admitted transport copies after decoding; revisiting a tile rechecks immutable bytes from cache or the product. */
export class ClientAssets {
  private readonly wire: Map<string, Uint8Array>;
  private readonly source: Shardfile;
  private readonly options: ProductOptions;
  constructor(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>, options: ProductOptions) { this.source = source; this.wire = new Map(assets); this.options = options; }
  get retained(): ReadonlyMap<string, Uint8Array> { return this.wire; }
  /** Lease authoritative/library roots for the level; render tiles receive their own shorter leases. */
  pin(): () => void { return this.lease(this.roots()); }
  /** Pin an admitted tile and its dependencies until its render scope is released. */
  lease(refs: Iterable<string>): () => void { return this.options.cache?.pin?.([...this.closure(refs)].map((ref) => ref.replace(/^commons:/u, ''))) ?? (() => undefined); }
  async read(ref: string): Promise<Uint8Array> {
    const file = this.source.files.find((row) => row.hash === ref);
    if (file === undefined && !this.source.requires.commons.some((hash) => ref === `commons:${hash}`)) throw new Error('Undeclared resident asset');
    const present = this.wire.get(ref); if (present !== undefined) return present;
    const hash = ref.replace(/^commons:/u, ''), base = new URL('.', this.options.base).href;
    const cap = file?.compressed ?? this.source.requires.commonsWire[hash] ?? 0;
    let bytes = await this.options.cache?.asset(base, hash), downloaded = false;
    if (bytes === null || bytes === undefined) {
      if (this.options.offline) throw new Error('Missing cached resident tile');
      bytes = await boundedResponse(await this.options.fetch(new URL(hash, base).href), cap);
      downloaded = true;
    }
    if (bytes.length !== cap || await this.options.hash(bytes) !== hash) throw new Error('Resident tile hash or size mismatch');
    if (downloaded) await this.options.cache?.putAsset(base, hash, bytes);
    return bytes;
  }
  private roots(): string[] { return [...this.source.critical, ...this.source.library, ...(this.source.look.grade.lut === null ? [] : [this.source.look.grade.lut])]; }
  private closure(refs: Iterable<string>): Set<string> {
    const keep = new Set<string>(), files = new Map(this.source.files.map((file) => [file.hash, file])), pending = [...refs];
    while (pending.length > 0) {
      const ref = pending.pop(); if (ref === undefined || keep.has(ref)) continue;
      keep.add(ref); pending.push(...files.get(ref)?.dependencies ?? []);
    }
    return keep;
  }
  /** Keep only authoritative and library roots while render tiles stream through temporary admitted maps. */
  releaseTiles(): void {
    const keep = this.closure(this.roots());
    for (const ref of this.wire.keys()) if (!keep.has(ref)) this.wire.delete(ref);
  }
}
