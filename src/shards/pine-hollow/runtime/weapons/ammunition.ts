import * as v from 'valibot';
import { Quiver, POUCH_MAX, type AmmoKind, type BoltKind } from '../../loadout/ammo';
import { LONGBOW_LOOSE } from '../../weapons/longbowFlight';

const stack = v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0), v.maxValue(POUCH_MAX));
export const PINE_AMMO_SAVED = v.strictObject({ selected: v.picklist(['iron', 'pitch', 'broadhead']), iron: stack, pitch: stack, broadhead: stack });

export interface PineAmmunitionPorts {
  readonly crossbow: { readonly state: { quiver: number; loaded: boolean; reloading: boolean }; readonly addBolts: (n: number) => void };
  readonly lever: { readonly act: { readonly rounds: number }; readonly store: { reserve: number } };
  readonly longbow: { readonly state: { arrows: number } };
}

/** Native adapter for loadout.ts's actual Quiver law. Live ammunition stays in each weapon; this owns only parked
 * crossbow stacks and the selection. Switching changes the loaded bolt's kind without reloading, as on the page. */
export class PineAmmunition {
  private readonly quiver = new Quiver();
  private readonly ports: PineAmmunitionPorts;
  constructor(ports: PineAmmunitionPorts) { this.ports = ports; }
  get selected(): BoltKind { return this.quiver.selected; }
  count(kind: AmmoKind): number {
    return kind === 'cartridge' ? this.ports.lever.store.reserve + this.ports.lever.act.rounds
      : kind === 'arrow' ? this.ports.longbow.state.arrows : this.quiver.count(kind, this.ports.crossbow.state.quiver);
  }
  room(kind: AmmoKind, n: number): boolean { return this.count(kind) + n <= (kind === 'cartridge' ? Infinity : kind === 'arrow' ? LONGBOW_LOOSE.quiver : POUCH_MAX); }
  add(kind: AmmoKind, n: number): void {
    if (!Number.isSafeInteger(n) || n < 0) throw new RangeError('Invalid Pine ammunition grant');
    if (kind === 'cartridge') { this.ports.lever.store.reserve += n; return; }
    if (kind === 'arrow') { this.ports.longbow.state.arrows = Math.min(LONGBOW_LOOSE.quiver, this.ports.longbow.state.arrows + n); return; }
    if (kind === this.selected) this.ports.crossbow.addBolts(n); else this.quiver.add(kind, n);
  }
  loadKind(kind: BoltKind): void {
    const state = this.ports.crossbow.state, n = this.quiver.select(kind, state.quiver);
    if (n === null) return;
    state.quiver = n; state.loaded = n > 0 && state.loaded;
  }
  cycle(): void { this.loadKind(this.quiver.next()); }
  /** Called after weapon updates, exactly where the page stashes/falls back after an exhausted special stack. */
  update(): void {
    const state = this.ports.crossbow.state;
    this.quiver.stash(state.quiver);
    if (this.selected !== 'iron' && state.quiver <= 0 && !state.loaded && !state.reloading) this.loadKind('iron');
  }
  snapshot(): v.InferOutput<typeof PINE_AMMO_SAVED> {
    return { selected: this.selected, iron: this.count('iron'), pitch: this.count('pitch'), broadhead: this.count('broadhead') };
  }
  /** Omit unused/default parked state from existing continuations; the crossbow already saves its live iron count. */
  get changed(): boolean { return this.selected !== 'iron' || this.count('pitch') !== 0 || this.count('broadhead') !== 0; }
  prepareRestore(value: unknown): () => void {
    const saved = v.parse(PINE_AMMO_SAVED, value === undefined ? { selected: 'iron', iron: this.ports.crossbow.state.quiver, pitch: 0, broadhead: 0 } : value);
    if (saved[saved.selected] !== this.ports.crossbow.state.quiver) throw new RangeError('Pine selected ammunition disagrees with its weapon');
    return () => { this.quiver.selected = saved.selected; Object.assign(this.quiver.counts, { iron: saved.iron, pitch: saved.pitch, broadhead: saved.broadhead }); };
  }
  restore(value: unknown): void { this.prepareRestore(value)(); }
}
