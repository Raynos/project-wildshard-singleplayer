/** The PWA manifest opens `/` on every home-screen launch; keep the last selected shard outside the URL. */
const KEY = 'ws.lastChunk';

export function lastPlayedChunk(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function saveLastPlayedChunk(slug: string): void {
  try { localStorage.setItem(KEY, slug); } catch { /* storage unavailable */ }
}
