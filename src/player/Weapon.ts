import type * as THREE from 'three';
import type { ImpactSurface } from './Crossbow';

/**
 * Weapon — the first-person weapon contract that main.ts, TouchControls, Combat and the HUD program against, so a
 * shard can hand the player a crossbow (`src/player/Crossbow.ts`, `ChunkDef.weapon === 'crossbow'`) or a sword
 * (`src/player/Sword.ts`, `'sword'`) without the integrator caring which.
 *
 *   const weapon: Weapon = chunk.weapon === 'sword' ? new Sword(world, targets, opts) : new Crossbow(world, targets, opts);
 *   game.onUpdate((dt, t) => weapon.update(dt, t));   // AFTER player.update
 *
 * Both take the same `{ game, sky, player, forest }` world, the same `Targets` (animals reached only through
 * `raycast`, see Crossbow.ts) and `{ allowUnlocked }`. Both parent their viewmodel to `game.camera`, own
 * `camera.fov` (Hor+ on portrait) and render after a depth clear at renderOrder 999/1000.
 *
 * Ammo is optional: a ranged weapon fills `state.bolts / loaded / reloading / reloadProgress`; a melee weapon leaves
 * `state.bolts` undefined and reports `hasAmmo === false`, and the HUD hides its BOLTS panel + meter (HUD.ts reads
 * `bolts === undefined`). `addBolts` is a no-op on a melee weapon, so the respawn refill can stay unconditional:
 * `weapon.addBolts(MAX_BOLTS - (weapon.state.bolts ?? MAX_BOLTS))`.
 *
 * `adsHeld` (the touch AIM disc, `?ads`) is iron sights on the crossbow and a harmless guard pose on the sword.
 * `reach` (metres) is set by melee weapons so Combat's "MISS" judgement ignores animals the swing could never reach.
 */
export interface WeaponState {
  /** bolts carried, including the loaded one; undefined = the weapon has no ammo (melee) */
  bolts?: number;
  loaded: boolean;
  reloading: boolean;
  reloadProgress: number;
  ads: boolean;
}

export interface AimInfo { kind: string; distance: number }

export interface Weapon {
  /** input gate: false mutes fire / ADS (menu, pause, intro) */
  enabled: boolean;
  /** force ADS (touch AIM disc toggle, dev `?ads=1`); OR'ed with the right mouse button */
  adsHeld: boolean;
  /** the viewmodel, parented to the camera — `model.visible = false` under the menu */
  readonly model: THREE.Object3D;
  readonly state: WeaponState;
  /** false on a melee weapon: the HUD hides the ammo readouts */
  readonly hasAmmo: boolean;
  /** melee reach in metres from the eye; undefined for a ranged weapon */
  readonly reach?: number;
  /** the animal under the crosshair (HUD range readout), or null */
  aimInfo: AimInfo | null;

  onFire?: () => void;
  onHit?: (kind: 'deer' | 'boar', headshot: boolean, killed: boolean) => void;
  onImpact?: (surface: ImpactSurface, point: THREE.Vector3) => void;
  onReloadStart?: () => void;
  onReloadEnd?: () => void;
  onDry?: () => void;

  /** LMB / F / a tap on the touch LOOK pad: shoot, or swing */
  tryFire(): void;
  update(dt: number, t: number): void;
  /** top up the ammo (respawn); a no-op on a melee weapon */
  addBolts(n: number): void;
}
