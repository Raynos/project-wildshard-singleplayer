import { Weapon, blocks, type Actor, type Targets, type TargetAnimal, type WeaponState, type App, type EquipContext } from '#engine';
import { Matrix4, Vector2, Vector3 } from 'three';
import { WHIP_ROW } from './rows';
import { buildWhip } from './whipModel';

const AIM = new Vector3(), INV = new Matrix4(), FORWARD = new Vector3(0, 0, -1);
/** Tuning: the light crack reaches far down a narrow line; the double crack lands twice. */
export const WHIP = { reach: 7, heavyReach: 8, width: 0.75, light: 18, heavy: 16, cooldown: 0.45, heavyCooldown: 0.9, second: 0.14, crack: 0.18, chargeTime: 0.5 };

/** A custom weapon (SHARDS §5 rung 3): `blocks.viewmodel` for the sway, `blocks.melee` for contact through the pipeline. */
export class Bullwhip extends Weapon {
  override readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  override holster = 0; override enabled = true; override adsHeld = false; override aimInfo = null;
  override readonly model; private readonly parts = buildWhip();
  onSwing: ((heavy: boolean) => void) | null = null;
  /** The last crack, for tests and captures: how far the lash flew and whether it landed. */
  lastCrack: { heavy: boolean; reach: number; hit: boolean } | null = null;
  private cooldown = 0; private crackT = 0; private crackReach = 0; private secondIn = -1;
  private held = 0; private wasHeld = false;
  private readonly app: App; private readonly targets: Targets | null; private readonly actorFor: (animal: TargetAnimal) => Actor | null;
  private readonly spring = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private readonly vm = blocks.viewmodel({ gain: 0.012, clampYaw: 0.12, clampPitch: 0.1, k: 45, c: 11 });
  private readonly contact: ReturnType<typeof blocks.melee>;
  override get charge(): number { return Math.min(1, this.held / WHIP.chargeTime); }

  constructor(app: App, targets: Targets | null = null, actorFor: (animal: TargetAnimal) => Actor | null = () => null) {
    super(WHIP_ROW); this.app = app; this.targets = targets; this.actorFor = actorFor; this.model = this.parts.model;
    this.contact = blocks.melee(app.combat); this.blocks.vm = this.vm; this.blocks.melee = this.contact;
  }

  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, () => this.enabled);
    this.app.input.bind('heavy', () => { this.crack(true); }, ctx.scope, () => this.enabled);
    ctx.scope.onDispose(() => { this.wasHeld = false; this.held = 0; this.secondIn = -1; });
  }

  override tryFire(): void { this.crack(false); }

  private crack(heavy: boolean): void {
    if (this.cooldown > 0 || !this.enabled) return;
    this.cooldown = heavy ? WHIP.heavyCooldown : WHIP.cooldown;
    this.crackT = WHIP.crack; this.crackReach = heavy ? WHIP.heavyReach : WHIP.reach; this.secondIn = heavy ? WHIP.second : -1;
    this.onSwing?.(heavy);
    this.lastCrack = { heavy, reach: this.crackReach, hit: this.lash(heavy) };
  }

  /** One lash down the crosshair: the nearest creature on the line within reach takes the hit. */
  private lash(heavy: boolean): boolean {
    const host = this.app.equipmentHost; if (host === null || this.targets === null) return false;
    const from = host.game.camera.position.clone(), dir = new Vector3(); host.game.camera.getWorldDirection(dir);
    const reach = heavy ? WHIP.heavyReach : WHIP.reach;
    const hit = this.targets.raycast(from, dir, reach); if (hit?.animal === undefined) return false;
    const actor = this.actorFor(hit.animal); if (actor === null) return false;
    return this.strike(actor, hit.point, dir, from, heavy);
  }

  /** Contact for a crack that reached `point`: inside the narrow line and the reach, through the damage pipeline. */
  strike(actor: Actor, point: Vector3, dir: Vector3, from: Vector3, heavy: boolean): boolean {
    const delta = point.clone().sub(from), forward = delta.dot(dir), reach = heavy ? WHIP.heavyReach : WHIP.reach;
    if (forward < 0 || forward > reach || delta.addScaledVector(dir, -forward).length() > WHIP.width) return false;
    const result = this.contact.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.sunscar-whip', 'dmg.melee'], target: actor,
      amount: heavy ? WHIP.heavy : WHIP.light, point, dir, from, weaponId: this.row.id,
      moveId: heavy ? 'sunscar.whip.double' : 'sunscar.whip.crack', surface: 'flesh' });
    if (result === null) return false;
    this.onHit?.(actor.id, false, result.killed); this.onFire?.();
    return true;
  }

  override update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    // Touch: a still ATTACK hold raises adsHeld and fills the charge ring; letting go throws the double crack.
    if (!this.enabled || this.holster > 0.001) { this.wasHeld = false; this.held = 0; this.secondIn = -1; }
    else if (this.adsHeld) this.held += dt;
    else if (this.wasHeld) { if (this.held >= WHIP.chargeTime) { this.cooldown = 0; this.crack(true); } this.held = 0; }
    this.wasHeld = this.enabled && this.holster <= 0.001 && this.adsHeld;
    if (this.secondIn >= 0) { this.secondIn -= dt; if (this.secondIn < 0) { this.crackT = WHIP.crack; this.lash(true); } }
    // The crack: the coil snaps out to the reach along the crosshair, then falls back into the coil.
    this.crackT = Math.max(0, this.crackT - dt);
    const out = this.crackT > 0, p = out ? 1 - this.crackT / WHIP.crack : 0;
    this.parts.coil.visible = !out; this.parts.lash.visible = out;
    this.vm.step(this.spring, new Vector2(), dt);
    this.model.rotation.y = -0.25 + this.spring.yaw; this.model.rotation.x = 0.05 + (out ? -0.25 * (1 - p) : 0) + this.spring.pitch;
    if (out) {
      // Aim the lash (model space) at the crosshair point `reach` metres ahead in camera space.
      const lash = this.parts.lash, extend = Math.sin(Math.min(1, p * 1.6) * Math.PI * 0.5);
      this.model.updateMatrix(); AIM.set(0, 0, -this.crackReach).applyMatrix4(INV.copy(this.model.matrix).invert()).sub(lash.position);
      lash.scale.set(1, 1, Math.max(0.05, extend * AIM.length())); lash.quaternion.setFromUnitVectors(FORWARD, AIM.normalize());
    }
  }
}
