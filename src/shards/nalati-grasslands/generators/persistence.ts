import feats from '../data/feats.json' with { type: 'json' };
import chapterFeats from '../data/chapterFeats.json' with { type: 'json' };
import policy from '../data/persistence.json' with { type: 'json' };

interface FeatCounter { id: string; count: number; fact: string | null; event?: string; kind?: string; variant?: string }
/** Full saved-record policy with source-owned ordered feat counters. */
export type NalatiPersistenceRows = Omit<typeof policy, 'counters'> & { counters: typeof policy.counters & { feats: FeatCounter[] } };

/** Chained quests own their completion facts; legacy feat counts never pay them a second time.
 * Returns fresh policy/counter storage without touching saved state or installing a listener. */
export function nalatiPersistenceRows(): NalatiPersistenceRows {
  const chapters = new Set<string>(Object.values(chapterFeats));
  const counters = feats.map(({ id, count, event, kind, variant }): FeatCounter => {
    const row: FeatCounter = { id, count, fact: chapters.has(id) ? null : `nalati.feat.${id}` };
    return Object.assign(row, event === undefined ? {} : { event }, kind === undefined ? {} : { kind }, variant === undefined ? {} : { variant });
  });
  const source = structuredClone(policy);
  return { ...source, counters: { ...source.counters, feats: counters } };
}
