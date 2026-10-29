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
  if (transfer.reads !== undefined) {
    if (transfer.reads.closed) return 1;
    const total = transfer.reads.bytes + transfer.reads.pendingBytes;
    return total === 0 ? 0 : Math.min(0.99, transfer.reads.bytes / total);
  }
  const total = transfer.expectedBytes ?? transfer.declaredBytes;
  // A completed zero-byte entry is genuinely empty. Unknown or pending bytes
  // remain incomplete; this does not turn a nonempty load's setup into credit.
  if (total === 0) return done && transfer.pendingBytes === 0 && transfer.unclassifiedFiles === 0 ? 1 : 0;
  const fraction = Math.min(1, transfer.declaredDoneBytes / total);
  // Setup completion is not a byte receipt. Pending content cannot say 100%.
  const openEntry = transfer.expectedBytes !== undefined && !done;
  return openEntry || transfer.pendingBytes > 0 || transfer.declaredDoneBytes < total ? Math.min(0.999, fraction) : fraction;
}

/** Declared progress first (the fact line truncates), then the wire and the offline cache. WebKit sizes no service-worker
 * transfer: those count by their known body size, said once, never as a missing total. */
export function loadingDownloadText(transfer: DownloadSnapshot): string {
  if (transfer.reads !== undefined) {
    const unknown = transfer.reads.unknownSourceBytes === 0 ? '' : ` · ${formatMB(transfer.reads.unknownSourceBytes)} source unknown`;
    return `${formatMB(transfer.reads.bytes)} · ${formatMB(transfer.reads.cachedBytes)} from cache${unknown}`;
  }
  const network = transfer.unclassifiedFiles > 0 && transfer.unclassifiedBytes === 0
    ? `${formatMB(transfer.networkBytes)} network · ${transfer.unclassifiedFiles} transfers with unknown wire size`
    : transfer.unclassifiedFiles > 0
    ? `${formatMB(transfer.networkBytes + transfer.unclassifiedBytes)} network (${transfer.unclassifiedFiles} files by encoded body size)` : `${formatMB(transfer.networkBytes)} network`;
  const pending = transfer.unitemizedBytes === undefined ? '' : ` · ${formatMB(transfer.unitemizedBytes)} awaiting file index`;
  const restored = transfer.restoredBytes === undefined ? '' : ` · ${formatMB(transfer.restoredBytes)} inputs restored`;
  if ((transfer.expectedBytes ?? transfer.declaredBytes) === 0) return `Reading download inventory · ${network} · ${formatMB(transfer.cachedBytes)} offline cache`;
  return `${formatMB(transfer.declaredDoneBytes)} of ${formatMB(transfer.expectedBytes ?? transfer.declaredBytes)} content · ${transfer.declaredFilesDone} / ${transfer.declaredFiles} files${pending}${restored} · ${network} · ${formatMB(transfer.cachedBytes)} offline cache`;
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
