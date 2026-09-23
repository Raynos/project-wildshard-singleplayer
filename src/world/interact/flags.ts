/**
 * Flags — the one piece of world state the interactables kit and the quests share: a set of strings, persisted per
 * shard in localStorage ('ws.flags.v1'), with change listeners. Transient flags (`plate:*`, see types.ts) live in
 * memory only. The in-memory set is the truth for the session (iOS private mode throws on write).
 *
 *   const flags = new Flags(chunk.id);
 *   flags.set('talked:castaway');  flags.has('open:hold-grate');  flags.clear('lever:hold-a');
 *   flags.onChange((flag, on) => …);   test(flags, { all: ['a'], none: ['b'] })
 *   flags.reset()                      // dev: `?resetquest` — forget this shard's progress
 */
import { TRANSIENT_PREFIXES, type Cond } from './types';

const STORE = 'ws.flags.v1';

export type FlagListener = (flag: string, on: boolean) => void;

export class Flags {
  private set_ = new Set<string>();
  private listeners: FlagListener[] = [];
  private persist: boolean;

  constructor(readonly shard: string, persist = true) {
    this.persist = persist;
    if (!persist) return;
    try {
      const all = (JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, unknown> | null) ?? {};
      const mine = all[shard];
      if (Array.isArray(mine)) for (const f of mine) if (typeof f === 'string') this.set_.add(f);
    } catch { /* fresh */ }
  }

  has(flag: string): boolean { return this.set_.has(flag); }
  /** how many flags start with `prefix` */
  count(prefix: string): number { let n = 0; for (const f of this.set_) if (f.startsWith(prefix)) n++; return n; }
  get all(): string[] { return [...this.set_]; }

  set(flag: string, on = true): void {
    if (this.set_.has(flag) === on) return;
    if (on) this.set_.add(flag); else this.set_.delete(flag);
    if (!TRANSIENT_PREFIXES.some((p) => flag.startsWith(p))) this.save();
    for (const l of this.listeners) l(flag, on);
  }
  clear(flag: string): void { this.set(flag, false); }
  toggle(flag: string): boolean { const on = !this.has(flag); this.set(flag, on); return on; }

  onChange(fn: FlagListener): () => void {
    this.listeners.push(fn);
    return () => { const i = this.listeners.indexOf(fn); if (i !== -1) this.listeners.splice(i, 1); };
  }

  /** forget everything this shard remembers */
  reset(): void {
    const had = [...this.set_];
    this.set_.clear();
    this.save();
    for (const f of had) for (const l of this.listeners) l(f, false);
  }

  private save(): void {
    if (!this.persist) return;
    try {
      const all = (JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, unknown> | null) ?? {};
      all[this.shard] = [...this.set_].filter((f) => !TRANSIENT_PREFIXES.some((p) => f.startsWith(p)));
      localStorage.setItem(STORE, JSON.stringify(all));
    } catch { /* not persisted this session */ }
  }
}

/** a condition over the flags: every `all`, at least one `any` (when given), no `none`. An absent condition holds. */
export function test(flags: { has: (f: string) => boolean }, c: Cond | undefined): boolean {
  if (!c) return true;
  if (c.all && !c.all.every((f) => flags.has(f))) return false;
  if (c.any && c.any.length > 0 && !c.any.some((f) => flags.has(f))) return false;
  if (c.none?.some((f) => flags.has(f))) return false;
  return true;
}
