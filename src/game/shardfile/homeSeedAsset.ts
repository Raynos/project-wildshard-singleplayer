import { currentSpawnDownload } from '../boot/spawnDownload';
import { homeSeedPath, joinHomeSeed } from './homeSeed';

/** DL7 P3: read a home's cold seed only when this page's spawn download lists it (a packs-book member, served from its
 * part). An unlisted seed is never fetched, so a shard without one waits on nothing; any failure is null and the
 * original decoder runs. */
export async function loadHomeSeedAsset(slug: string, tier: 'phone' | 'desktop'): Promise<Uint8Array | null> {
  try {
    const download = currentSpawnDownload(); if (download === undefined || typeof document === 'undefined') return null;
    // The seed's chunks are listed in order; a listed asset resolves to its versioned manifest URL, an unlisted one to itself.
    const urls: string[] = [];
    for (let chunk = 0; ; chunk++) {
      const plain = new URL(homeSeedPath(slug, tier, chunk), document.baseURI).href, listed = download.resolve(plain);
      if (listed === plain) break;
      urls.push(listed);
    }
    if (urls.length === 0) return null;
    const chunks = await Promise.all(urls.map(async url => {
      const response = await fetch(url);
      if (!response.ok || /\btext\/html\b/iu.test(response.headers.get('content-type') ?? '')) throw new Error('Home seed chunk unavailable');
      return new Uint8Array(await response.arrayBuffer());
    }));
    return joinHomeSeed(chunks);
  } catch { return null; }
}
