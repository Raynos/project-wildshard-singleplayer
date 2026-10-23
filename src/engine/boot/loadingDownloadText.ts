import type { DownloadSnapshot } from './download';
import { formatMB } from './plan';

/** Disk-prefetch facts supplied by the application; they never credit transport bytes. */
export interface LoadingPrefetchSnapshot {
  readonly phase: 'running' | 'done' | 'quota' | 'stopped' | 'error';
  readonly reason: string | null;
  readonly products: number; readonly productsRead: number;
  readonly knownFiles: number; readonly knownBytes: number;
  readonly presentFiles: number; readonly presentBytes: number;
  readonly storedFiles: number; readonly storedBytes: number;
}

/** The home load's own track: the bytes of the files it declared (product indexes give exact sizes) that have arrived, from
 * the wire or the cache; done when the load is. Grid prefetch and other page traffic never move it (they have their own row). */
export function loadingDownloadFraction(transfer: DownloadSnapshot, done: boolean): number {
  if (done) return 1;
  return transfer.declaredBytes === 0 ? 0 : Math.min(1, transfer.declaredDoneBytes / transfer.declaredBytes);
}

/** Declared progress first (the fact line truncates), then the wire and the offline cache. WebKit sizes no service-worker
 * transfer: those count by their known body size, said once, never as a missing total. */
export function loadingDownloadText(transfer: DownloadSnapshot): string {
  const network = transfer.unclassifiedFiles > 0 && transfer.unclassifiedBytes === 0
    ? `${formatMB(transfer.networkBytes)} network · ${transfer.unclassifiedFiles} transfers with unknown wire size`
    : transfer.unclassifiedFiles > 0
    ? `${formatMB(transfer.networkBytes + transfer.unclassifiedBytes)} network (${transfer.unclassifiedFiles} files by encoded body size)` : `${formatMB(transfer.networkBytes)} network`;
  const pending = transfer.unitemizedBytes === undefined ? '' : ` · ${formatMB(transfer.unitemizedBytes)} awaiting file index`;
  if (transfer.declaredBytes === 0) return `Reading download inventory · ${network} · ${formatMB(transfer.cachedBytes)} offline cache`;
  return `${formatMB(transfer.declaredDoneBytes)} of ${formatMB(transfer.declaredBytes)} content · ${transfer.declaredFilesDone} / ${transfer.declaredFiles} files${pending} · ${network} · ${formatMB(transfer.cachedBytes)} offline cache`;
}

/** The grid prefetch's own row: disk bytes against the set discovered so far (a finished run with every product read is 1). */
export function loadingPrefetchFraction(prefetch: LoadingPrefetchSnapshot): number {
  const complete = prefetch.phase === 'done' && prefetch.productsRead === prefetch.products
    && prefetch.presentFiles + prefetch.storedFiles === prefetch.knownFiles;
  return complete ? 1 : Math.min(0.999, (prefetch.presentBytes + prefetch.storedBytes) / Math.max(1, prefetch.knownBytes));
}

export function loadingPrefetchText(prefetch: LoadingPrefetchSnapshot): string {
  const bytes = prefetch.presentBytes + prefetch.storedBytes, files = prefetch.presentFiles + prefetch.storedFiles;
  const state = prefetch.phase === 'running' ? 'prefetching' : prefetch.phase === 'done' ? 'prefetch finished' : 'prefetch stopped';
  // Even a finished run can skip a failed product: its discovered set is not an invented whole-set total.
  return `On disk: ${formatMB(bytes)} of ${formatMB(prefetch.knownBytes)} known so far · ${files} / ${prefetch.knownFiles} files · ${prefetch.productsRead} / ${prefetch.products} products checked · ${state}${prefetch.reason === null ? '' : ` (${prefetch.reason})`}`;
}
