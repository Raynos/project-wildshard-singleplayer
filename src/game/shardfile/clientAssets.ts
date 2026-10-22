import { pacedResolve } from '@wildshard/engine/core/workSlice';
import { declareDownloadFile, recordCachedDownload } from '@wildshard/engine/boot/download';
import { boundedResponse, type ProductOptions } from './product';
import { outputBlobUrl, outputDescriptor } from './outputDescriptor';
import type { Shardfile } from '@wildshard/format/shardSchema';

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
    // a cached read resolves at once, unless the frame's build budget is spent (pacedResolve): a hook's chain of
    // cached reads must not run in one task on the road
    const present = this.wire.get(ref); if (present !== undefined) return pacedResolve(present);
    const hash = ref.replace(/^commons:/u, ''), base = new URL('.', this.options.base).href;
    const cap = file?.compressed ?? this.source.requires.commonsWire[hash] ?? 0;
    // Residency rereads may have no format-2 descriptor. Accounting observes
    // those unknown-path reads on completion and never changes cache refusals.
    if (outputDescriptor(this.source) !== undefined) declareDownloadFile(outputBlobUrl(this.source, ref, base), cap);
    // a trusted content-cache read already checked its SHA-256 (ContentCache.get): no page re-hash (~150 ms of a
    // phone-tier home region); every other read is checked here, off the page where a worker can
    const verified = await this.options.cache?.verifiedAsset?.(hash);
    if (verified !== null && verified !== undefined) {
      if (verified.length !== cap) throw new Error('Resident tile hash or size mismatch');
      return verified;
    }
    let bytes = await this.options.cache?.asset(base, hash), downloaded = false;
    if ((bytes === null || bytes === undefined) && outputDescriptor(this.source) !== undefined) {
      bytes = await this.options.cachedResponse?.(outputBlobUrl(this.source, ref, base), hash, cap);
    }
    if (bytes === null || bytes === undefined) {
      if (this.options.offline) throw new Error('Missing cached resident tile');
      bytes = await boundedResponse(await this.options.fetch(outputBlobUrl(this.source, ref, base)), cap);
      downloaded = true;
    }
    if (bytes.length !== cap || await this.hashOf(bytes) !== hash) throw new Error('Resident tile hash or size mismatch');
    if (downloaded) await this.options.cache?.putAsset(base, hash, bytes);
    else recordCachedDownload(hash, bytes.length);
    return bytes;
  }
  /** SHA-256 of `bytes` off the page (an owned copy through `hashOwned`), else on the page. */
  private async hashOf(bytes: Uint8Array): Promise<string> {
    const hashOwned = this.options.hashOwned;
    if (hashOwned !== undefined) { try { return (await hashOwned(Uint8Array.from(bytes))).hash; } catch { /* the page hashes it */ } }
    return this.options.hash(bytes);
  }
  /** Bind legacy catalogue identities to the admitted library, never to their old network URLs.
   * Each decoder receives an owned exact-length ArrayBuffer; absent bindings retain the caller's existing reader. */
  audioRead(): ((path: string) => Promise<ArrayBuffer>) | undefined {
    if (this.source.audio.recordings === undefined) return undefined;
    const recordings = new Map(Object.entries(this.source.audio.recordings));
    return async path => {
      const ref = recordings.get(path);
      if (ref === undefined) throw new Error(`Undeclared audio recording: ${path}`);
      return Uint8Array.from(await this.read(ref)).buffer;
    };
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
  /** Forget only decoded or runtime-owned transport copies; future reads still check immutable cache/network bytes. */
  releaseTransport(refs: Iterable<string>): void { for (const ref of refs) this.wire.delete(ref); }
  /** Keep only authoritative and library roots while render tiles stream through temporary admitted maps. */
  releaseTiles(): void {
    const keep = this.closure(this.roots());
    for (const ref of this.wire.keys()) if (!keep.has(ref)) this.wire.delete(ref);
  }
}
