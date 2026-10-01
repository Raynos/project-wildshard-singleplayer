import type { Vector3, Matrix4 } from 'three';
import { Equipment, type WeaponId, type EquipmentRow, type EquipContext } from './Equipment';
import type { WeaponChargePhase } from './cues';

export type ImpactSurface = 'wood' | 'ground' | 'flesh';
export interface ViewFrame { matrixWorld: Matrix4; getWorldDirection: (dir: Vector3) => Vector3 }
/** Minimal view port; simulation does not import the renderer's scene types. */
export interface EquipmentView { visible: boolean; parent: ViewFrame | null; removeFromParent: () => void }

export interface WeaponState {
  ammo: number | undefined; magazine: number; reserve: number;
  loaded: boolean; reloading: boolean; reloadProgress: number; ads: boolean;
  /** Compatibility for the existing quiver/bolt source code, removed with the ranged family move. */
  bolts?: number;
}
export interface AimInfo { kind: string; distance: number }
export interface WeaponHooks {
  onFire?: (() => void) | undefined;
  onHit?: ((kind: string, headshot: boolean, killed: boolean) => void) | undefined;
  onImpact?: ((surface: ImpactSurface, point: Vector3) => void) | undefined;
  onReloadStart?: (() => void) | undefined;
  onReloadEnd?: (() => void) | undefined;
  onDry?: (() => void) | undefined;
}
export abstract class Weapon extends Equipment implements WeaponHooks {
  readonly slot = 'main';
  override readonly id: WeaponId;
  constructor(row: EquipmentRow) {
    super(row);
    if (row.legacySlot === undefined) throw new Error(`Equipment ${row.id} has no main slot`);
    this.id = row.legacySlot;
  }
  abstract readonly model: EquipmentView;
  abstract readonly state: WeaponState;
  abstract adsHeld: boolean;
  altHeld = false;
  abstract aimInfo: AimInfo | null;
  declare readonly reach?: number;
  get charge(): number | undefined { return undefined; }
  ammoSelect?: (() => void) | undefined;
  onFire?: WeaponHooks['onFire']; onHit?: WeaponHooks['onHit']; onImpact?: WeaponHooks['onImpact'];
  onReloadStart?: WeaponHooks['onReloadStart']; onReloadEnd?: WeaponHooks['onReloadEnd']; onDry?: WeaponHooks['onDry'];
  override install(ctx: EquipContext): void {
    super.install(ctx);
    ctx.scope.onDispose(() => { this.model.visible = false; this.model.removeFromParent(); });
  }
  get hasAmmo(): boolean { return this.row.ui.ammo !== undefined; }
  get ammoLabel(): string { return this.row.ui.ammo?.label ?? ''; }
  get segments(): number { return this.row.ui.ammo?.segments ?? 0; }
  chargeEvent(phase: WeaponChargePhase, value?: number): void {
    this.equipEvents?.emit('weapon.charge', { id: this.row.id, phase, ...(value === undefined ? {} : { value }) });
  }
  abstract tryFire(): void;
  reload(): void { /* Melee weapons and tools have no reload action. */ }
  addBolts(_n: number): void { /* Ammo families override the refill. */ }
  aimRay(origin: Vector3, dir: Vector3): Vector3 {
    const camera = this.model.parent;
    if (!camera) throw new Error(`Equipment ${this.row.id} has no viewmodel camera`);
    camera.getWorldDirection(dir); origin.setFromMatrixPosition(camera.matrixWorld); return dir;
  }
  setActive(on: boolean): void { this.model.visible = on; if (!on) this.enabled = false; }
  inputAllowed(): boolean { return this.enabled; }
}
/** Keep the actual bolt/quiver object: legacy code mutates bolts while the service/HUD reads ammo. */
export function quiverState(state: { bolts: number; loaded: boolean; reloading: boolean; reloadProgress: number; ads: boolean }, magazine: number): WeaponState & { bolts: number; ammo: number } {
  const result = Object.assign(state, { ammo: state.bolts, magazine, reserve: 0 });
  Object.defineProperty(result, 'ammo', { enumerable: true, get: () => state.bolts, set: (n: number) => { state.bolts = n; } });
  return result;
}
