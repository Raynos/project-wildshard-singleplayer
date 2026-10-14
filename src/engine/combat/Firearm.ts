import { Weapon } from './Weapon';

/** Declared quiver or magazine transfer; the lever's per-round action remains its own controller. */
export interface RangedReloadRow { readonly mode: 'quiver' | 'magazine' }
/** One source-clock reload progress and transfer owner, using the existing weapon/save envelope. */
export class RangedReload {
  private elapsed = 0;
  private readonly row: RangedReloadRow;
  constructor(row: RangedReloadRow) { this.row = row; }
  begin(weapon: Weapon, maximum: number): void {
    const state = weapon.state;
    if (state.reloading || (this.row.mode === 'quiver'
      ? state.loaded || (state.bolts ?? 0) <= 0
      : (state.ammo ?? 0) >= maximum || state.reserve <= 0)) return;
    state.reloading = true; this.elapsed = 0; state.reloadProgress = 0;
    weapon.onReloadStart?.();
  }
  progress(weapon: Weapon, dt: number, duration: number, scale = 1): number {
    this.elapsed += dt / scale;
    const progress = Math.min(1, this.elapsed / duration);
    weapon.state.reloadProgress = progress; return progress;
  }
  finish(weapon: Weapon, maximum: number): void {
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
