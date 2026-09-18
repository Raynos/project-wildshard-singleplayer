import type * as THREE from 'three';
import { Crossbow, MAX_BOLTS, type ImpactSurface } from './Crossbow';
import type { Weapon } from './Weapon';
import type { Rifle } from './Rifle';

/**
 * Weapons — the player's kit: the shard's base weapon (`Weapon.ts`: the crossbow, or Driftwood's sword) and the AR-15
 * (Rifle.ts) behind one `KitWeapon` interface, plus swapping between them. (`Weapon.ts` is the single-weapon contract a
 * shard programs against; this manager sits a level above it: several weapons, one held, the rest holstered.)
 *
 *   const weapons = new Weapons(crossbow, rifle);          // the base weapon is held first; the rifle is LOCKED until
 *                                                          // `unlock('rifle')` (the cabin pickup, WeaponPickup.ts; `?weapon=rifle` in main.ts)
 *   const weapons = new Weapons(sword, rifle, [{ weapon: ironSword, id: 'sword-iron', name: 'Iron sword' }]);
 *                                                          // `extras`: more shard weapons (Weapon.ts rigs) after the rifle, each LOCKED
 *                                                          // until `unlock(id)` — Driftwood's iron sword (IronSword.ts pickup on the wreck)
 *   weapons.onFire = …  weapons.onHit = …  weapons.onImpact = …   // wire the hooks ONCE here; every weapon forwards to them
 *   game.onUpdate((dt, t) => weapons.update(dt, t));       // AFTER player.update — updates BOTH weapons (bolts in flight,
 *                                                          // brass, puffs and tracers keep going while a weapon is holstered)
 *   weapons.current.state → { ammo, magazine, reserve, loaded, reloading, reloadProgress, ads }   (the HUD reads this)
 *
 * Input (only while the held weapon's `inputAllowed()`): `1` / `2` / `3` the OWNED weapons in kit order (Pine Hollow:
 * 1 crossbow, 2 AR-15; Driftwood: 1 wooden sword, 2 iron sword once found), `Q` swap — a locked weapon is ignored. Touch: the SWAP pill (TouchControls.ts, shown once a second weapon is unlocked — `onUnlock`) calls `swap()`.
 * Fire / ADS / reload input lives in each weapon; the manager keeps `enabled` and the touch AIM latch (`adsHeld`) and
 * applies them to whichever weapon is held.
 *
 * Swap animation (SWAP_TIME each way): the outgoing weapon's `holster` runs 0 → 1 (its pose code drops it out of the
 * frame), then it is hidden and disabled, the incoming one is shown and its `holster` runs 1 → 0. Every weapon keeps its
 * own pose code; the manager only drives the blend. Input is off for the half second of the swap.
 */

export type WeaponId = 'crossbow' | 'sword' | 'rifle' | 'sword-iron';
/** species id (`Animal.kind`) — any registered species */
export type AnimalKind = string;
/** `ammo` undefined = no ammo on this weapon (the sword): the HUD hides its readouts */
export interface WeaponState { ammo: number | undefined; magazine: number; reserve: number; loaded: boolean; reloading: boolean; reloadProgress: number; ads: boolean }
export interface AimInfo { kind: AnimalKind; distance: number }
export interface WeaponHooks {
  onFire?: () => void;
  onHit?: (kind: AnimalKind, headshot: boolean, killed: boolean) => void;
  onImpact?: (surface: ImpactSurface, point: THREE.Vector3) => void;
  onReloadStart?: () => void;
  onReloadEnd?: () => void;
  onDry?: () => void;
}
export interface KitWeapon extends WeaponHooks {
  readonly id: WeaponId;
  /** HUD tag: "AR-15" / "CROSSBOW" */
  readonly name: string;
  /** HUD strip label: "Bolts" / "Rounds" */
  readonly ammoLabel: string;
  /** HUD strip bars over the magazine */
  readonly segments: number;
  readonly model: THREE.Object3D;
  /** input accepted (menu / pause / the other weapon is held → false) */
  enabled: boolean;
  /** ADS held externally (touch AIM latch, `?ads=1`) — OR'ed with the right mouse button */
  adsHeld: boolean;
  /** 0..1 swap blend the manager drives: 1 = out of the frame */
  holster: number;
  readonly state: WeaponState;
  readonly aimInfo: AimInfo | null;
  tryFire(): void;
  reload(): void;
  update(dt: number, t: number): void;
  aimRay(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3;
  /** shown + held (true) or holstered (false: hidden, input off) */
  setActive(on: boolean): void;
  inputAllowed(): boolean;
}

const SWAP_TIME = 0.25; // s per half (drop, then raise)

/** a shard weapon (Weapon.ts) plus the optional hooks the manager uses when present (Crossbow and Sword both have them) */
export type BaseLike = Weapon & Partial<Pick<KitWeapon, 'holster' | 'reload' | 'aimRay' | 'inputAllowed'>>;
/** an extra shard weapon for the kit (the iron sword): its rig, its kit id and its HUD tag */
export interface ExtraWeapon { weapon: BaseLike; id: WeaponId; name: string }

/** the shard's base `Weapon` (Crossbow or Sword) → KitWeapon: bolts map onto ammo over a MAX_BOLTS "magazine" (the HUD keeps
 *  showing 27 / 30), no reserve; the sword has no ammo (`hasAmmo === false` → `ammo` undefined, the HUD hides the strip). */
class BaseWeapon implements KitWeapon {
  readonly id: WeaponId;
  readonly name: string;
  readonly ammoLabel: string;
  readonly segments: number;
  onFire?: () => void; onHit?: KitWeapon['onHit']; onImpact?: KitWeapon['onImpact']; onReloadStart?: () => void; onReloadEnd?: () => void; onDry?: () => void;
  private cache: WeaponState = { ammo: 0, magazine: MAX_BOLTS, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  constructor(private bow: BaseLike, id?: WeaponId, name?: string) {
    const isBow = bow instanceof Crossbow;
    this.id = id ?? (isBow ? 'crossbow' : 'sword'); this.name = name ?? (isBow ? 'Crossbow' : 'Sword'); this.ammoLabel = isBow ? 'Bolts' : ''; this.segments = isBow ? 4 : 0;
    bow.onFire = () => this.onFire?.();
    bow.onHit = (k, h, d) => this.onHit?.(k, h, d);
    bow.onImpact = (s, p) => this.onImpact?.(s, p);
    bow.onReloadStart = () => this.onReloadStart?.();
    bow.onReloadEnd = () => this.onReloadEnd?.();
    bow.onDry = () => this.onDry?.();
  }
  get model() { return this.bow.model; }
  get enabled() { return this.bow.enabled; } set enabled(v: boolean) { this.bow.enabled = v; }
  get adsHeld() { return this.bow.adsHeld; } set adsHeld(v: boolean) { this.bow.adsHeld = v; }
  get holster() { return this.bow.holster ?? 0; } set holster(v: number) { this.bow.holster = v; }
  get state() {
    const s = this.bow.state, c = this.cache;
    c.ammo = this.bow.hasAmmo ? s.bolts : undefined; c.loaded = s.loaded; c.reloading = s.reloading; c.reloadProgress = s.reloadProgress; c.ads = s.ads;
    return c;
  }
  get aimInfo() { return this.bow.aimInfo; }
  tryFire() { this.bow.tryFire(); }
  reload() { this.bow.reload?.(); }
  update(dt: number, t: number) { this.bow.update(dt, t); }
  aimRay(o: THREE.Vector3, d: THREE.Vector3) {
    if (this.bow.aimRay) return this.bow.aimRay(o, d);
    const cam = this.bow.model.parent as THREE.Camera; cam.getWorldDirection(d); o.setFromMatrixPosition(cam.matrixWorld); return d; // the viewmodel hangs off the camera
  }
  setActive(on: boolean) { this.bow.model.visible = on; if (!on) this.bow.enabled = false; }
  inputAllowed() { return this.bow.inputAllowed ? this.bow.inputAllowed() : this.bow.enabled; }
}

export class Weapons implements WeaponHooks {
  readonly list: KitWeapon[];
  current: KitWeapon;
  onFire?: () => void; onHit?: KitWeapon['onHit']; onImpact?: KitWeapon['onImpact']; onReloadStart?: () => void; onReloadEnd?: () => void; onDry?: () => void;
  /** a swap started (play the sling rustle) */
  onSwap?: (to: WeaponId) => void;
  /** a weapon was unlocked (the touch layer shows its SWAP pill) */
  onUnlock?: (id: WeaponId) => void;
  private unlocked = new Set<WeaponId>(['crossbow', 'sword']);
  private _enabled = true;
  private _adsHeld = false;
  private _visible = true;
  private swapping: { from: KitWeapon; to: KitWeapon; t: number; switched: boolean } | null = null;

  constructor(base: BaseLike, rifle: Rifle, extras: ExtraWeapon[] = []) {
    this.list = [new BaseWeapon(base), rifle, ...extras.map((e) => new BaseWeapon(e.weapon, e.id, e.name))];
    for (const w of this.list) {
      w.onFire = () => this.onFire?.();
      w.onHit = (k, h, d) => this.onHit?.(k, h, d);
      w.onImpact = (s, p) => this.onImpact?.(s, p);
      w.onReloadStart = () => this.onReloadStart?.();
      w.onReloadEnd = () => this.onReloadEnd?.();
      w.onDry = () => this.onDry?.();
    }
    this.current = this.list[0];
    for (const w of this.list) w.setActive(w === this.current);
    this.apply();
    document.addEventListener('keydown', (e) => {
      if (e.repeat || !this.current.inputAllowed()) return;
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') { const w = this.available[Number(e.code.slice(5)) - 1]; if (w) this.select(w.id); }
      else if (e.code === 'KeyQ') this.swap();
    });
    (window as unknown as { __weapons: Weapons }).__weapons = this; // dev / screenshot hook
  }

  /** input on the held weapon (menu / pause → false) */
  get enabled() { return this._enabled; }
  set enabled(on: boolean) { this._enabled = on; this.apply(); }
  setEnabled(on: boolean) { this.enabled = on; }
  /** the held weapon's viewmodel (hidden under the main menu) */
  get visible() { return this._visible; }
  set visible(on: boolean) { this._visible = on; this.current.model.visible = on; }
  /** the touch AIM latch — survives a swap (the incoming weapon comes up sighted) */
  get adsHeld() { return this._adsHeld; }
  set adsHeld(on: boolean) { this._adsHeld = on; this.apply(); }
  get swappingNow() { return this.swapping !== null; }

  private apply() {
    for (const w of this.list) {
      const held = w === this.current && !this.swapping;
      w.enabled = this._enabled && held;
      w.adsHeld = held && this._adsHeld;
    }
  }

  get(id: WeaponId) { return this.list.find((w) => w.id === id)!; }
  /** is `id` in the player's possession (the crossbow always; the rifle after its pickup / `?weapon=rifle`) */
  has(id: WeaponId) { return this.unlocked.has(id); }
  /** the unlocked weapons, in kit order */
  get available() { return this.list.filter((w) => this.unlocked.has(w.id)); }
  unlock(id: WeaponId) {
    if (this.unlocked.has(id)) return;
    this.unlocked.add(id);
    this.onUnlock?.(id);
  }
  /** hold `id` (if unlocked); animated unless `instant` (start-up `?weapon=`) */
  select(id: WeaponId, instant = false) {
    if (!this.unlocked.has(id)) return;
    const to = this.get(id);
    if (to === this.current && !this.swapping) return;
    if (this.swapping) { if (this.swapping.to === to) return; this.finishSwap(); if (to === this.current) return; }
    if (instant) {
      this.current.setActive(false); this.current.holster = 0;
      this.current = to; to.holster = 0; to.setActive(true); to.model.visible = this._visible;
      this.apply();
      return;
    }
    this.swapping = { from: this.current, to, t: 0, switched: false };
    this.apply();
    this.onSwap?.(id);
  }
  /** the next unlocked weapon after the held one (nothing happens while only the crossbow is owned) */
  swap() {
    const list = this.available;
    if (list.length < 2) return;
    const i = list.indexOf(this.current);
    this.select(list[(i + 1) % list.length].id);
  }
  private finishSwap() {
    const s = this.swapping!;
    s.from.holster = 0; s.to.holster = 0;
    if (!s.switched) { s.from.setActive(false); this.current = s.to; s.to.setActive(true); s.to.model.visible = this._visible; }
    this.swapping = null;
    this.apply();
  }

  tryFire() { this.current.tryFire(); }
  reload() { this.current.reload(); }
  aimRay(o: THREE.Vector3, d: THREE.Vector3) { return this.current.aimRay(o, d); }
  get aimInfo() { return this.current.aimInfo; }
  get state() { return this.current.state; }

  update(dt: number, t: number) {
    const s = this.swapping;
    if (s) {
      s.t += dt;
      if (s.t < SWAP_TIME) s.from.holster = s.t / SWAP_TIME;
      else {
        if (!s.switched) { s.switched = true; s.from.holster = 1; s.from.setActive(false); this.current = s.to; s.to.holster = 1; s.to.setActive(true); s.to.model.visible = this._visible; }
        s.to.holster = Math.max(0, 1 - (s.t - SWAP_TIME) / SWAP_TIME);
        if (s.t >= SWAP_TIME * 2) this.finishSwap();
      }
    }
    for (const w of this.list) w.update(dt, t);
  }
}
