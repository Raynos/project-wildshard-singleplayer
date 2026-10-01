import { Weapon, blocks, type Actor, type Targets, type TargetAnimal, type WeaponState, type App, type EquipContext } from '#engine';
import { Vector2, Vector3 } from 'three';
import { WHIP_ROW } from './rows';
import { WhipModel } from './whipModel';

/** Light crack and the held double crack, as data. */
export const CRACK = {
  light: { reach: 6.5, lane: 0.9, damage: 16, stagger: 0.25, knockback: 0, cooldown: 0.45, move: 'sunscar.whip.crack' },
  heavy: { reach: 7.5, lane: 1.1, damage: 34, stagger: 0.6, knockback: 6, cooldown: 0.9, move: 'sunscar.whip.double' },
} as const;
const HOLD_FULL = 0.6;

/** A custom weapon (the ladder's third rung): a long, narrow crack through the damage pipeline, from `blocks.melee`. */
export class Bullwhip extends Weapon {
  readonly view = new WhipModel();
  override readonly model = this.view.root;
  override readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  override holster = 0; override enabled = true; override adsHeld = false; override aimInfo = null;
  onSwing: ((heavy: boolean) => void) | null = null;
  private cooldown = 0; private wasHeld = false; private held = 0;
  /** Seconds since the last crack started, and whether it was a double. */
  private crackT = Infinity; private double = false;
  private readonly app: App; private readonly targets: Targets | null; private readonly actorFor: (animal: TargetAnimal) => Actor | null;
  private readonly spring = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private readonly vm = blocks.viewmodel({ gain: 0.012, clampYaw: 0.12, clampPitch: 0.1, k: 45, c: 11 });
  private readonly contact: ReturnType<typeof blocks.melee>;
  override get charge(): number { return Math.min(1, this.held / HOLD_FULL); }

  constructor(app: App, targets: Targets | null = null, actorFor: (animal: TargetAnimal) => Actor | null = () => null) {
    super(WHIP_ROW); this.app = app; this.targets = targets; this.actorFor = actorFor; this.contact = blocks.melee(app.combat);
    this.blocks.vm = this.vm; this.blocks.melee = this.contact;
  }
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, () => this.enabled);
    this.app.input.bind('heavy', () => { this.crack(true); }, ctx.scope, () => this.enabled);
    ctx.scope.onDispose(() => { this.wasHeld = false; this.held = 0; });
  }
  override tryFire(): void { this.crack(false); }
  /** Lay the lash out; the first target on the aim line inside the reach takes the crack. */
  crack(heavy: boolean): void {
    if (this.cooldown > 0 || !this.enabled) return;
    const move = heavy ? CRACK.heavy : CRACK.light; this.cooldown = move.cooldown; this.crackT = 0; this.double = heavy;
    this.onSwing?.(heavy);
    const host = this.app.equipmentHost; if (host === null || this.targets === null) return;
    const from = host.game.camera.position.clone(), dir = new Vector3(); host.game.camera.getWorldDirection(dir);
    const hit = this.targets.raycast(from, dir, move.reach); if (hit === null) return;
    const actor = this.actorFor(hit.animal); if (actor === null) return;
    if (this.strike(actor, hit.point, dir, from, heavy)) hit.animal.stagger?.(dir, move.stagger);
  }
  /** One crack's contact: inside the reach and the narrow lane, through the pipeline. Returns whether it landed. */
  strike(actor: Actor, point: Vector3, dir: Vector3, from: Vector3, heavy: boolean): boolean {
    const move = heavy ? CRACK.heavy : CRACK.light;
    const delta = point.clone().sub(from), forward = delta.dot(dir);
    if (forward < 0 || forward > move.reach || delta.addScaledVector(dir, -forward).length() > move.lane) return false;
    const result = this.contact.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.sunscar-whip', 'dmg.melee'], target: actor, amount: move.damage,
      point, dir, from, weaponId: this.row.id, moveId: move.move, surface: 'flesh', stagger: move.stagger, knockback: move.knockback });
    if (result !== null) this.onHit?.(actor.id, false, result.killed);
    return result !== null;
  }
  override update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.enabled || this.holster > 0.001) { this.wasHeld = false; this.held = 0; }
    else if (this.adsHeld) this.held += dt;
    else if (this.wasHeld) { this.cooldown = 0; this.crack(true); this.held = 0; }
    this.wasHeld = this.enabled && this.holster <= 0.001 && this.adsHeld;
    this.vm.step(this.spring, new Vector2(), dt); this.model.rotation.y = -0.25 + this.spring.yaw;
    this.crackT += dt; this.view.pose(...this.lashPose());
  }
  /** Reach and ripple of the lash `crackT` seconds into a crack (a double replays the snap at 0.32 s). */
  private lashPose(): [number, number] {
    const t = this.double && this.crackT > 0.32 ? this.crackT - 0.32 : this.crackT;
    if (t > 0.45) return [this.held > 0 ? Math.min(0.15, this.held * 0.25) : 0, 0];
    const reach = t < 0.1 ? t / 0.1 : t < 0.16 ? 1 : 1 - (t - 0.16) / 0.29;
    return [reach, Math.min(1, t / 0.16)];
  }
}
