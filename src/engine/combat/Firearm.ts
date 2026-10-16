import { Weapon } from './Weapon';
import * as v from 'valibot';

/** Borrow only gameplay state and reload/dry hooks; no equipment or rendering owner is required. */
type RangedPort = Pick<Weapon, 'onDry' | 'onReloadStart' | 'onReloadEnd'> & {
  readonly state: Pick<Weapon['state'], 'loaded' | 'reloading' | 'reloadProgress' | 'bolts' | 'ammo' | 'reserve'>;
};
const finite = v.pipe(v.number(), v.finite());

/** Declared quiver or magazine transfer; the lever's per-round action remains its own controller. */
export interface RangedReloadRow { readonly mode: 'quiver' | 'magazine' }
/** One source-clock reload progress and transfer owner, using the existing weapon/save envelope. */
export class RangedReload {
  private elapsed = 0;
  private readonly row: RangedReloadRow;
  constructor(row: RangedReloadRow) { this.row = row; }
  begin(weapon: RangedPort, maximum: number): void {
    const state = weapon.state;
    if (state.reloading || (this.row.mode === 'quiver'
      ? state.loaded || (state.bolts ?? 0) <= 0
      : (state.ammo ?? 0) >= maximum || state.reserve <= 0)) return;
    state.reloading = true; this.elapsed = 0; state.reloadProgress = 0;
    weapon.onReloadStart?.();
  }
  progress(weapon: RangedPort, dt: number, duration: number, scale = 1): number {
    this.elapsed += dt / scale;
    const progress = Math.min(1, this.elapsed / duration);
    weapon.state.reloadProgress = progress; return progress;
  }
  finish(weapon: RangedPort, maximum: number): void {
    const state = weapon.state;
    if (this.row.mode === 'magazine') {
      const ammo = state.ammo;
      if (ammo === undefined) throw new Error('Magazine reload requires ammunition');
      const take = Math.min(maximum - ammo, state.reserve);
      state.ammo = ammo + take; state.reserve -= take; state.loaded = state.ammo > 0;
      state.reloadProgress = 0;
    } else state.loaded = true;
    state.reloading = false; weapon.onReloadEnd?.();
  }
  /** Source-clock seconds, independent of any weapon's save envelope. */
  snapshot(): number { return this.elapsed; }
  restore(value: unknown): void { this.elapsed = v.parse(finite, value); }
}

/** Action coefficients on the caller's frame clock; contacts and presentation stay caller-owned. */
export interface RangedActionRow extends RangedReloadRow {
  readonly maximum: number; readonly interval: number; readonly reload: number; readonly autoReload: number;
  readonly autoFrom: 'shot' | 'empty';
}
/** Trigger, cooldown and automatic reload owner, composing the existing transfer controller. */
export class RangedAction {
  private static readonly clocks = v.object({ reloadT: finite, cooldown: finite, sinceFire: finite });
  private cooldown = 0;
  private sinceAction = 99;
  private readonly clock: RangedReload;
  private readonly weapon: RangedPort;
  private readonly row: RangedActionRow;
  constructor(weapon: RangedPort, row: RangedActionRow) {
    if (!Number.isInteger(row.maximum) || row.maximum < 1 || row.maximum > 65536
      || ![row.interval, row.reload, row.autoReload].every(value => Number.isFinite(value) && value >= 0 && value <= 3600)
      || row.reload === 0 || !['quiver', 'magazine'].includes(row.mode) || !['shot', 'empty'].includes(row.autoFrom)) throw new RangeError('Invalid ranged action row');
    this.weapon = weapon; this.row = row; this.clock = new RangedReload(row);
  }
  get ready(): boolean { return this.cooldown <= 0; }
  /** Admit the fire phase after reload/cooldown/loaded refusals. A native caller may fire after a true result instead of lending a callback. */
  trigger(fire?: () => void): boolean {
    const s = this.weapon.state;
    if (s.reloading || !this.ready) return false;
    if (this.row.mode === 'quiver' ? !s.loaded : (s.ammo ?? 0) <= 0) {
      this.weapon.onDry?.();
      if (this.row.autoFrom === 'empty') this.sinceAction = 0;
      this.reload(); return false;
    }
    fire?.(); return true;
  }
  /** Claim consumption at the old shot phase, before recoil, flight and fire callbacks. */
  shot(): void {
    const s = this.weapon.state;
    if (this.row.mode === 'quiver') { s.loaded = false; s.bolts = Math.max(0, (s.bolts ?? 0) - 1); }
    else { if (s.ammo === undefined) throw new Error('Magazine action requires ammunition'); s.ammo--; s.loaded = s.ammo > 0; }
    this.cooldown = this.row.interval;
    if (this.row.autoFrom === 'shot') this.sinceAction = 0;
  }
  reload(): void { this.clock.begin(this.weapon, this.row.maximum); }
  /** Historical source-clock fields; the caller owns ammunition and the surrounding save version. */
  snapshot(): { reloadT: number; cooldown: number; sinceFire: number } { return { reloadT: this.clock.snapshot(), cooldown: this.cooldown, sinceFire: this.sinceAction }; }
  /** Validate all clocks before a silent commit; no reload, transfer, callback or shot runs. Extra owner-envelope fields are ignored. */
  restore(value: unknown): void {
    const saved = v.parse(RangedAction.clocks, value);
    this.clock.restore(saved.reloadT); this.cooldown = saved.cooldown; this.sinceAction = saved.sinceFire;
  }
  /** Observe progress before transfer/end callbacks, preserving the action pose phase. */
  advance(dt: number, scale = 1, active = true, progress?: (value: number) => void): void {
    const s = this.weapon.state;
    this.cooldown = Math.max(0, this.cooldown - dt); this.sinceAction += dt;
    const empty = this.row.mode === 'quiver' ? !s.loaded && (s.bolts ?? 0) > 0 : (s.ammo ?? 0) <= 0 && s.reserve > 0;
    if (!s.reloading && empty && this.sinceAction > this.row.autoReload && active) this.reload();
    if (s.reloading) {
      const value = this.clock.progress(this.weapon, dt, this.row.reload, scale);
      progress?.(value);
      if (value >= 1) this.clock.finish(this.weapon, this.row.maximum);
    }
  }
}

/** The trigger template is shared; custom actions override readiness, cycling and reload hooks. */
export abstract class Firearm extends Weapon {
  protected sinceEmpty = 99;
  tryFire(): void {
    if (this.reloadingAction()) { this.onTriggerWhileReloading(); return; }
    if (!this.actionReady()) return;
    if (!this.roundReady()) { this.onDry?.(); this.sinceEmpty = 0; this.onEmptyTrigger(); return; }
    this.fire();
    this.onShot();
  }
  protected reloadingAction(): boolean { return this.state.reloading; }
  protected abstract actionReady(): boolean;
  protected roundReady(): boolean { return (this.state.ammo ?? 0) > 0; }
  protected onEmptyTrigger(): void { if (this.state.reserve > 0) this.reload(); }
  protected onTriggerWhileReloading(): void { /* magazine reload is uninterrupted */ }
  protected abstract fire(): void;
  protected cycle(_dt: number): void { /* semi-automatic default */ }
  protected reloadStep(_dt: number): void { /* magazine or custom action */ }
  protected animateAction(_t: number, _dt: number): void { /* authored moving parts */ }
  protected onShot(): void { /* custom action hook */ }
  protected autoReloadDue(): boolean { return false; }
}
