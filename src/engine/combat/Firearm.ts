import { Weapon } from './Weapon';

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
