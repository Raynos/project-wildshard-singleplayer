import { currentSpawnDownload } from '../boot/spawnDownload';
import { homeSeedPath } from './homeSeed';

/** DL7 P3: read a home's cold seed only when this page's spawn download lists it (a packs-book member, served from its
 * part). An unlisted seed is never fetched, so a shard without one waits on nothing; any failure is null and the
 * original decoder runs. */
export async function loadHomeSeedAsset(slug: string, tier: 'phone' | 'desktop'): Promise<Uint8Array | null> {
  try {
    const download = currentSpawnDownload(); if (download === undefined || typeof document === 'undefined') return null;
    const plain = new URL(homeSeedPath(slug, tier), document.baseURI).href, listed = download.resolve(plain);
    // A listed asset resolves to its versioned manifest URL; an unlisted one resolves to itself.
    if (listed === plain) return null;
    const response = await fetch(listed);
    if (!response.ok || /\btext\/html\b/iu.test(response.headers.get('content-type') ?? '')) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch { return null; }
}
