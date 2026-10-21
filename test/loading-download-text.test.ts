import { expect, it } from 'vitest';
import { loadingDownloadText, type LoadingPrefetchSnapshot } from '../src/engine/boot/loadingDownloadText';

const traffic = { networkBytes: 1_300_000, cachedBytes: 2_000_000, pendingBytes: 500_000, filesDone: 4, filesTotal: 5, unclassifiedBytes: 100_000 };
const prefetch: LoadingPrefetchSnapshot = { phase: 'running', reason: null, products: 25, productsRead: 3,
  knownFiles: 10, knownBytes: 20_000_000, presentFiles: 2, presentBytes: 4_000_000, storedFiles: 3, storedBytes: 6_000_000 };

it('keeps actual wire bytes separate from cached and discovered disk-prefetch bytes', () => {
  const text = loadingDownloadText(traffic, true, prefetch);
  expect(text).toContain('Page activity during this load: 1.30 MB network · 2.00 MB offline cache');
  expect(text).toContain('0.50 MB declared pending');
  expect(text).toContain('0.10 MB source unknown');
  expect(text).toContain('On disk: 10.0 MB of 20.0 MB known so far · 5 / 10 prefetch files · 3 / 25 products checked · prefetching');
});

it('reports quota stops and partial finished runs without claiming the whole set is cached', () => {
  expect(loadingDownloadText(traffic, false, { ...prefetch, phase: 'quota', reason: 'storage quota' }))
    .toContain('prefetch stopped (storage quota)');
  expect(loadingDownloadText(traffic, false, { ...prefetch, phase: 'done', productsRead: 25 }))
    .toContain('5 / 10 prefetch files · 25 / 25 products checked · prefetch finished');
  expect(loadingDownloadText(traffic, false, null)).not.toContain('On disk');
});
