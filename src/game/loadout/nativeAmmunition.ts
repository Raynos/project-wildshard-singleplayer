import * as v from 'valibot';
import { LoadoutSchema, type LoadoutRows } from '@wildshard/format/loadout';
import type { NativeCombatFrame } from '../plugin/nativeItems';
import { AmmoPouch } from './pouch';

const stack = v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0));
/** The outer continuation admits a named selection and integer stacks; the owner's rows enforce exact keys/caps. */
export const NativeAmmunitionSavedSchema = v.pipe(v.record(v.string(), v.union([v.string(), stack])),
  v.check(saved => typeof saved['selected'] === 'string' && Object.entries(saved).every(([key, value]) => key === 'selected' || typeof value === 'number')));
/** Native family ports expose only their live stacks and existing ammunition methods. */
export interface NativeAmmunitionPorts {
  readonly crossbow: { readonly state: { quiver: number; loaded: boolean; reloading: boolean }; readonly addBolts: (n: number) => void };
  readonly lever: { readonly act: { readonly rounds: number }; readonly store: { reserve: number } };
  readonly longbow: { readonly state: { arrows: number } };
}

/** Native continuation over the same row-driven pouch used by the page. Native fire/reload owners remain unchanged. */
export class NativeHeldAmmunition {
  private readonly quiver: AmmoPouch<string>;
  private readonly rows: LoadoutRows;
  constructor(private readonly ports: NativeAmmunitionPorts, input: unknown, private readonly bowCapacity: number, private readonly frame?: NativeCombatFrame) {
    this.rows = v.parse(LoadoutSchema, input); this.quiver = new AmmoPouch(this.rows.pouch);
    if (!Number.isSafeInteger(bowCapacity) || bowCapacity < 0) throw new Error('Invalid native bow capacity');
  }
  get selected(): string { return this.quiver.selected; }
  count(kind: string): number {
    return kind === this.rows.firearm.ammo ? this.ports.lever.store.reserve + this.ports.lever.act.rounds
      : kind === this.rows.bow.ammo ? this.ports.longbow.state.arrows : this.quiver.count(kind, this.ports.crossbow.state.quiver);
  }
  room(kind: string, n: number): boolean { return this.count(kind) + n <= (kind === this.rows.firearm.ammo ? Infinity : kind === this.rows.bow.ammo ? this.bowCapacity : this.rows.pouch.capacity); }
  add(kind: string, n: number): void {
    if (!Number.isSafeInteger(n) || n < 0) throw new RangeError('Invalid native ammunition grant');
    if (kind === this.rows.firearm.ammo) { this.ports.lever.store.reserve += n; return; }
    if (kind === this.rows.bow.ammo) { this.ports.longbow.state.arrows = Math.min(this.bowCapacity, this.ports.longbow.state.arrows + n); return; }
    if (kind === this.selected) this.ports.crossbow.addBolts(n); else this.quiver.add(kind, n);
  }
  loadKind(kind: string): void {
    const state = this.ports.crossbow.state, n = this.quiver.select(kind, state.quiver);
    if (n === null) return;
    state.quiver = n; state.loaded = n > 0 && state.loaded;
    if (this.frame !== undefined) this.frame.ammo = kind;
  }
  cycle(): void { this.loadKind(this.quiver.next()); }
  /** Stash/fall back after the native weapon update, at the same point as the page. */
  update(): void {
    const state = this.ports.crossbow.state;
    this.quiver.stash(state.quiver);
    if (this.selected !== this.rows.pouch.fallback && state.quiver <= 0 && !state.loaded && !state.reloading) this.loadKind(this.rows.pouch.fallback);
  }
  snapshot(): Record<string, number | string> { return { selected: this.selected, ...Object.fromEntries(this.rows.pouch.kinds.map(kind => [kind, this.count(kind)])) }; }
  /** Omit unused/default parked state from existing continuations. The weapon already saves its live fallback stack. */
  get changed(): boolean { return this.selected !== this.rows.pouch.fallback || this.rows.pouch.kinds.some(kind => kind !== this.rows.pouch.fallback && this.count(kind) !== 0); }
  /** Validate fully before returning the restore mutation, retaining atomic save continuation. */
  prepareRestore(value: unknown): () => void {
    const bounded = v.pipe(stack, v.maxValue(this.rows.pouch.capacity));
    const schema = v.strictObject({ ...Object.fromEntries(this.rows.pouch.kinds.map(kind => [kind, bounded])), selected: v.picklist(this.rows.pouch.kinds) });
    const initial = { selected: this.rows.pouch.fallback, ...Object.fromEntries(this.rows.pouch.kinds.map(kind => [kind, kind === this.rows.pouch.fallback ? this.ports.crossbow.state.quiver : 0])) };
    const saved: Record<string, unknown> = v.parse(schema, value === undefined ? initial : value);
    const selected = v.parse(v.picklist(this.rows.pouch.kinds), saved['selected']);
    const counts = Object.fromEntries(this.rows.pouch.kinds.map(kind => { const count = saved[kind]; if (typeof count !== 'number') throw new Error('Missing ammunition stack'); return [kind, count]; }));
    if (counts[selected] !== this.ports.crossbow.state.quiver) throw new RangeError('Selected ammunition disagrees with its weapon');
    return () => { this.quiver.selected = selected; Object.assign(this.quiver.counts, counts); if (this.frame !== undefined) this.frame.ammo = selected; };
  }
  restore(value: unknown): void { this.prepareRestore(value)(); }
}
