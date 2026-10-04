/**
 * SF18b's decode pool: terrain tile bytes are decoded and validated in workers (`./tileDecodeWorker`) and come back as
 * `TerrainTileData` with transferred sample arrays, so the main thread spends its frame only on the budgeted upload. Where
 * there is no Worker (Node tests) the same decode runs inline on a microtask.
 */
import { decodeTerrainTile, type TerrainTileData } from '@wildshard/engine/world/terrainTileData';

/** Main thread → worker; the bytes are transferred. */
export interface TileDecodeRequest { id: number; bytes: ArrayBuffer }
/** Worker → main thread; the sample arrays are transferred. */
export type TileDecodeReply = { id: number; data: TerrainTileData; error?: undefined } | { id: number; error: string; data?: undefined };

/** A small pool of decode workers, round-robin. */
export class TileDecoder {
  private readonly workers: Worker[] = [];
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
      worker.onerror = (event): void => { for (const waiter of this.pending.values()) waiter.reject(new Error(`tile decode worker: ${event.message}`)); this.pending.clear(); };
      this.workers.push(worker);
    }
  }
  /** True when decoding runs off the main thread. */
  get threaded(): boolean { return this.workers.length > 0; }
  /** Decode one tile's bytes; the buffer is transferred (the caller's view is detached afterwards) when it owns it whole. */
  decode(bytes: Uint8Array): Promise<TerrainTileData> {
    if (this.disposed) return Promise.reject(new Error('tile decoder is disposed'));
    const worker = this.workers[this.next++ % Math.max(1, this.workers.length)];
    if (worker === undefined) return Promise.resolve().then(() => decodeTerrainTile(bytes));
    const whole = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength && bytes.buffer instanceof ArrayBuffer;
    const buffer = whole && bytes.buffer instanceof ArrayBuffer ? bytes.buffer : bytes.slice().buffer, id = ++this.id;
    return new Promise<TerrainTileData>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const request: TileDecodeRequest = { id, bytes: buffer };
      worker.postMessage(request, [buffer]);
    });
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    for (const worker of this.workers) worker.terminate();
    for (const waiter of this.pending.values()) waiter.reject(new Error('tile decoder is disposed'));
    this.pending.clear();
  }
}
