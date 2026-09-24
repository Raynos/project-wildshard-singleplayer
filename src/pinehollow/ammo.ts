/**
 * Pine Hollow's special ammunition (PINE-HOLLOW-REMASTER PH-C11, Jake's PH-U16: the trader swaps hides / antlers / resin
 * for special bolts and cartridges). Pure rules, no THREE / DOM (test/pine-loadout.test.ts); loadout.ts applies them.
 *
 *   IRON bolts       the crossbow's own, as ever. In the rain their goose fletching soaks: they drop and slow more.
 *   PITCH-TIPPED     resin-sealed heads and fletching: a flatter flight (less drop, less drag), and the rain does nothing
 *                    to them — "they fly true in the rain".
 *   BROADHEAD        a wide, heavy cutting head: a touch more drop, but deeper wounds in deer-sized game (deer, boar —
 *                    ×BROADHEAD_DEER); the bigger beasts' hides and the King's bark turn the edge (×1).
 *   CARTRIDGES       the lever-action's .30-30s (its reserve); ARROWS the Warden's Longbow's quiver.
 *
 *   boltFlight(kind, rain) → { gravity, drag }   multipliers on the crossbow's flight (Crossbow.BoltMod)
 *   boltDamage(kind, animalKind) → ×            on the damage model's number
 *   const q = new Quiver({ pitch: 4 }); q.cycle(live) → the next kind you can load (iron always)
 */

export type BoltKind = 'iron' | 'pitch' | 'broadhead';
export type AmmoKind = BoltKind | 'cartridge' | 'arrow';
export const BOLT_KINDS: readonly BoltKind[] = ['iron', 'pitch', 'broadhead'];
/** the HUD strip's label for the loaded kind */
export const BOLT_LABEL: Readonly<Record<BoltKind, string>> = { iron: 'Bolts', pitch: 'Pitch bolts', broadhead: 'Broadheads' };
/** the toast when you load one */
export const BOLT_NAME: Readonly<Record<BoltKind, string>> = { iron: 'Iron bolts', pitch: 'Pitch-tipped bolts', broadhead: 'Broadhead bolts' };
/** a stack's cap (the crossbow's MAX_BOLTS, the same for every kind) */
export const POUCH_MAX = 30;
/** deer-sized game: where a broadhead's edge counts */
export const DEER_SIZED: ReadonlySet<string> = new Set(['deer', 'boar']);
export const BROADHEAD_DEER = 1.4;
/** the rain's toll on a wet bolt at full rain: × gravity, × drag */
export const WET_GRAVITY = 0.2, WET_DRAG = 0.9;

const clampStack = (n: number): number => Math.max(0, Math.min(POUCH_MAX, Math.round(n)));

export interface Flight { gravity: number; drag: number }

/** the flight multipliers of a `kind` bolt with the rain at `rain` (0 dry … 1 a downpour) */
export function boltFlight(kind: BoltKind, rain: number): Flight {
  const r = Math.min(1, Math.max(0, rain));
  if (kind === 'pitch') return { gravity: 0.8, drag: 0.7 };
  const base = kind === 'broadhead' ? { gravity: 1.08, drag: 1.1 } : { gravity: 1, drag: 1 };
  return { gravity: base.gravity * (1 + WET_GRAVITY * r), drag: base.drag * (1 + WET_DRAG * r) };
}

/** × the damage model's number for a `kind` bolt landing in an animal of `animalKind` */
export function boltDamage(kind: BoltKind, animalKind: string): number {
  return kind === 'broadhead' && DEER_SIZED.has(animalKind) ? BROADHEAD_DEER : 1;
}

/**
 * The crossbow's three stacks. The LOADED kind's count lives in the crossbow (`state.bolts`, which every refill tops up);
 * the others wait here. `stash(live)` puts the live count back before a change; `cycle` / `select` return the count the
 * crossbow takes next.
 */
export class Quiver {
  readonly counts: Record<BoltKind, number> = { iron: POUCH_MAX, pitch: 0, broadhead: 0 };
  selected: BoltKind = 'iron';
  constructor(start: Partial<Record<BoltKind, number>> = {}) {
    for (const k of BOLT_KINDS) { const n = start[k]; if (n !== undefined) this.counts[k] = clampStack(n); }
  }
  /** the crossbow's live count of the loaded kind, written back */
  stash(live: number): void { this.counts[this.selected] = clampStack(live); }
  /** load `kind` (if there are any, iron always): returns the crossbow's new count, or null when nothing changes */
  select(kind: BoltKind, live: number): number | null {
    this.stash(live);
    if (kind === this.selected || (kind !== 'iron' && this.counts[kind] <= 0)) return null;
    this.selected = kind;
    return this.counts[kind];
  }
  /** the next kind after the loaded one that has bolts (iron always counts) */
  next(): BoltKind {
    const i = BOLT_KINDS.indexOf(this.selected);
    for (let s = 1; s <= BOLT_KINDS.length; s++) {
      const k = BOLT_KINDS[(i + s) % BOLT_KINDS.length] ?? 'iron';
      if (k === 'iron' || this.counts[k] > 0) return k;
    }
    return 'iron';
  }
  cycle(live: number): number | null { this.stash(live); return this.select(this.next(), this.counts[this.selected]); }
  /** add `n` of `kind` to its stack — the loaded kind's goes to the crossbow instead (the caller's `addBolts`) */
  add(kind: BoltKind, n: number): void { if (kind !== this.selected) this.counts[kind] = clampStack(this.counts[kind] + n); }
  /** how many of `kind` you have (the loaded one: the live count) */
  count(kind: BoltKind, live: number): number { return kind === this.selected ? live : this.counts[kind]; }
}
