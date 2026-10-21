import { expect, it } from 'vitest';
import { DownloadAccounting, type DownloadTiming, installDownloadAccounting, receiveWorkerDownloads } from '../src/engine/boot/download';

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
  accounting.resource(timing('/worker-safari-hit.js', { workerStart: 0, transferSize: 0,
    serverTiming: [{ name: 'ws-cache', duration: 1024 }], encodedBodySize: 0 }));
  expect(accounting.snapshot()).toEqual({ networkBytes: 2000, cachedBytes: 1924,
    pendingBytes: 0, filesDone: 5, filesTotal: 5, unclassifiedBytes: 0 });
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


it('includes worker install transport once without charging HTTP-cache hits as network', () => {
  const accounting = new DownloadAccounting(base, 100);
  const dispose = installDownloadAccounting(accounting);
  const background = (startTime: number, responseEnd: number, transferSize: number) => ({
    type: 'WS_WORKER_DOWNLOAD', origin: 1000,
    timings: [{ name: new URL('/precache.js', base).href, startTime, responseEnd, transferSize, encodedBodySize: 1000 }],
  });
  try {
    // A request begun before this attempt still finishes during its download.
    receiveWorkerDownloads(background(90, 110, 1300), 1000);
    receiveWorkerDownloads(background(90, 110, 1300), 1000);
    receiveWorkerDownloads(background(120, 130, 0), 1000);
    receiveWorkerDownloads(background(10, 20, 1300), 1000);
    receiveWorkerDownloads({ type: 'WS_WORKER_DOWNLOAD', timings: [{}] }, 1000);
    expect(accounting.snapshot()).toMatchObject({ networkBytes: 1300, cachedBytes: 1000, filesDone: 2 });
  } finally { dispose(); }
});


it('uses actual worker transfers instead of charging synthetic response lengths twice', () => {
  const accounting = new DownloadAccounting(base), dispose = installDownloadAccounting(accounting);
  const file = timing('/worker-owned.js', { workerStart: 1, transferSize: 1300,
    serverTiming: [{ name: 'ws-network', duration: 1000 }, { name: 'ws-receipt', duration: 0 }] });
  const receipt = { type: 'WS_WORKER_DOWNLOAD', origin: 1000,
    timings: [{ name: file.name, startTime: 1, responseEnd: 2, transferSize: 0, encodedBodySize: 1000 }] };
  try {
    accounting.resource(file);
    receiveWorkerDownloads(receipt, 1000); receiveWorkerDownloads(receipt, 1000);
    expect(accounting.snapshot()).toMatchObject({ networkBytes: 0, cachedBytes: 1000, filesDone: 1 });
    receiveWorkerDownloads({ ...receipt, timings: [{ ...receipt.timings[0], startTime: 3, transferSize: 1300 }] }, 1000);
    expect(accounting.snapshot()).toMatchObject({ networkBytes: 1300, cachedBytes: 1000, filesDone: 2 });
  } finally { dispose(); }
});

it('replays navigation-time worker receipts once and excludes the previous document', () => {
  const accounting = new DownloadAccounting(base), dispose = installDownloadAccounting(accounting);
  const entry = { name: new URL('/early-module.js', base).href, startTime: 900,
    responseEnd: 1100, transferSize: 1300, encodedBodySize: 1000 };
  const replay = { type: 'WS_WORKER_DOWNLOAD', origin: 1000,
    timings: [entry, { ...entry, startTime: 800, responseEnd: 900 }] };
  try {
    receiveWorkerDownloads(replay, 2000); receiveWorkerDownloads(replay, 2000);
    expect(accounting.snapshot()).toMatchObject({ networkBytes: 1300, filesDone: 1 });
  } finally { dispose(); }
});
