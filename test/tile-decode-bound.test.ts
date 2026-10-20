import { afterEach, expect, test, vi } from 'vitest';
import { TileDecoder, type TileDecodeReply, type TileDecodeRequest } from '../src/game/grid/tileDecoder';
import type { TerrainTileData } from '../src/format/terrainTileBytes';

const workers: ControlledWorker[] = [];
const previousWorker = globalThis.Worker;
class ControlledWorker {
  onmessage: ((event: MessageEvent<TileDecodeReply>) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  readonly sent: TileDecodeRequest[] = [];
  terminated = false;
  constructor() { workers.push(this); }
  postMessage(request: TileDecodeRequest): void { this.sent.push(request); }
  terminate(): void { this.terminated = true; }
  reply(data: TerrainTileData): void {
    const request = this.sent.at(-1); if (request === undefined) throw new Error('No active decode');
    this.onmessage?.(new MessageEvent('message', { data: { id: request.id, data } }));
  }
}
const tile: TerrainTileData = { resolution: 2, size: 1, x: 0, z: 0, heights: new Float32Array(4) };
afterEach(() => { vi.stubGlobal('Worker', previousWorker); workers.length = 0; });

test('parallel tile reads create at most one wire copy per busy worker', async () => {
  vi.stubGlobal('Worker', ControlledWorker);
  const decoder = new TileDecoder(2), sources = Array.from({ length: 6 }, (_, i) => Uint8Array.of(i));
  const copies = sources.map(source => vi.spyOn(source, 'slice'));
  const pending = sources.map(source => decoder.decode(source));
  await Promise.resolve();
  expect(workers.map(worker => worker.sent.length)).toEqual([1, 1]);
  expect(copies.map(copy => copy.mock.calls.length)).toEqual([1, 1, 0, 0, 0, 0]);
  for (let wave = 0; wave < 3; wave++) {
    for (const worker of workers) worker.reply(tile);
    await Promise.all(pending.slice(wave * 2, wave * 2 + 2));
  }
  expect((await Promise.all(pending)).every(value => value === tile)).toBe(true);
  expect(workers.map(worker => worker.sent.map(request => new Uint8Array(request.bytes)[0]))).toEqual([[0, 2, 4], [1, 3, 5]]);
  expect(sources.map(source => source.byteLength)).toEqual(Array.from({ length: 6 }, () => 1));
  decoder.dispose();
});

test('worker failure retires active and queued tiles without copying the queue', async () => {
  vi.stubGlobal('Worker', ControlledWorker);
  const decoder = new TileDecoder(1), first = Uint8Array.of(1), queued = Uint8Array.of(2);
  const copy = vi.spyOn(queued, 'slice'), result = Promise.allSettled([decoder.decode(first), decoder.decode(queued)]);
  await Promise.resolve();
  workers[0]?.onerror?.({ message: 'decode failed' });
  expect((await result).map(row => row.status)).toEqual(['rejected', 'rejected']);
  expect(copy).not.toHaveBeenCalled(); expect(workers.every(worker => worker.terminated)).toBe(true);
  await expect(decoder.decode(first)).rejects.toThrow('disposed');
});
