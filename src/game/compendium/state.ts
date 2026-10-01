/**
 * CompendiumState — the per-entry state machine (unknown → discovered → seen → taken) and its stats, persisted per
 * shard in localStorage ('ws.compendium.v1', keyed by chunk id, like ws.progress.v1 / ws.inventory.v1). The in-memory
 * copy is the truth for the session: iOS private mode throws on write, and a corrupt save loads as empty.
 *
 *   const state = new CompendiumState(def);                  // def = compendiumFor(chunkId)
 *   state.animalNear('deer', 'stag')                         // within the tracker's hearing range → discovered
 *   state.animalSpotted('deer', 'stag')                      // one individual in view → seen, SEEN + 1
 *   state.animalKilled('deer', 'stag', 187)                  // → taken, TAKEN + 1, BEST = max(kg)
 *   state.placeNear('pond') / state.placeVisited('pond')     // → discovered / seen (VISITS + 1)
 *   state.stats('red-deer') → { state, seen, taken, best }   state.onChange = (entry, from, to) => …
 *
 * A state only moves forward; `taken` implies `seen` (a kill you never "spotted" still unlocks the plate).
 */
import { STATE_ORDER, type EntryDef, type EntryState, type EntryStats, type ShardCompendium } from './types';

export const COMPENDIUM_STORE = 'ws.compendium.v1';

/** one entry's save: s = STATE_ORDER index, n = seen, t = taken, b = best kg */
interface Saved { s: number; n: number; t: number; b: number }
type ShardSave = Record<string, Saved>;

const num = (v: unknown, lo = 0): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, v) : lo);

function loadAll(): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(COMPENDIUM_STORE) ?? '{}');
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch { return {}; }
}

/** a shard's save, cleaned: unknown ids dropped, every field a finite number in range */
function loadShard(chunkId: string, ids: ReadonlySet<string>): ShardSave {
  const raw = loadAll()[chunkId];
  const out: ShardSave = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ids.has(id) || typeof v !== 'object' || v === null) continue;
    const r = v as Record<string, unknown>;
    out[id] = { s: Math.min(STATE_ORDER.length - 1, Math.round(num(r['s']))), n: Math.round(num(r['n'])), t: Math.round(num(r['t'])), b: num(r['b']) };
  }
  return out;
}

export class CompendiumState {
  private save: ShardSave;
  private byId = new Map<string, EntryDef>();
  /** entry → from → to, for every forward move (the "new journal entry" toast, the trophy wall's re-mount) */
  onChange?: (entry: EntryDef, from: EntryState, to: EntryState) => void;
  /** any stat moved (the open book re-renders) */
  onUpdate?: () => void;

  constructor(readonly def: ShardCompendium) {
    for (const e of def.entries) this.byId.set(e.id, e);
    this.save = loadShard(def.chunkId, new Set(this.byId.keys()));
  }

  entry(id: string): EntryDef | undefined { return this.byId.get(id); }

  stats(id: string): EntryStats {
    const s = this.save[id];
    return { state: STATE_ORDER[s?.s ?? 0] ?? 'unknown', seen: s?.n ?? 0, taken: s?.t ?? 0, best: s?.b ?? 0 };
  }
  state(id: string): EntryState { return this.stats(id).state; }
  /** has the entry reached `at` (or beyond)? */
  reached(id: string, at: EntryState): boolean { return STATE_ORDER.indexOf(this.state(id)) >= STATE_ORDER.indexOf(at); }

  /** entries that answer to a kill / sighting of (kind, variant) */
  matching(kind: string, variant?: string): EntryDef[] {
    return this.def.entries.filter((e) => e.match?.kind === kind && (e.match.variants === undefined || (variant !== undefined && e.match.variants.includes(variant))));
  }
  /** the place entry for a POI id (entries of kind 'place' use the POI id as their own) */
  place(id: string): EntryDef | undefined { const e = this.byId.get(id); return e?.kind === 'place' ? e : undefined; }

  // ── the generic transitions ──
  /** move `id` forward to `to` (never back); returns whether anything changed. `bump` edits the counters first. */
  private advance(id: string, to: EntryState, bump?: (s: Saved) => void): boolean {
    const e = this.byId.get(id);
    if (!e) return false;
    const s = (this.save[id] ??= { s: 0, n: 0, t: 0, b: 0 });
    const before = { ...s };
    bump?.(s);
    const from = STATE_ORDER[s.s] ?? 'unknown';
    const target = STATE_ORDER.indexOf(to);
    if (target > s.s) s.s = target;
    const moved = s.s !== before.s, changed = moved || s.n !== before.n || s.t !== before.t || s.b !== before.b;
    if (!changed) return false;
    this.persist();
    if (moved) this.onChange?.(e, from, STATE_ORDER[s.s] ?? to);
    this.onUpdate?.();
    return true;
  }

  discover(id: string): boolean { return this.advance(id, 'discovered'); }
  see(id: string): boolean { return this.advance(id, 'seen', (s) => { s.n++; }); }
  take(id: string, kg = 0): boolean {
    const e = this.byId.get(id);
    if (e?.kind === 'place') return false; // a place is visited, never taken
    return this.advance(id, 'taken', (s) => { s.t++; if (kg > s.b) s.b = Math.round(kg); });
  }

  // ── the game's events ──
  animalNear(kind: string, variant?: string): void { for (const e of this.matching(kind, variant)) this.discover(e.id); }
  animalSpotted(kind: string, variant?: string): void { for (const e of this.matching(kind, variant)) this.see(e.id); }
  animalKilled(kind: string, variant: string | undefined, kg: number): void { for (const e of this.matching(kind, variant)) this.take(e.id, kg); }
  placeNear(id: string): void { if (this.place(id)) this.discover(id); }
  placeVisited(id: string): void { if (this.place(id)) this.see(id); }

  /** entries of a tab, in table order */
  tab(tab: string): EntryDef[] { return this.def.entries.filter((e) => e.tab === tab); }
  /** how many of a tab's entries have reached `at` */
  count(tab: string, at: EntryState): number { return this.tab(tab).filter((e) => this.reached(e.id, at)).length; }

  private persist(): void {
    try {
      const all = loadAll();
      all[this.def.chunkId] = this.save;
      localStorage.setItem(COMPENDIUM_STORE, JSON.stringify(all));
    } catch { /* not persisted this session */ }
  }
}
