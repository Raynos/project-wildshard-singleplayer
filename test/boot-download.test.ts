import { expect, it } from 'vitest';
import { DownloadAccounting, type DownloadTiming } from '../src/engine/boot/download';

const base = 'https://game.test/';
const timing = (name: string, extra: Partial<DownloadTiming> = {}): DownloadTiming => ({
  name: new URL(name, base).href, startTime: 1, transferSize: 1300, encodedBodySize: 1000,
  workerStart: 0, serverTiming: [], ...extra,
});

it('counts undeclared network requests and early modules once, separately from cache hits', () => {
  const accounting = new DownloadAccounting(base);
  const module = timing('/app.js');
  accounting.resource(module); accounting.resource(module);
  accounting.resource(timing('/texture.webp', { transferSize: 0, encodedBodySize: 500 }));
  accounting.resource(timing('/worker-file.bin', { workerStart: 10, transferSize: 0,
    serverTiming: [{ name: 'ws-network', duration: 700 }], encodedBodySize: 900 }));
  accounting.resource(timing('/worker-hit.bin', { workerStart: 10, transferSize: 0,
    serverTiming: [{ name: 'ws-cache', duration: 0 }], encodedBodySize: 400 }));
  expect(accounting.snapshot()).toEqual({ networkBytes: 2000, cachedBytes: 900,
    pendingBytes: 0, filesDone: 4, filesTotal: 4, unclassifiedBytes: 0 });
});

it('retains exact pending index sizes and resolves cache reads and late declarations', () => {
  const accounting = new DownloadAccounting(base);
  const hash = 'a'.repeat(64), file = `/shard/blobs/bin/${hash}.bin`;
  accounting.declare(file, 2500);
  accounting.declare('/pending.bin', 3000);
  expect(accounting.snapshot().pendingBytes).toBe(5500);
  accounting.cached(hash, 2500); accounting.cached(hash, 2500);
  accounting.resource(timing('/early.js'));
  accounting.declare('/early.js', 1000);
  expect(accounting.snapshot()).toMatchObject({ pendingBytes: 3000, cachedBytes: 2500,
    networkBytes: 1300, filesDone: 2, filesTotal: 3 });
  accounting.resource(timing('/pending.bin', { encodedBodySize: 3000, transferSize: 3300 }));
  expect(accounting.snapshot().pendingBytes).toBe(0);
});

it('keeps unclassified worker bytes explicit and excludes previous attempts', () => {
  const accounting = new DownloadAccounting(base, 2);
  accounting.resource(timing('/old.js'));
  accounting.resource(timing('/unknown.bin', { startTime: 3, workerStart: 2, transferSize: 0 }));
  expect(accounting.snapshot()).toMatchObject({ networkBytes: 0, cachedBytes: 0, unclassifiedBytes: 1000, filesDone: 1 });
});
