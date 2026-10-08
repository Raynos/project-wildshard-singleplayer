import { saveStorage } from '../saves/slots';
/** One-shot intent from the renderer-free title page to the selected shard's fresh document. */
export type TitleArrivalMode = 'enter' | 'explore' | 'arena';
export interface TitleArrival { slug: string; mode: TitleArrivalMode }

const KEY = 'titleArrival';
const BACKUP_KEY = 'titleArrival.once';
const MAX_AGE_MS = 60_000;

interface StoredArrival extends TitleArrival { at: number; name?: string }

function valid(raw: string | null, slug: string): TitleArrival | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const candidate = value as Partial<StoredArrival>;
    if (![slug].includes(candidate.slug ?? '') || (candidate.mode !== 'enter' && candidate.mode !== 'explore' && candidate.mode !== 'arena')) return null;
    if (typeof candidate.at !== 'number' || !Number.isFinite(candidate.at) || Date.now() - candidate.at < 0 || Date.now() - candidate.at > MAX_AGE_MS) return null;
    return { slug, mode: candidate.mode };
  } catch { return null; }
}

/** Optional display metadata lets the first HTML paint name the destination before application modules arrive. */
export function setTitleArrival(arrival: TitleArrival & { name?: string }): void {
  const raw = JSON.stringify({ ...arrival, at: Date.now() } satisfies StoredArrival);
  try { saveStorage('session').setItem(KEY, raw); } catch { /* the local one-shot below can carry the intent */ }
  // iOS home-screen navigation can replace WebContent between the static title and the game document.
  // The backup is consumed once, and expires quickly; it never becomes a remembered last shard.
  try { saveStorage('device').setItem(BACKUP_KEY, raw); } catch { /* the session copy may still survive */ }
}

export function consumeTitleArrival(slug: string): TitleArrival | null {
  let session: string | null = null, backup: string | null = null;
  try { session = saveStorage('session').getItem(KEY); saveStorage('session').removeItem(KEY); } catch { /* use the backup */ }
  try { backup = saveStorage('device').getItem(BACKUP_KEY); saveStorage('device').removeItem(BACKUP_KEY); } catch { /* use the session copy */ }
  return valid(session, slug) ?? valid(backup, slug);
}
