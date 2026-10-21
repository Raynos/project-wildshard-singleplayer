import { expect, it } from 'vitest';
import { loadingDownloadText, loadingDownloadFraction, type LoadingPrefetchSnapshot } from '../src/engine/boot/loadingDownloadText';

const traffic = { networkBytes: 1_300_000, cachedBytes: 2_000_000, pendingBytes: 500_000, filesDone: 4, filesTotal: 5, unclassifiedBytes: 100_000, unclassifiedFiles: 0 };
const prefetch: LoadingPrefetchSnapshot = { phase: 'running', reason: null, products: 25, productsRead: 3,
  knownFiles: 10, knownBytes: 20_000_000, presentFiles: 2, presentBytes: 4_000_000, storedFiles: 3, storedBytes: 6_000_000 };

it('does not show download completion while known prefetch files or indexes remain', () => {
  const done = { ...traffic, filesDone: 5, pendingBytes: 0, unclassifiedBytes: 0 };
  expect(loadingDownloadFraction(done, true, null)).toBe(1);
  expect(loadingDownloadFraction(done, true, prefetch)).toBe(0.5);
  expect(loadingDownloadFraction(done, true, { ...prefetch, phase: 'quota' })).toBe(0.5);
  const cached = { ...prefetch, productsRead: 25, presentFiles: 7, presentBytes: 14_000_000 };
  expect(loadingDownloadFraction(done, true, cached)).toBeLessThan(1);
  expect(loadingDownloadFraction(done, true, { ...cached, phase: 'done' })).toBe(1);
  expect(loadingDownloadFraction({ ...done, unclassifiedFiles: 1 }, true, { ...cached, phase: 'done' })).toBeLessThan(1);
});

it('keeps actual wire bytes separate from cached and discovered disk-prefetch bytes', () => {
  const text = loadingDownloadText(traffic, true, prefetch);
  expect(text).toContain('Page activity during this load: 1.30 MB network · 2.00 MB offline cache');
  expect(text).toContain('0.50 MB declared pending');
  expect(text).not.toContain('wire size unavailable');
  expect(text).toContain('On disk: 10.0 MB of 20.0 MB known so far · 5 / 10 prefetch files · 3 / 25 products checked · prefetching');
});

it('shows missing wire measurements even when the browser exposes zero body bytes', () => {
  expect(loadingDownloadText({ ...traffic, unclassifiedFiles: 2, unclassifiedBytes: 0 }, false, null))
    .toContain('Network total unavailable (1.30 MB measured) · 2.00 MB offline cache');
  expect(loadingDownloadText({ ...traffic, unclassifiedFiles: 2, unclassifiedBytes: 0 }, false, null))
    .toContain('wire size unavailable for 2 files (0.00 MB known body)');
});

it('reports quota stops and partial finished runs without claiming the whole set is cached', () => {
  expect(loadingDownloadText(traffic, false, { ...prefetch, phase: 'quota', reason: 'storage quota' }))
    .toContain('prefetch stopped (storage quota)');
  expect(loadingDownloadText(traffic, false, { ...prefetch, phase: 'done', productsRead: 25 }))
    .toContain('5 / 10 prefetch files · 25 / 25 products checked · prefetch finished');
  expect(loadingDownloadText(traffic, false, null)).not.toContain('On disk');
});

it('never presents missing Safari wire measurements as zero downloaded', () => {
  const text = loadingDownloadText({ ...traffic, networkBytes: 0, unclassifiedFiles: 1133, unclassifiedBytes: 232_600_000 }, false, prefetch);
  expect(text).toContain('Network total unavailable (0.00 MB measured)');
  expect(text).not.toContain('0.00 MB network');
  expect(text).toContain('wire size unavailable for 1133 files (232.6 MB known body)');
  expect(text).toContain('On disk: 10.0 MB of 20.0 MB known so far');
});
