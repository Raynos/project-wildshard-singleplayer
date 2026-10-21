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

/** Wire traffic, verified cache reads and disk-prefetch completion have separate units and totals. */
export function loadingDownloadText(transfer: DownloadSnapshot, scoped: boolean, prefetch: LoadingPrefetchSnapshot | null): string {
  const unknown = transfer.unclassifiedFiles > 0 ? ` · wire size unavailable for ${transfer.unclassifiedFiles} files (${formatMB(transfer.unclassifiedBytes)} known body)` : '';
  const activity = `${scoped ? 'Page activity during this load: ' : ''}${formatMB(transfer.networkBytes)} network${transfer.unclassifiedFiles > 0 ? ' measured' : ''} · ${formatMB(transfer.cachedBytes)} offline cache · ${formatMB(transfer.pendingBytes)} declared pending · ${transfer.filesDone} / ${transfer.filesTotal} load files${unknown}`;
  if (prefetch === null) return activity;
  const bytes = prefetch.presentBytes + prefetch.storedBytes, files = prefetch.presentFiles + prefetch.storedFiles;
  const state = prefetch.phase === 'running' ? 'prefetching' : prefetch.phase === 'done' ? 'prefetch finished' : 'prefetch stopped';
  // Even a finished run can skip a failed product: its discovered set is not an invented whole-set total.
  return `${activity} · On disk: ${formatMB(bytes)} of ${formatMB(prefetch.knownBytes)} known so far · ${files} / ${prefetch.knownFiles} prefetch files · ${prefetch.productsRead} / ${prefetch.products} products checked · ${state}${prefetch.reason === null ? '' : ` (${prefetch.reason})`}`;
}
