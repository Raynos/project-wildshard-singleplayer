import type { Animal } from '#engine/entities/Animal';

/**
 * The names you give your horses at the hitching rail (NALATI-FINISH B1, N13 "renaming the horse at the rail"). Kept in
 * localStorage `ws.nalati.horseNames` ({ "<key>": "Name" }), so a name outlives the session and follows the horse.
 * The key is per horse, not per look (E328): the horse's registered name + its kind and variant (`horseKey`), so the camp's
 * bay ('Camp horse|horse:camp-bay'), the horse playground's track horse ('Track horse|horse:camp-bay', the same coat),
 * the camp's black, Tulpar and Argymaq each keep their own. Mount.addMountable takes an explicit id to override it.
 *
 *   cleanHorseName('  kara  jorga ') → 'Kara Jorga'   (trimmed, spaces folded, ≤ 16 characters, letters / digits / ' - .)
 *   savedHorseName(key) → string | null ;  saveHorseName(key, name) ;  horseKey(a, registeredName)
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

/** a horse's key in the store: the name it was registered under + its kind and variant ('Camp horse|horse:camp-bay') */
export const horseKey = (a: Pick<Animal, 'kind' | 'variant'>, registered: string): string => `${registered}|${a.kind}:${a.variant}`;

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

export function savedHorseName(key: string): string | null {
  const n = readAll()[key];
  return n !== undefined && n.length > 0 ? n : null;
}

export function saveHorseName(key: string, name: string): void {
  try {
    const all = readAll();
    all[key] = name;
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch { /* no storage: the name lasts this session */ }
}
