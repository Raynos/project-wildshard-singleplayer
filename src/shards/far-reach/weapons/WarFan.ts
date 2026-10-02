import { Weapon, blocks, type Actor, type App, type EquipContext, type WeaponState } from '#engine';
import { Vector2, Vector3 } from 'three';
import { FAN_ROW } from './rows';
import { fanModel } from './fanModel';

/** Anything the fan can strike: a world position and its combat actor. */
export interface FanTarget { readonly position: Vector3; readonly actor: Actor | null; impulse?: (velocity: Vector3) => void }
export const SWING = { reach: 3.4, halfAngle: 0.9, light: 16, heavy: 30, cooldown: 0.45, heavyCooldown: 0.85 } as const;
export const GUST = { reach: 9, halfAngle: 0.6, push: 15, lift: 4, damage: 4, cooldown: 1.6 } as const;

/** True when `to` lies inside a cone of `reach` metres and `halfAngle` radians around `dir` from `from`. */
export function inCone(from: Vector3, dir: Vector3, to: Vector3, reach: number, halfAngle: number): boolean {
  const d = to.clone().sub(from), len = d.length();
  if (len > reach) return false; if (len < 1e-3) return true;
  return d.dot(dir) / (len * Math.max(dir.length(), 1e-6)) >= Math.cos(halfAngle);
}

/**
 * The war fan (rung 3: nothing in the kit is close). SWING is an arc slash through the damage pipeline; holding it
 * (touch) or HEAVY (mouse 2) gives the heavy slash. GUST blows a cone of wind: every creature in it takes an impulse
 * away from the player and a little damage, which throws it off an island edge when it stands near one.
 */
export class WarFan extends Weapon {
  override readonly model = fanModel();
  override readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  override holster = 0; override enabled = true; override adsHeld = false; override aimInfo = null;
  onSwing: ((heavy: boolean) => void) | null = null;
  onGust: ((from: Vector3, dir: Vector3) => void) | null = null;
  private cooldown = 0; private gustCooldown = 0; private wasHeld = false; private held = 0; private flourish = 0;
  private readonly app: App; private readonly targets: () => readonly FanTarget[];
  private readonly spring = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private readonly vm = blocks.viewmodel({ gain: 0.01, clampYaw: 0.1, clampPitch: 0.1, k: 50, c: 12 });
  private readonly contact: ReturnType<typeof blocks.melee>;
  override get charge(): number { return Math.min(1, this.held / 0.6); }

  constructor(app: App, targets: () => readonly FanTarget[] = () => []) {
    super(FAN_ROW); this.app = app; this.targets = targets; this.contact = blocks.melee(app.combat);
    this.blocks.vm = this.vm; this.blocks.melee = this.contact;
    this.model.position.set(0.33, -0.34, -0.62); this.model.rotation.set(-0.35, -0.25, -0.5); this.model.scale.setScalar(0.5);
  }
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, () => this.enabled);
    this.app.input.bind('heavy', () => { this.swing(true); }, ctx.scope, () => this.enabled);
    this.app.input.bind('far.gust', () => { this.gust(); }, ctx.scope, () => this.enabled);
    ctx.scope.onDispose(() => { this.wasHeld = false; this.held = 0; });
  }
  override tryFire(): void { this.swing(false); }
  private view(): { from: Vector3; dir: Vector3 } | null {
    const host = this.app.equipmentHost; if (host === null) return null;
    const from = host.game.camera.position.clone(), dir = new Vector3(); host.game.camera.getWorldDirection(dir);
    return { from, dir };
  }
  swing(heavy: boolean): void {
    if (this.cooldown > 0 || !this.enabled) return;
    this.cooldown = heavy ? SWING.heavyCooldown : SWING.cooldown; this.flourish = 1; this.onSwing?.(heavy);
    const view = this.view(); if (view !== null) this.slash(view.from, view.dir, heavy);
  }
  /** One slash from `from` along `dir`: every target in the arc takes a hit. Returns how many were struck. */
  slash(from: Vector3, dir: Vector3, heavy: boolean): number {
    let struck = 0;
    for (const target of this.targets()) {
      if (target.actor === null || !target.actor.alive || !inCone(from, dir, target.position, SWING.reach + 1, SWING.halfAngle)) continue;
      const result = this.contact.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.far-fan', 'dmg.melee'], target: target.actor,
        amount: heavy ? SWING.heavy : SWING.light, point: target.position.clone(), dir: dir.clone(), from: from.clone(), weaponId: this.row.id,
        moveId: heavy ? 'far.fan.heavy' : 'far.fan.light', surface: 'flesh' });
      if (result !== null) { struck++; this.onHit?.(target.actor.id, false, result.killed); }
    }
    if (struck > 0) this.onFire?.();
    return struck;
  }
  gust(): void {
    if (this.gustCooldown > 0 || !this.enabled) return;
    this.gustCooldown = GUST.cooldown; this.flourish = 1;
    const view = this.view(); if (view === null) return;
    this.onGust?.(view.from, view.dir); this.blow(view.from, view.dir);
  }
  /** The GUST cone: an impulse away from `from` (plus a little lift) and a small hit on each target inside it. */
  blow(from: Vector3, dir: Vector3): number {
    let blown = 0;
    for (const target of this.targets()) {
      if (target.actor === null || !target.actor.alive || !inCone(from, dir, target.position, GUST.reach, GUST.halfAngle)) continue;
      const away = target.position.clone().sub(from); away.y = 0; if (away.lengthSq() < 1e-4) away.set(dir.x, 0, dir.z); away.normalize();
      target.impulse?.(away.multiplyScalar(GUST.push).setY(GUST.lift));
      this.contact.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.far-fan', 'dmg.wind'], target: target.actor, amount: GUST.damage,
        point: target.position.clone(), dir: dir.clone(), from: from.clone(), weaponId: this.row.id, moveId: 'far.fan.gust', surface: 'flesh' });
      blown++;
    }
    return blown;
  }
  override update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt); this.gustCooldown = Math.max(0, this.gustCooldown - dt);
    if (!this.enabled || this.holster > 0.001) { this.wasHeld = false; this.held = 0; }
    else if (this.adsHeld) this.held += dt;
    else if (this.wasHeld) { this.cooldown = 0; this.swing(true); this.held = 0; }
    this.wasHeld = this.enabled && this.holster <= 0.001 && this.adsHeld;
    this.flourish = Math.max(0, this.flourish - dt * 3.5);
    this.vm.step(this.spring, new Vector2(), dt);
    this.model.rotation.y = -0.25 + this.spring.yaw + Math.sin(this.flourish * Math.PI) * 0.9;
    this.model.visible = this.holster < 0.5;
  }
}
