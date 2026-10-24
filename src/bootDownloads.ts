import { declareDownloadFile, reserveDownloadGroup, reserveDownloadBank, preloadModuleGroups } from '@wildshard/engine/boot/download';

/** Declare the compiler's selected home code union before common code finishes. */
export function prepareHomeModules(descriptor: string | undefined, base: string): void {
  if (descriptor === undefined) return;
  const url = new URL(descriptor, base);
  if (url.origin !== new URL(base).origin || !/^\/shardfiles\/[a-zA-Z0-9_-]+\/shard\.json$/u.test(url.pathname)
    || url.search !== '' || url.hash !== '') return;
  preloadModuleGroups([`home:${new URL('.', url).pathname}`]);
}

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

/** Reserve the selected data page's art/model bank before fetching its list.
 * The content-hashed metadata is bounded and verified before any file publishes. */
export function prepareHomeExtras(input: unknown, descriptor: string | undefined, base: string,
  owner: { readonly disposed: boolean }, fetcher: typeof fetch = fetch): { readonly read: () => Promise<void> } | null {
  if (input === undefined || descriptor === undefined) return null;
  const home = new URL(descriptor, base), prefix = new URL('.', home).pathname;
  if (home.origin !== new URL(base).origin || !/^\/shardfiles\/[a-zA-Z0-9_-]+\/shard\.json$/u.test(home.pathname)
    || home.search !== '' || home.hash !== '') return null;
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('Invalid home extra inventories');
  if (!Object.hasOwn(input, prefix)) return null;
  const row: unknown = Reflect.get(input, prefix);
  if (!Array.isArray(row) || row.length !== 4) throw new Error('Invalid home extra inventory');
  const url: unknown = row[0], bytes: unknown = row[1], total: unknown = row[2], expectedHash: unknown = row[3];
  if (typeof url !== 'string' || !/^\/assets\/boot-[a-zA-Z0-9_-]+-[a-f0-9]{8}\.json$/u.test(url)
    || !url.startsWith(`/assets/boot-${home.pathname.split('/')[2]}-`)
    || typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 2 || bytes > 131072
    || typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0
    || typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/u.test(expectedHash) || !url.endsWith(`-${expectedHash.slice(0, 8)}.json`)) throw new Error('Invalid home extra inventory');
  const target = new URL(url, base).href;
  const live = (): void => { if (owner.disposed) throw new Error('Retired home download inventory'); };
  live(); const itemize = reserveDownloadBank(target, total); declareDownloadFile(target, bytes);
  return { read: async () => {
    live();
    const response = await fetcher(target); live();
    if (!response.ok || response.body === null) throw new Error('Failed home download inventory');
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const result = await reader.read(); live();
        if (result.done) break;
        length += result.value.byteLength;
        if (length > bytes) throw new Error('Oversized home download inventory');
        chunks.push(result.value);
      }
    } finally { await reader.cancel(); reader.releaseLock(); }
    if (length !== bytes) throw new Error('Home download inventory size differs');
    const wire = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { wire.set(chunk, offset); offset += chunk.length; }
    const digest = await crypto.subtle.digest('SHA-256', wire); live();
    const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== expectedHash) throw new Error('Home download inventory hash differs');
    const files: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(wire));
    itemize(files);
  } };
}
