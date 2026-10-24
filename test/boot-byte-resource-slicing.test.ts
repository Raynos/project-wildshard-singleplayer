// @vitest-environment happy-dom
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { installByteCounter, releaseByteCounter, declareTotals, type ChunkFiles } from '../src/engine/boot/bytes';
import { createBootPlan, type Plan, type ProgressView } from '../src/engine/boot/plan';
import type { BootStep } from '../src/engine/boot/steps';
import { installAssetTables, publicBytes, assetVersions, musicManifests, sfxManifests, bootPacks } from '../src/engine/boot/tables';
import { initializeTier, TIER } from '../src/engine/core/tier';
import { noteFrameDrawn, setBuildHeld } from '../src/engine/core/framePacing';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';
import { legacyDouble } from './fake/FakeGame';

const originalTier = TIER, environment = scopeEnvironment(), nativeFetch = window.fetch, nativeChannel = globalThis.MessageChannel;
const tables = { bytes: publicBytes(), versions: assetVersions(), music: musicManifests(), sfx: sfxManifests(), packs: bootPacks() };
const files: ChunkFiles = { sky: [], baked: [], terrain: [], trees: [], cabins: [], props: Array.from({ length: 12 }, (_, i) => `/assets/byte-slice-${String(i)}.png`), physics: [], art: [], music: [], sfx: [] };
const frames: ((time: number) => void)[] = [];
let now = 1000, cost = 0;
let deliver: (entries: PerformanceResourceTiming[]) => void = () => { throw new Error('Observer is not installed'); };

beforeAll(() => {
  vi.stubGlobal('PerformanceObserver', class {
    constructor(receive: PerformanceObserverCallback) {
      deliver = entries => { receive(legacyDouble<PerformanceObserverEntryList>({ getEntries: () => entries }), legacyDouble<PerformanceObserver>({})); };
    }
    observe(): void { /* The fixture supplies exact native resource batches. */ }
  });
  window.fetch = () => Promise.resolve(new Response(new Uint8Array([1, 2, 3])));
});
beforeEach(() => {
  vi.useFakeTimers();now = 1000;cost = 0;frames.length = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  initializeTier('phone');setBuildHeld(false);noteFrameDrawn(Number.NEGATIVE_INFINITY);
  Reflect.set(globalThis, 'MessageChannel', undefined);
  installScopeEnvironment({ ...environment, frame: draw => { frames.push(draw);return frames.length; }, cancelFrame: () => undefined });
  installAssetTables({ ...tables, bytes: Object.fromEntries(files.props.map(name => [name, 10])) });
});
afterEach(() => { releaseByteCounter();noteFrameDrawn(Number.NEGATIVE_INFINITY);setBuildHeld(false);vi.restoreAllMocks();vi.useRealTimers(); });
afterAll(() => {
  installAssetTables(tables);initializeTier(originalTier);installScopeEnvironment(environment);
  window.fetch = nativeFetch;Reflect.set(globalThis, 'MessageChannel', nativeChannel);vi.unstubAllGlobals();
});

function entry(name: string, encoded = 10, transfer = 0): PerformanceResourceTiming {
  return legacyDouble<PerformanceResourceTiming>({ name: new URL(name, location.href).href, encodedBodySize: encoded, transferSize: transfer });
}
function counter(): { plan: Plan<BootStep>; views: ProgressView[] } {
  const views: ProgressView[] = [], plan = createBootPlan(view => { now += cost;views.push(view); }, { totals: declareTotals(files), schedule: null, record: () => undefined });
  installByteCounter(plan, files);return { plan, views };
}
async function finish(): Promise<number> {
  let peak = 0;
  for (let turn = 0; turn < 20 && frames.length > 0; turn++) {
    now += 34;noteFrameDrawn(now, now, 30);const start = now;
    for (const frame of frames.splice(0)) frame(now);
    await vi.advanceTimersByTimeAsync(0);peak = Math.max(peak, now - start);
  }
  expect(frames).toHaveLength(0);return peak;
}

test('live phone resource progress uses existing shared slices, retaining order and exact totals', async () => {
  const { plan, views } = counter();cost = 1;noteFrameDrawn(now, now, 30);const start = now;
  deliver(files.props.map(name => entry(name)));
  // Twelve files issue 24 progress publications; one synchronous batch used 24ms in this controlled-work kernel.
  expect(now - start).toBe(8);expect(plan.view.filesDone).toBe(4);expect(plan.view.bytesRead).toBe(40);
  expect(await finish()).toBeLessThanOrEqual(8);
  expect(plan.view).toMatchObject({ filesDone: 12, bytesRead: 120, download: 1 });
  expect(views.filter(view => view.filesDone > 0).map(view => view.filesDone)).toEqual(Array.from({ length: 23 }, (_, index) => Math.floor(index / 2) + 1));
});

test.each(['desktop', 'loading'] as const)('%s resource progress retains its original synchronous batch', mode => {
  const { plan } = counter();cost = 1;
  if (mode === 'desktop') { initializeTier('desktop');noteFrameDrawn(now, now, 30); }
  deliver(files.props.map(name => entry(name)));
  expect(plan.view).toMatchObject({ filesDone: 12, bytesRead: 120, download: 1 });expect(frames).toHaveLength(0);
});

test('overlapping batches dedupe query variants and retain encoded/transfer/declared fallback precedence', async () => {
  const { plan } = counter();cost = 1;noteFrameDrawn(now, now, 30);
  deliver(files.props.map((name, i) => entry(name, i < 2 ? 0 : 10, i === 0 ? 7 : 0)));
  deliver([entry('/foreign.png'), ...files.props.map(name => entry(`${name}?version=duplicate`))]);
  await finish();expect(plan.view).toMatchObject({ filesDone: 12, bytesRead: 117 });
});

test('a queued batch keeps its original boot rather than crediting its successor', async () => {
  const first = counter();cost = 1;noteFrameDrawn(now, now, 30);
  deliver(files.props.map(name => entry(name)));
  const next = counter();releaseByteCounter();await finish();
  expect(first.plan.view).toMatchObject({ filesDone: 12, bytesRead: 120 });
  expect(next.plan.view).toMatchObject({ filesDone: 0, bytesRead: 0 });
});

test('new native batches queue behind older entries without changing credit order', async () => {
  const { plan, views } = counter();cost = 1;noteFrameDrawn(now, now, 30);
  deliver(files.props.slice(0, 9).map((name, index) => entry(name, index + 1)));
  deliver(files.props.slice(9).map((name, index) => entry(name, index + 10)));
  await finish();expect(plan.view).toMatchObject({ filesDone: 12, bytesRead: 78 });
  const credited = views.map(view => view.bytesRead).filter((value, index, values) => value > 0 && value !== values[index - 1]);
  expect(credited).toEqual([1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78]);
});

test('fetch-counted paths remain excluded from resource timing credit', async () => {
  const { plan } = counter(), [name] = files.props;if (name === undefined) throw new Error('Missing declared path');
  const response = await window.fetch(name);await response.arrayBuffer();await vi.runAllTimersAsync();
  const before = { filesDone: plan.view.filesDone, bytesRead: plan.view.bytesRead };
  deliver([entry(name, 10)]);expect(plan.view).toMatchObject(before);expect(frames).toHaveLength(0);
});
