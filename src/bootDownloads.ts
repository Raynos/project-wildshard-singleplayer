import { declareDownloadFile, reserveDownloadGroup } from '@wildshard/engine/boot/download';

/** Use only the selected first-party home's compact compiler facts. External
 * descriptors and legacy-only cards retain their existing admission path. */
export function reserveHomeDownload(input: unknown, descriptor: string | undefined, base: string): void {
  if (descriptor === undefined || input === undefined) return;
  const url = new URL(descriptor, base), prefix = new URL('.', url);
  if (url.origin !== new URL(base).origin || !/^\/shardfiles\/[a-zA-Z0-9_-]+\/shard\.json$/u.test(url.pathname)
    || url.search !== '' || url.hash !== '') return;
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('Invalid home download totals');
  if (!Object.hasOwn(input, prefix.pathname)) return;
  const row: unknown = Reflect.get(input, prefix.pathname);
  if (!Array.isArray(row) || row.length !== 2) throw new Error('Invalid home download total');
  const indexBytes: unknown = row[0], total: unknown = row[1];
  if (typeof indexBytes !== 'number' || !Number.isSafeInteger(indexBytes) || indexBytes < 0
    || typeof total !== 'number' || !Number.isSafeInteger(total) || total < indexBytes) throw new Error('Invalid home download total');
  reserveDownloadGroup(prefix.href, total);
  declareDownloadFile(url.href, indexBytes);
}
