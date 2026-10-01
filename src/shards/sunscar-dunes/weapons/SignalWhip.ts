import { Weapon, blocks, type Actor, type Targets, type TargetAnimal, type WeaponState, type App, type EquipContext } from '#engine';
import { Vector2, Vector3 } from 'three';
import { WHIP_ROW } from './rows';
import { WhipModel } from './whipModel';

/** The crack's numbers: a long, narrow line that lands when the thong is out, not on the press. */
export const CRACK = { reach: 6.5, lane: 0.55, light: 16, heavy: 20, stagger: 0.6, contactAt: 0.13, heavySecond: 0.45, cooldown: 0.42, heavyCooldown: 0.95, length: 0.34 } as const;

/**
 * Rung 3 (custom): no kit family throws a flexible line. Built from `blocks.viewmodel` (look lag) and `blocks.melee`
 * (contact through the damage pipeline). Light: one crack. Heavy: a double crack, each one staggers.
 */
export class SignalWhip extends Weapon {
  override readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  override holster = 0; override enabled = true; override adsHeld = false; override aimInfo = null;
  readonly view = new WhipModel();
  override readonly model = this.view.root;
  onSwing: ((heavy: boolean) => void) | null = null;
  private cooldown = 0; private clock = 0; private crackT = -1; private heavy = false; private landed = 0;
  private readonly app: App; private readonly targets: Targets | null; private readonly actorFor: (animal: TargetAnimal) => Actor | null;
  private readonly spring = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private readonly vm = blocks.viewmodel({ gain: 0.012, clampYaw: 0.12, clampPitch: 0.1, k: 48, c: 11 });
  private readonly contact: ReturnType<typeof blocks.melee>;

  constructor(app: App, targets: Targets | null = null, actorFor: (animal: TargetAnimal) => Actor | null = () => null) {
    super(WHIP_ROW); this.app = app; this.targets = targets; this.actorFor = actorFor; this.contact = blocks.melee(app.combat);
    this.blocks.vm = this.vm; this.blocks.melee = this.contact;
    this.model.position.set(0.19, -0.17, -0.42); this.model.rotation.set(0.35, 0, -0.5);
  }
  override install(ctx: EquipContext): void { super.install(ctx); this.app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, () => this.enabled); }
  override tryFire(): void {
    if (this.cooldown > 0 || !this.enabled) return;
    this.heavy = this.altHeld; this.cooldown = this.heavy ? CRACK.heavyCooldown : CRACK.cooldown; this.crackT = 0; this.landed = 0;
    this.onSwing?.(this.heavy); this.onFire?.();
  }
  /** One crack's contact along the camera's aim: the nearest creature on the line within reach. */
  private crack(): void {
    const host = this.app.equipmentHost; if (host === null || this.targets === null) return;
    const from = host.game.camera.position.clone(), dir = new Vector3(); host.game.camera.getWorldDirection(dir);
    const hit = this.targets.raycast(from, dir, CRACK.reach + 1); if (hit?.animal === undefined) return;
    const actor = this.actorFor(hit.animal); if (actor !== null) this.strike(actor, hit.point, dir, from, this.heavy);
  }
  /** Contact on a narrow lane: past the reach or off the line misses. Public for the contract test. */
  strike(actor: Actor, point: Vector3, dir: Vector3, from: Vector3, heavy: boolean): boolean {
    const delta = point.clone().sub(from), forward = delta.dot(dir);
    if (forward < 0 || forward > CRACK.reach || delta.addScaledVector(dir, -forward).length() > CRACK.lane) return false;
    const result = this.contact.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.signal-bullwhip', 'dmg.melee'], target: actor, amount: heavy ? CRACK.heavy : CRACK.light,
      point, dir, from, weaponId: this.row.id, moveId: heavy ? 'sunscar.whip.heavy' : 'sunscar.whip.light', surface: 'flesh', ...(heavy ? { stagger: CRACK.stagger } : {}) });
    if (result !== null) this.onHit?.(actor.id, false, result.killed);
    return result !== null;
  }
  override update(dt: number): void {
    this.clock += dt; this.cooldown = Math.max(0, this.cooldown - dt);
    this.vm.step(this.spring, new Vector2(), dt); this.model.rotation.y = this.spring.yaw;
    let throwK = 0;
    if (this.crackT >= 0) {
      this.crackT += dt;
      const second = this.heavy && this.crackT > CRACK.heavySecond, local = second ? this.crackT - CRACK.heavySecond : this.crackT;
      if (this.landed === 0 && this.crackT >= CRACK.contactAt) { this.landed = 1; this.crack(); }
      if (this.heavy && this.landed === 1 && this.crackT >= CRACK.heavySecond + CRACK.contactAt) { this.landed = 2; this.crack(); }
      throwK = Math.sin(Math.PI * Math.min(1, local / CRACK.length));
      if (this.crackT > (this.heavy ? CRACK.heavySecond : 0) + CRACK.length) this.crackT = -1;
    }
    this.view.pose(Math.max(0, throwK), this.clock);
  }
}
