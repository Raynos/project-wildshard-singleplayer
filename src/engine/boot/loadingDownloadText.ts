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

/** The download track completes only when both declared load work and discovered prefetch work finish. */
export function loadingDownloadFraction(transfer: DownloadSnapshot, done: boolean, prefetch: LoadingPrefetchSnapshot | null): number {
  const received = transfer.networkBytes + transfer.cachedBytes;
  const activity = done && transfer.filesDone === transfer.filesTotal && transfer.unclassifiedFiles === 0 ? 1
    : Math.min(0.999, received / (received + transfer.pendingBytes + transfer.unclassifiedBytes + 1));
  if (prefetch === null) return activity;
  const complete = prefetch.phase === 'done' && prefetch.productsRead === prefetch.products
    && prefetch.presentFiles + prefetch.storedFiles === prefetch.knownFiles;
  const disk = complete ? 1 : Math.min(0.999, (prefetch.presentBytes + prefetch.storedBytes) / Math.max(1, prefetch.knownBytes));
  return Math.min(activity, disk);
}

/** Wire traffic, verified cache reads and disk-prefetch completion have separate units and totals. */
export function loadingDownloadText(transfer: DownloadSnapshot, scoped: boolean, prefetch: LoadingPrefetchSnapshot | null): string {
  const unknown = transfer.unclassifiedFiles > 0 ? ` · wire size unavailable for ${transfer.unclassifiedFiles} files (${formatMB(transfer.unclassifiedBytes)} known body)` : '';
  const network = transfer.unclassifiedFiles > 0 ? `Network total unavailable (${formatMB(transfer.networkBytes)} measured)` : `${formatMB(transfer.networkBytes)} network`;
  const activity = `${scoped ? 'Page activity during this load: ' : ''}${network} · ${formatMB(transfer.cachedBytes)} offline cache · ${formatMB(transfer.pendingBytes)} declared pending · ${transfer.filesDone} / ${transfer.filesTotal} load files${unknown}`;
  if (prefetch === null) return activity;
  const bytes = prefetch.presentBytes + prefetch.storedBytes, files = prefetch.presentFiles + prefetch.storedFiles;
  const state = prefetch.phase === 'running' ? 'prefetching' : prefetch.phase === 'done' ? 'prefetch finished' : 'prefetch stopped';
  // Even a finished run can skip a failed product: its discovered set is not an invented whole-set total.
  return `${activity} · On disk: ${formatMB(bytes)} of ${formatMB(prefetch.knownBytes)} known so far · ${files} / ${prefetch.knownFiles} prefetch files · ${prefetch.productsRead} / ${prefetch.products} products checked · ${state}${prefetch.reason === null ? '' : ` (${prefetch.reason})`}`;
}
