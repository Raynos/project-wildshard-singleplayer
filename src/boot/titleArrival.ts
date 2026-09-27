/** One-shot intent from the renderer-free title page to the selected shard's fresh document. */
export type TitleArrivalMode = 'enter' | 'explore' | 'arena';
export interface TitleArrival { slug: string; mode: TitleArrivalMode }

const KEY = 'ws.titleArrival';

export function setTitleArrival(arrival: TitleArrival): void {
  try { sessionStorage.setItem(KEY, JSON.stringify(arrival)); } catch { /* the destination still opens its own title */ }
}

export function consumeTitleArrival(slug: string): TitleArrival | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const candidate = value as Partial<TitleArrival>;
    if (candidate.slug !== slug || (candidate.mode !== 'enter' && candidate.mode !== 'explore' && candidate.mode !== 'arena')) return null;
    return { slug, mode: candidate.mode };
  } catch { return null; }
}
