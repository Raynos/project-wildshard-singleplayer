import { expect, it } from 'vitest';
import { DownloadAccounting, type DownloadTiming, installDownloadAccounting, receiveWorkerDownloads, observeDownloadAccounting, currentDownloadAccounting, declareDownloadFile, declareModuleFiles, recordCachedDownload } from '../src/engine/boot/download';

const base = 'https://game.test/';
const timing = (name: string, extra: Partial<DownloadTiming> = {}): DownloadTiming => ({
  name: new URL(name, base).href, startTime: 1, transferSize: 1300, encodedBodySize: 1000,
  workerStart: 0, serverTiming: [], ...extra,
});

it('declares static module bodies once, with no network credit and no prefix on an invalid suffix', () => {
  const accounting = new DownloadAccounting(base), dispose = installDownloadAccounting(accounting);
  try {
    for (const invalid of [null, [['/assets/first.js', 4], ['https://foreign.test/late.js', 2]],
      [['/assets/first.js', 4], ['/assets/late.js', -1]], [['/assets/first.js', 4], ['/assets/late.js', 1.5]],
      [['/assets/first.js', 4], ['/assets/../late.js', 1]], [['/assets/first.js', 4, 'extra']]]) {
      expect(() => declareModuleFiles(invalid)).toThrow('Invalid boot module');
      expect(accounting.snapshot()).toMatchObject({ declaredFiles: 0, declaredBytes: 0 });
    }
    accounting.resource(timing('/assets/shared.js'));
    const before = accounting.snapshot().networkBytes;
    declareModuleFiles([['/assets/shared.js', 10], ['/assets/first.js', 4], ['/assets/page.css', 3]]);
    declareModuleFiles([['/assets/shared.js', 10]]);
    expect(accounting.snapshot()).toMatchObject({ declaredFiles: 3, declaredBytes: 17, declaredDoneBytes: 10, networkBytes: before });
  } finally { dispose(); }
});

it('mid-play observation receives cache and worker activity without taking over the boot', () => {
  const boot = new DownloadAccounting(base), cell = new DownloadAccounting(base, 10);
  const stopBoot = installDownloadAccounting(boot), stopCell = observeDownloadAccounting(cell);
  const worker = (startTime: number) => receiveWorkerDownloads({ type: 'WS_WORKER_DOWNLOAD', origin: 1000,
    timings: [{ name: new URL('/cell.bin', base).href, startTime, responseEnd: startTime + 1, transferSize: 1300, encodedBodySize: 1000 }] }, 1000);
  try {
    expect(currentDownloadAccounting()).toBe(boot);
    worker(1); worker(11);
    declareDownloadFile('/cached.bin', 500); recordCachedDownload('cell-cache', 500, '/cached.bin');
    expect(boot.snapshot()).toMatchObject({ networkBytes: 2600, cachedBytes: 500, pendingBytes: 0 });
    expect(cell.snapshot()).toMatchObject({ networkBytes: 1300, cachedBytes: 500, pendingBytes: 0 });
    stopBoot();
    expect(currentDownloadAccounting()).toBeUndefined();
    worker(20); recordCachedDownload('later-cache', 250);
    expect(cell.snapshot()).toMatchObject({ networkBytes: 2600, cachedBytes: 750 });
    stopCell(); worker(30); recordCachedDownload('closed-cache', 100);
    expect(cell.snapshot()).toMatchObject({ networkBytes: 2600, cachedBytes: 750 });
  } finally { stopCell(); stopBoot(); }
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
  expect(accounting.snapshot()).toEqual({ networkBytes: 1300, cachedBytes: 1924,
    pendingBytes: 0, filesDone: 5, filesTotal: 5, unclassifiedBytes: 900, unclassifiedFiles: 1,
    declaredBytes: 0, declaredDoneBytes: 0, declaredFiles: 0, declaredFilesDone: 0 });
});

it('does not turn all-zero worker timings into cache hits or invent wire bytes from body hints', () => {
  const accounting = new DownloadAccounting(base);
  accounting.resource(timing('/zero.bin', { source: 'worker', transferSize: 0, encodedBodySize: 0 }));
  expect(accounting.snapshot()).toMatchObject({ networkBytes: 0, cachedBytes: 0, unclassifiedFiles: 1, unclassifiedBytes: 0 });
  accounting.resource(timing('/zero.bin', { workerStart: 1, transferSize: 0, encodedBodySize: 0,
    serverTiming: [{ name: 'ws-receipt', duration: 0 }, { name: 'ws-network', duration: 700 }] }));
  expect(accounting.snapshot()).toMatchObject({ networkBytes: 0, cachedBytes: 0, filesDone: 1, unclassifiedBytes: 700 });
  accounting.declare('/zero.bin', 800);
  expect(accounting.snapshot()).toMatchObject({ pendingBytes: 0, unclassifiedBytes: 700, unclassifiedFiles: 1 });
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
  expect(accounting.snapshot()).toMatchObject({ declaredBytes: 6500, declaredDoneBytes: 3500, declaredFiles: 3, declaredFilesDone: 2 });
  accounting.resource(timing('/pending.bin', { encodedBodySize: 3000, transferSize: 3300 }));
  expect(accounting.snapshot()).toMatchObject({ pendingBytes: 0, declaredBytes: 6500, declaredDoneBytes: 6500, declaredFilesDone: 3 });
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


it('replaces reserved bytes with files without an extra total or invented completion', () => {
  const accounting = new DownloadAccounting(base);
  accounting.reserve('/home/', 100);
  accounting.declare('/early.js', 10);
  accounting.resource(timing('/home/index.json'));
  accounting.declare('/home/index.json', 20);
  expect(accounting.snapshot()).toMatchObject({ declaredBytes: 110, declaredDoneBytes: 20, pendingBytes: 90, unitemizedBytes: 80 });
  accounting.declare('/home/body.bin', 80);
  expect(accounting.snapshot()).toMatchObject({ declaredBytes: 110, declaredDoneBytes: 20, pendingBytes: 90 });
  accounting.resource(timing('/home/body.bin'));
  expect(accounting.snapshot()).toMatchObject({ declaredBytes: 110, declaredDoneBytes: 100, pendingBytes: 10 });
  // Unexpected real work grows the total; the reserve cannot conceal it.
  accounting.declare('/home/extra.bin', 25);
  expect(accounting.snapshot().declaredBytes).toBe(135);
});
it('refuses changed, overlapping and invalid reserves without modifying the original', () => {
  const accounting = new DownloadAccounting(base);
  for (const [url, bytes] of [['/home', 10], ['https://other.test/home/', 10], ['/home/?v=x', 10], ['/home/', -1], ['/home/', 1.5]] as const) {
    expect(() => accounting.reserve(url, bytes)).toThrow('Invalid download reserve');
  }
  accounting.declare('/home/index.json', 20);
  expect(() => accounting.reserve('/home/', 19)).toThrow('understates');
  accounting.reserve('/home/', 100); accounting.reserve('/home/', 100);
  expect(() => accounting.reserve('/home/', 101)).toThrow('Changed');
  expect(() => accounting.reserve('/home/sub/', 10)).toThrow('Overlapping');
  expect(() => accounting.reserve('/', 500)).toThrow('Overlapping');
  expect(accounting.snapshot()).toMatchObject({ declaredBytes: 100, declaredDoneBytes: 0 });
});

it('itemizes detached banks atomically with exact totals and no duplicate or unsafe file publication', () => {
  const accounting = new DownloadAccounting(base);
  accounting.reserveBank('home', 30);
  for (const rows of [[['/assets/a.glb', 10], ['/assets/b.glb', 10]], [['/assets/a.glb', 10], ['/assets/a.glb', 20]],
    [['/assets/a.glb', 10], ['https://foreign.test/b.glb', 20]], [['/assets/a.glb', 10], ['/assets/../b.glb', 20]]]) {
    expect(() => accounting.itemizeBank('home', rows)).toThrow();
    expect(accounting.snapshot()).toMatchObject({ declaredBytes: 30, declaredFiles: 0, unitemizedBytes: 30 });
  }
  accounting.resource(timing('/assets/a.glb'));
  accounting.itemizeBank('home', [['/assets/a.glb', 10], ['/assets/b.glb', 20]]);
  expect(accounting.snapshot()).toMatchObject({ declaredBytes: 30, declaredDoneBytes: 10, declaredFiles: 2 });
});


it('keeps decoded module content separate from encoded body and wire receipts', () => {
  const accounting = new DownloadAccounting(base);
  accounting.declare('/assets/module.js', 1000);
  accounting.resource(timing('/assets/module.js', { transferSize: 400, encodedBodySize: 100, decodedBodySize: 1000 }));
  expect(accounting.snapshot()).toMatchObject({ declaredBytes: 1000, declaredDoneBytes: 1000, networkBytes: 400 });
  accounting.declare('/assets/unsized.js', 2000);
  accounting.resource(timing('/assets/unsized.js', { transferSize: 0, encodedBodySize: 0, workerStart: 1 }));
  expect(accounting.snapshot()).toMatchObject({ declaredBytes: 3000, declaredDoneBytes: 3000, networkBytes: 400, unclassifiedBytes: 0, unclassifiedFiles: 1 });
});
