import { Weapon, blocks, type Actor, type Animal, type App, type EquipContext, type Targets, type TargetAnimal, type WeaponState } from '#engine';
import { Vector2, Vector3 } from 'three';
import { WHIP_ROW } from './rows';
import { buildWhipModel, type WhipParts } from './whipModel';
import type { Crackable } from '../world/build';

/** What the whip resolves a ray hit to: the combat actor and, when it is a creature, its body for the stagger. */
export interface WhipTarget { actor: Actor; animal: Animal | null }

/** The crack's numbers (metres, seconds, hit points); `pull` is the yank's speed (m/s) on a creature of `pullMaxHp` or less. */
export const CRACK = { reach: 7, heavyReach: 8, width: 0.9, light: 18, heavy: 16, cooldown: 0.45, heavyCooldown: 0.9,
  unroll: 0.12, second: 0.32, show: 0.42, charge: 0.6, stagger: 0.8, pull: 16, pullMaxHp: 40 } as const;

/**
 * The bullwhip (rung 3, `extends Weapon`): a light crack is one long, narrow lash to the crosshair; the heavy is a
 * double crack whose second lash staggers a creature. Desktop: Attack = Mouse0 / F, Heavy = Mouse2 (inherited from
 * `weapon.melee`). Touch: a tap cracks, a still hold fills the charge ring and its release throws the double crack.
 */
export class Bullwhip extends Weapon {
  override readonly model; override readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  override holster = 0; override enabled = true; override adsHeld = false; override aimInfo = null;
  onSwing: ((heavy: boolean) => void) | null = null;
  readonly parts: WhipParts;
  private readonly app: App; private readonly targets: Targets | null; private readonly resolve: (animal: TargetAnimal) => WhipTarget | null;
  private readonly contact: ReturnType<typeof blocks.melee>;
  private readonly vm = blocks.viewmodel({ gain: 0.012, clampYaw: 0.12, clampPitch: 0.1, k: 46, c: 11 });
  private readonly spring = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private cooldown = 0; private held = 0; private wasHeld = false;
  /** Time since the current crack started, or −1 when idle. */
  private crackT = -1; private crackHeavy = false; private landed = 0; private time = 0;
  private readonly from = new Vector3(); private readonly end = new Vector3();
  /** Levers and braziers the lash reacts to when it hits no creature (C3). */
  private crackables: readonly Crackable[] = [];
  constructor(app: App, targets: Targets | null = null, resolve: (animal: TargetAnimal) => WhipTarget | null = () => null) {
    super(WHIP_ROW); this.app = app; this.targets = targets; this.resolve = resolve;
    this.contact = blocks.melee(app.combat); this.blocks.vm = this.vm; this.blocks.melee = this.contact;
    this.parts = buildWhipModel(); this.model = this.parts.root;
    this.model.position.set(0.09, -0.17, -0.42);
  }
  /** The world things the lash can crack (the windlass crank, the braziers). */
  aimAt(crackables: readonly Crackable[]): void { this.crackables = crackables; }
  override get charge(): number { return Math.min(1, this.held / CRACK.charge); }
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, () => this.enabled);
    this.app.input.bind('heavy', () => { this.swing(true); }, ctx.scope, () => this.enabled);
    ctx.scope.onDispose(() => { this.wasHeld = false; this.held = 0; this.crackT = -1; });
  }
  override tryFire(): void { this.swing(false); }
  /** Starts a crack; the lash lands `CRACK.unroll` s later (and again at `CRACK.second` for the heavy). */
  swing(heavy: boolean): boolean {
    if (this.cooldown > 0 || !this.enabled) return false;
    this.cooldown = heavy ? CRACK.heavyCooldown : CRACK.cooldown; this.crackT = 0; this.crackHeavy = heavy; this.landed = 0;
    this.onSwing?.(heavy); return true;
  }
  /** One lash lands: a narrow lane from the eye along the view, `reach` metres long. */
  private land(second: boolean): void {
    const host = this.app.equipmentHost; if (host === null || this.targets === null) return;
    const camera = host.game.camera, from = camera.position.clone(), dir = new Vector3(); camera.getWorldDirection(dir);
    const reach = this.crackHeavy ? CRACK.heavyReach : CRACK.reach;
    const hit = this.targets.raycast(from, dir, reach), target = hit?.animal === undefined ? null : this.resolve(hit.animal);
    if (hit !== null && target !== null) { this.strike(target, hit.point, dir, from, this.crackHeavy, second); this.onFire?.(); return; }
    this.crackWorld(from, dir, reach, second);
  }
  /** The lash reaches a lever or a brazier bowl inside its lane: the nearest one along the view reacts. */
  crackWorld(from: Vector3, dir: Vector3, reach: number, second: boolean): Crackable | null {
    let best: Crackable | null = null, bestT = Infinity;
    for (const c of this.crackables) {
      const delta = c.at.clone().sub(from), forward = delta.dot(dir);
      if (forward < 0 || forward > reach + c.radius || forward >= bestT) continue;
      if (delta.addScaledVector(dir, -forward).length() > CRACK.width + c.radius) continue;
      best = c; bestT = forward;
    }
    return best?.crack(this.crackHeavy, second) === true ? best : null;
  }
  /** Damage through the pipeline; the heavy's first lash yanks a small creature in, its second staggers a big one (ENGINE §18, §19). */
  strike(target: WhipTarget, point: Vector3, dir: Vector3, from: Vector3, heavy: boolean, second = false): boolean {
    const reach = heavy ? CRACK.heavyReach : CRACK.reach, delta = point.clone().sub(from), forward = delta.dot(dir);
    if (forward < 0 || forward > reach || delta.addScaledVector(dir, -forward).length() > CRACK.width) return false;
    const { actor, animal } = target;
    const result = this.contact.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.sunscar-whip', 'dmg.melee'], target: actor,
      amount: heavy ? CRACK.heavy : CRACK.light, point, dir, from, weaponId: this.row.id,
      moveId: heavy ? (second ? 'sunscar.whip.double.2' : 'sunscar.whip.double.1') : 'sunscar.whip.crack', surface: 'flesh' });
    if (result === null) return false;
    this.onHit?.(actor.id, false, result.killed);
    // The pull: the double crack's first lash wraps a small creature and yanks it to the player's feet (the second
    // lash then lands on it close); a big one shrugs the wrap off and the second lash staggers it.
    if (heavy && !result.killed && animal !== null) {
      const small = animal.maxHp <= CRACK.pullMaxHp;
      if (small && !second) animal.impulse(new Vector3(-dir.x, 0, -dir.z).normalize().multiplyScalar(CRACK.pull));
      else if (!small && second) animal.stagger(dir, CRACK.stagger);
    }
    return true;
  }
  override update(dt: number): void {
    this.time += dt; this.cooldown = Math.max(0, this.cooldown - dt);
    const drawn = this.enabled && this.holster <= 0.001;
    if (!drawn) { this.wasHeld = false; this.held = 0; }
    else if (this.adsHeld) this.held += dt;
    else if (this.wasHeld) { this.cooldown = 0; this.swing(true); this.held = 0; }
    this.wasHeld = drawn && this.adsHeld;
    this.model.visible = this.holster < 0.5;
    this.vm.step(this.spring, new Vector2(), dt); this.model.rotation.y = this.spring.yaw;
    this.animate(dt);
  }
  private animate(dt: number): void {
    const { grip, coil, lash, tip } = this.parts;
    if (this.crackT < 0) { lash.mesh.visible = false; coil.visible = true; grip.position.set(0, 0, 0); return; }
    this.crackT += dt;
    const t = this.crackT, double = this.crackHeavy;
    if (this.landed === 0 && t >= CRACK.unroll) { this.landed = 1; this.land(false); }
    if (double && this.landed === 1 && t >= CRACK.second) { this.landed = 2; this.land(true); }
    const length = double ? CRACK.show + CRACK.second - CRACK.unroll : CRACK.show;
    if (t > length) { this.crackT = -1; return; }
    // The flick: the hand snaps forward on each lash, the lash unrolls to the crosshair, then falls slack.
    const local = double && t > CRACK.second - 0.08 ? t - (CRACK.second - CRACK.unroll) : t;
    const ext = Math.min(1, local / CRACK.unroll), slack = Math.max(0, (local - CRACK.unroll) / (CRACK.show - CRACK.unroll));
    grip.position.set(0, ext < 1 ? 0.03 * ext : 0.03 * (1 - slack), ext < 1 ? -0.04 * ext : -0.04 * (1 - slack));
    coil.visible = false; lash.mesh.visible = true;
    this.from.copy(tip).add(grip.position);
    const reach = double ? CRACK.heavyReach : CRACK.reach;
    // The far end sits on the crosshair: the model's origin is offset from the eye, so aim back at the view axis.
    this.end.set(-this.model.position.x, -this.model.position.y - slack * 1.5, -reach + 0.42 + slack * 2);
    lash.shape(this.from, this.end, Math.min(1, ext * (1 - slack * 0.35)), 0.25 + slack * 0.4, this.time);
  }
}
