import type { Animal } from '../entities/Animal';

/**
 * The names you give your horses at the hitching rail (NALATI-FINISH B1, N13 "renaming the horse at the rail"). Kept in
 * localStorage `ws.nalati.horseNames` ({ "<kind>:<variant>": "Name" }) — the same store the save uses for Tulpar
 * ('ws.nalati.tulpar'), so a name outlives the session and follows the horse (the camp's bay, its black, Tulpar, Argymaq).
 *
 *   cleanHorseName('  kara  jorga ') → 'Kara Jorga'   (trimmed, spaces folded, ≤ 16 characters, letters / digits / ' - .)
 *   savedHorseName(a) → string | null ;  saveHorseName(a, name)
 */

const STORE = 'ws.nalati.horseNames';
export const HORSE_NAME_MAX = 16;
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** a name you typed, made fit to show: trimmed, runs of spaces folded, only letters (any script), digits, space ' - . ;
 *  the first letter of each word upper-cased; at most HORSE_NAME_MAX characters. '' when nothing is left */
export function cleanHorseName(raw: string): string {
  const kept = raw.normalize('NFC').replaceAll(/[^\p{L}\p{N} '.-]/gu, '').replaceAll(/\s+/g, ' ').trim();
  const cased = kept.split(' ').map((w) => (w.length > 0 ? w.charAt(0).toLocaleUpperCase() + w.slice(1) : w)).join(' ');
  return Array.from(GRAPHEMES.segment(cased), (g) => g.segment).slice(0, HORSE_NAME_MAX).join('').trim();
}

/** the horse's key in the store: its kind and variant ('horse:camp-bay', 'horse:tulpar', 'argymaq:…') */
export const horseKey = (a: Pick<Animal, 'kind' | 'variant'>): string => `${a.kind}:${a.variant}`;

function readAll(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw === null) return {};
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return {};
    const out: Record<string, string> = {};
    for (const [k, n] of Object.entries(v)) if (typeof n === 'string') out[k] = n;
    return out;
  } catch { return {}; }
}

export function savedHorseName(a: Pick<Animal, 'kind' | 'variant'>): string | null {
  const n = readAll()[horseKey(a)];
  return n !== undefined && n.length > 0 ? n : null;
}

export function saveHorseName(a: Pick<Animal, 'kind' | 'variant'>, name: string): void {
  try {
    const all = readAll();
    all[horseKey(a)] = name;
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch { /* no storage: the name lasts this session */ }
}
