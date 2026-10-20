import * as v from 'valibot';
import { LoadoutSchema, type LoadoutRows } from '@wildshard/format/loadout';
import { readNativeRangedItem, type NativeCombatFrame, type NativeBoltItem, type NativeCycleItem, type NativeBowItem } from '../plugin/nativeItems';
import type { SimHost } from '@wildshard/engine/sim';
import { parseItems } from '@wildshard/format/items';
import { AmmoPouch } from './pouch';

const stack = v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0));
/** The outer continuation admits a named selection and integer stacks; the owner's rows enforce exact keys/caps. */
export const NativeAmmunitionSavedSchema = v.pipe(v.record(v.string(), v.union([v.string(), stack])),
  v.check(saved => typeof saved['selected'] === 'string' && Object.entries(saved).every(([key, value]) => key === 'selected' || typeof value === 'number')));

const owners = new WeakMap<SimHost, NativeHeldAmmunition>();
/** Borrow the quiver installed by the native equipment owner. */
export function nativeHeldAmmunition(host: SimHost): NativeHeldAmmunition {
  const owner = owners.get(host); if (owner === undefined) throw new Error('Missing native ammunition owner'); return owner;
}
/** Native continuation over the row-driven pouch. Construction alone never replaces the installed equipment owner. */
export class NativeHeldAmmunition {
  private readonly quiver: AmmoPouch<string>;
  private readonly rows: LoadoutRows;
  private readonly ports: { readonly crossbow: NativeBoltItem; readonly lever: NativeCycleItem; readonly longbow: NativeBowItem };
  private readonly bowCapacity: number;
  private readonly frame: NativeCombatFrame;
  constructor(host: SimHost, input: unknown, itemRows: unknown) {
    this.rows = v.parse(LoadoutSchema, input); this.quiver = new AmmoPouch(this.rows.pouch);
    const items = parseItems(itemRows).rows;
    const launcher = items.find(item => item.id === this.rows.launcher.item);
    const firearm = items.find(item => item.kind === 'weapon' && item.equipment?.legacySlot === this.rows.firearm.slot);
    const bow = items.find(item => item.kind === 'weapon' && item.equipment?.legacySlot === this.rows.bow.slot);
    if (launcher?.kind !== 'weapon' || firearm?.kind !== 'weapon' || bow?.kind !== 'weapon'
      || launcher.ranged === undefined || firearm.ranged === undefined || bow.ranged === undefined || bow.profile?.family !== 'bow')
      throw new Error('Native loadout identities need admitted ranged items');
    const bolt = readNativeRangedItem(host, launcher.ranged.slot), cycle = readNativeRangedItem(host, firearm.ranged.slot), arrow = readNativeRangedItem(host, bow.ranged.slot);
    if (bolt.kind !== 'bolt' || cycle.kind !== 'cycle' || arrow.kind !== 'bow') throw new Error('Native loadout has incompatible families');
    this.ports = { crossbow: bolt.item, lever: cycle.item, longbow: arrow.item };
    this.bowCapacity = bow.profile.quiver; this.frame = bolt.frame;
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
    this.frame.ammo = kind;
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
    return () => { this.quiver.selected = selected; Object.assign(this.quiver.counts, counts); this.frame.ammo = selected; };
  }
  restore(value: unknown): void { this.prepareRestore(value)(); }
}
/** Publish exactly one native equipment owner; continuation candidates stay private until restored. */
export function installNativeHeldAmmunition(host: SimHost, input: unknown, itemRows: unknown): NativeHeldAmmunition {
  if (owners.has(host)) throw new Error('Duplicate native ammunition owner');
  const owner = new NativeHeldAmmunition(host, input, itemRows);
  owners.set(host, owner); host.scope.onDispose(() => { owners.delete(host); });
  return owner;
}
