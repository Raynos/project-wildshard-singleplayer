import { expect, it } from 'vitest';
import { loadingDownloadText, loadingDownloadFraction, loadingPrefetchFraction, loadingPrefetchText, type LoadingPrefetchSnapshot } from './loadingDownloadText';

const traffic = { networkBytes: 1_300_000, cachedBytes: 2_000_000, pendingBytes: 500_000, filesDone: 4, filesTotal: 5, unclassifiedBytes: 100_000, unclassifiedFiles: 0,
  declaredBytes: 2_000_000, declaredDoneBytes: 1_500_000, declaredFiles: 4, declaredFilesDone: 3 };
const prefetch: LoadingPrefetchSnapshot = { phase: 'running', reason: null, products: 25, productsRead: 3,
  knownFiles: 10, knownBytes: 20_000_000, presentFiles: 2, presentBytes: 4_000_000, storedFiles: 3, storedBytes: 6_000_000 };

it('the home track completes only after its actual declared bytes arrive', () => {
  expect(loadingDownloadFraction(traffic, false)).toBe(0.75);
  // undeclared page traffic and unsized transfers never move it
  expect(loadingDownloadFraction({ ...traffic, networkBytes: 90_000_000, unclassifiedFiles: 40, unclassifiedBytes: 50_000_000 }, false)).toBe(0.75);
  expect(loadingDownloadFraction({ ...traffic, declaredDoneBytes: 2_000_000, pendingBytes: 0 }, false)).toBe(1);
  expect(loadingDownloadFraction({ ...traffic, declaredDoneBytes: 2_000_000, pendingBytes: 0 }, true)).toBe(1);
  expect(loadingDownloadFraction({ ...traffic, declaredBytes: 0, declaredDoneBytes: 0 }, false)).toBe(0);
  const empty = {...traffic, declaredBytes: 0, declaredDoneBytes: 0, pendingBytes: 0};
  expect(loadingDownloadFraction(empty, true)).toBe(1);
  expect(loadingDownloadFraction({...empty, unclassifiedFiles: 1}, true)).toBe(0);
  expect(loadingDownloadFraction({...empty, pendingBytes: 1}, true)).toBe(0);
  expect(loadingDownloadFraction(traffic, true)).toBe(0.75);
});

it('a fixed compiled entry total does not grow as declarations arrive, or reach 100 with pending content', () => {
  const first = {...traffic, expectedBytes: 4_000_000};
  const next = {...first, declaredBytes: 3_000_000, declaredDoneBytes: 2_000_000};
  expect(loadingDownloadFraction(first, false)).toBe(0.375);
  expect(loadingDownloadFraction(next, false)).toBe(0.5);
  expect(loadingDownloadText(first)).toContain('of 4.00 MB content');
  expect(loadingDownloadText({...first, declaredBytes: 0, declaredDoneBytes: 0})).toContain('0.00 MB of 4.00 MB content');
  expect(loadingDownloadText(next)).toContain('of 4.00 MB content');
  expect(loadingDownloadFraction({...next, declaredDoneBytes: 4_000_000}, true)).toBeLessThan(1);
  expect(loadingDownloadFraction({...next, declaredDoneBytes: 4_000_000, pendingBytes: 0}, true)).toBe(1);
  // Finishing one wave cannot announce 100, then fall when a later required
  // wave declares its already-compiled files. The entry barrier closes that set.
  expect(loadingDownloadFraction({...next, declaredDoneBytes: 4_000_000, pendingBytes: 0}, false)).toBe(0.999);
  expect(loadingDownloadFraction({...next, declaredDoneBytes: 4_000_000, pendingBytes: 1}, false)).toBe(0.999);
});

it('leads with the declared progress, then wire and offline cache', () => {
  expect(loadingDownloadText(traffic)).toBe('1.50 MB of 2.00 MB content · 3 / 4 files · 1.30 MB network · 2.00 MB offline cache');
});

it('labels derived input satisfaction separately from actual wire and cache reads', () => {
  expect(loadingDownloadText({...traffic, restoredBytes: 750_000})).toContain('0.75 MB inputs restored · 1.30 MB network · 2.00 MB offline cache');
});

it('counts Safari\'s unsized service-worker transfers by body size, never as a missing total', () => {
  const text = loadingDownloadText({ ...traffic, networkBytes: 0, unclassifiedFiles: 1133, unclassifiedBytes: 232_600_000 });
  expect(text).toContain('232.6 MB network (1133 files by encoded body size)');
  expect(text).not.toContain('unavailable');
  expect(text).not.toContain('0.00 MB network');
});

it('the grid prefetch row reports disk progress against the set known so far, and stops honestly', () => {
  expect(loadingPrefetchFraction(prefetch)).toBe(0.5);
  expect(loadingPrefetchText(prefetch)).toBe('On disk: 10.0 MB of 20.0 MB known so far · 5 / 10 files · 3 / 25 products checked · prefetching');
  expect(loadingPrefetchText({ ...prefetch, phase: 'quota', reason: 'storage quota' })).toContain('prefetch stopped (storage quota)');
  const cached = { ...prefetch, productsRead: 25, presentFiles: 7, presentBytes: 14_000_000 };
  expect(loadingPrefetchFraction(cached)).toBeLessThan(1);
  expect(loadingPrefetchFraction({ ...cached, phase: 'done' })).toBe(1);
});

it('labels reserved bytes without pretending their file count or receipt is known', () => {
  expect(loadingDownloadText({ ...traffic, unitemizedBytes: 500_000 })).toContain('3 / 4 files · 0.50 MB awaiting file index');
});


it('does not call an unknown wire size the decoded module body size', () => {
  const text = loadingDownloadText({ ...traffic, networkBytes: 0, unclassifiedFiles: 2, unclassifiedBytes: 0 });
  expect(text).toContain('2 transfers with unknown wire size');
  expect(text).not.toContain('by encoded body size');
});
