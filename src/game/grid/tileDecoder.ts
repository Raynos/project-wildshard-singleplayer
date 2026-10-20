/**
 * SF18b's decode pool: terrain tile bytes are decoded and validated in workers (`./tileDecodeWorker`) and come back as
 * `TerrainTileData` with transferred sample arrays, so the main thread spends its frame only on the budgeted upload. Where
 * there is no Worker (Node tests) the same decode runs inline on a microtask.
 */
import { decodeTerrainTile, type TerrainTileData } from '@wildshard/format/terrainTileBytes';

/** Main thread → worker; the bytes are transferred. */
export interface TileDecodeRequest { id: number; bytes: ArrayBuffer }
/** Worker → main thread; the sample arrays are transferred. */
export type TileDecodeReply = { id: number; data: TerrainTileData; error?: undefined } | { id: number; error: string; data?: undefined };

/** A small pool of decode workers, round-robin. */
export class TileDecoder {
  private readonly workers: Worker[] = [];
  private readonly tails: Promise<void>[] = [];
  private readonly pending = new Map<number, { resolve: (data: TerrainTileData) => void; reject: (error: Error) => void }>();
  private next = 0;
  private id = 0;
  private disposed = false;
  constructor(size = 2) {
    if (typeof Worker === 'undefined') return;
    for (let i = 0; i < size; i++) {
      const worker = new Worker(new URL('tileDecodeWorker.ts', import.meta.url), { type: 'module', name: `sf18b-decode-${i}` });
      worker.onmessage = (event: MessageEvent<TileDecodeReply>): void => {
        const { id } = event.data, waiter = this.pending.get(id); if (waiter === undefined) return;
        this.pending.delete(id);
        if (event.data.data !== undefined) waiter.resolve(event.data.data); else waiter.reject(new Error(`tile decode: ${event.data.error}`));
      };
      worker.onerror = (event): void => { this.dispose(new Error(`tile decode worker: ${event.message}`)); };
      this.workers.push(worker);
      this.tails.push(Promise.resolve());
    }
  }
  /** True when decoding runs off the main thread. */
  get threaded(): boolean { return this.workers.length > 0; }
  /**
   * Decode one tile's bytes. They are copied to the worker, so a cached or retained buffer stays intact; with `transfer`
   * a buffer the caller owns whole is moved instead (the caller's view is detached afterwards).
   */
  decode(bytes: Uint8Array, options: { transfer?: boolean } = {}): Promise<TerrainTileData> {
    if (this.disposed) return Promise.reject(new Error('tile decoder is disposed'));
    const slot = this.next++ % Math.max(1, this.workers.length), worker = this.workers[slot];
    if (worker === undefined) return Promise.resolve().then(() => { if (this.disposed) throw new Error('tile decoder is disposed'); return decodeTerrainTile(bytes); });
    const transfer = options.transfer === true;
    // Reads remain parallel, but a queued tile keeps its existing source view.
    // Copy/transfer only when this worker can decode it: no second wire buffer
    // for every tile in an entire ring waiting in worker message queues.
    const decoded = (this.tails[slot] ?? Promise.resolve()).then(() => {
      if (this.disposed) throw new Error('tile decoder is disposed');
      const whole = transfer && bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength;
      const buffer = whole && bytes.buffer instanceof ArrayBuffer ? bytes.buffer : bytes.slice().buffer, id = ++this.id;
      return new Promise<TerrainTileData>((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        const request: TileDecodeRequest = { id, bytes: buffer };
        try { worker.postMessage(request, [buffer]); }
        catch (error) { this.pending.delete(id); reject(error instanceof Error ? error : new Error(String(error))); }
      });
    });
    this.tails[slot] = decoded.then(() => undefined, () => undefined);
    return decoded;
  }
  dispose(reason = new Error('tile decoder is disposed')): void {
    if (this.disposed) return; this.disposed = true;
    for (const worker of this.workers) worker.terminate();
    for (const waiter of this.pending.values()) waiter.reject(reason);
    this.pending.clear();
  }
}
