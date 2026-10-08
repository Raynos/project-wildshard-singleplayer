import type { App } from '@wildshard/engine/app/app';
import { blocks } from '@wildshard/engine/blocks';
import type { EquipContext } from '@wildshard/engine/combat/Equipment';
import type { Actor, CombatTarget } from '@wildshard/engine/combat/pipeline';
import type { Targets } from '@wildshard/engine/combat/types';
import { Weapon, type WeaponState } from '@wildshard/engine/combat/Weapon';
import { CatmullRomCurve3, Mesh, TubeGeometry, Vector2, Vector3 } from 'three';
import { WHIP_ROW } from './rows';
import { WHIP_ITEM } from '../data/items';
import { braidedMaterial, buildWhipModel, type WhipParts } from './whipModel';
import type { Crackable } from '../world/build';

/** What the lash lands on: the combat actor, and the body's yank and stagger when it has them. */
export interface WhipTarget { actor: Actor; impulse?: (velocity: Vector3) => void; stagger?: (dir: Vector3, strength: number) => void }
/** A combat target's chest: its port position is at its feet. */
const CHEST = 0.9, BODY = 0.7;

/** The crack's numbers (metres, seconds, hit points); `pull` is the yank's speed (m/s) on a creature of `pullMaxHp` or less. */
/** The wrap round a caught lever (metres, seconds): coil radius, height, turns, cord, how long it holds. */
const WRAP = { r: 0.06, h: 0.24, turns: 4, cord: 0.018, hold: 0.9 } as const;

/** Reach, width, damage, cooldowns and charge are the declared item row's (data/items.ts, SF50-p); the lash's timing is the runtime's own. */
export const CRACK = { reach: WHIP_ITEM.light.range, heavyReach: WHIP_ITEM.heavy.range, width: WHIP_ITEM.light.width, light: WHIP_ITEM.light.damage, heavy: WHIP_ITEM.heavy.damage,
  cooldown: WHIP_ITEM.light.cooldown, heavyCooldown: WHIP_ITEM.heavy.cooldown, charge: WHIP_ITEM.charge,
  unroll: 0.12, second: 0.32, show: 0.42, stagger: 0.8, pull: 16, pullMaxHp: 40 } as const;

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
  private readonly app: App; private readonly targets: Targets | null;
  private readonly contact: ReturnType<typeof blocks.melee>;
  private readonly vm = blocks.viewmodel({ gain: 0.012, clampYaw: 0.12, clampPitch: 0.1, k: 46, c: 11 });
  private readonly spring = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private cooldown = 0; private held = 0; private wasHeld = false;
  /** Time since the current crack started, or −1 when idle. */
  private crackT = -1; private crackHeavy = false; private landed = 0; private time = 0;
  private readonly from = new Vector3(); private readonly end = new Vector3();
  /** Levers and braziers the lash reacts to when it hits no creature (C3). */
  private crackables: readonly Crackable[] = [];
  /**
   * The pull's wrap (after the check pass: the board showed no lash round the crank): the world point the lash caught,
   * how long it holds there, and a braided coil wound round it in the world while it holds.
   */
  private wrapAt: Vector3 | null = null; private wrapT = 0; private wrapCoil: Mesh | null = null;
  constructor(app: App, targets: Targets | null = null) {
    super(WHIP_ROW); this.app = app; this.targets = targets;
    this.contact = blocks.melee(app.combat); this.blocks.vm = this.vm; this.blocks.melee = this.contact;
    this.parts = buildWhipModel(); this.model = this.parts.root;
    // mockup D: the fist whole at the right, above the DODGE / JUMP discs, the coil beside it on the left, the centre
    // clear (loop 3 tune G: half a metre out, so the generated glove reads a hand's size and nothing hides it)
    this.model.position.set(this.parts.glove === null ? 0.08 : 0.1, this.parts.glove === null ? -0.17 : -0.095, this.parts.glove === null ? -0.38 : -0.5); // round 1: lower
  }
  /** The world things the lash can crack (the windlass crank, the braziers). */
  aimAt(crackables: readonly Crackable[]): void { this.crackables = crackables; }
  override get charge(): number { return Math.min(1, this.held / CRACK.charge); }
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, () => this.enabled);
    this.app.input.bind('heavy', () => { this.swing(true); }, ctx.scope, () => this.enabled);
    ctx.scope.onDispose(() => {
      this.wasHeld = false; this.held = 0; this.crackT = -1;
      if (this.wrapCoil) { this.wrapCoil.removeFromParent(); this.wrapCoil.geometry.dispose(); this.wrapCoil = null; }
    });
  }
  override tryFire(): void { this.swing(false); }
  /** Starts a crack; the lash lands `CRACK.unroll` s later (and again at `CRACK.second` for the heavy). */
  swing(heavy: boolean): boolean {
    if (this.cooldown > 0 || !this.enabled) return false;
    this.cooldown = heavy ? CRACK.heavyCooldown : CRACK.cooldown; this.crackT = 0; this.crackHeavy = heavy; this.landed = 0;
    this.onSwing?.(heavy); return true;
  }
  /**
   * One lash lands: a narrow lane from the eye along the view, `reach` metres long. Selection goes through the shared
   * combat targets (`app.combat.targets()`, ENGINE §19), so the Practice Arena's dummies take the crack like creatures:
   * the shared raycast first (it knows the bodies' shapes), then the nearest target whose chest is inside the lane.
   */
  private land(second: boolean): void {
    const host = this.app.equipmentHost; if (host === null) return;
    const from = new Vector3(), dir = new Vector3();
    this.setAimSource(() => host.player.sampleAimCommand()); this.aimRay(from, dir);
    const reach = this.crackHeavy ? CRACK.heavyReach : CRACK.reach;
    const hit = this.targets?.raycast(from, dir, reach) ?? null, port = hit === null ? null : this.app.combat.target(hit.animal);
    if (hit !== null && port?.hittable === true) { this.strike(whipTarget(port), hit.point, dir, from, this.crackHeavy, second); this.onFire?.(); return; }
    const lane = this.inLane(from, dir, reach);
    if (lane !== null) { this.strike(whipTarget(lane.port), lane.point, dir, from, this.crackHeavy, second); this.onFire?.(); return; }
    const caught = this.crackWorld(from, dir, reach, second);
    if (caught !== null && this.crackHeavy) this.wrap(caught.at);
  }
  /** Winds the lash round a caught lever: a short braided helix at the point, shown while the wrap holds. */
  private wrap(at: Vector3): void {
    const scene = this.app.equipmentHost?.game.scene; if (!scene) return;
    if (this.wrapCoil === null) {
      const pts: Vector3[] = [];
      for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2 * WRAP.turns; pts.push(new Vector3(Math.cos(a) * WRAP.r, (i / 40 - 0.5) * WRAP.h, Math.sin(a) * WRAP.r)); }
      this.wrapCoil = new Mesh(new TubeGeometry(new CatmullRomCurve3(pts), 80, WRAP.cord, 5, false), braidedMaterial());
      this.wrapCoil.frustumCulled = false; scene.add(this.wrapCoil);
    }
    this.wrapCoil.position.copy(at); this.wrapCoil.visible = true; // wound round the crank's upright
    this.wrapAt = at.clone(); this.wrapT = WRAP.hold;
  }
  /** The nearest hittable combat target whose chest sits inside the lash's lane. */
  private inLane(from: Vector3, dir: Vector3, reach: number): { port: CombatTarget; point: Vector3 } | null {
    let best: { port: CombatTarget; point: Vector3 } | null = null, bestT = Infinity;
    for (const port of this.app.combat.targets()) {
      if (!port.hittable) continue;
      const chest = port.position.clone(); chest.y += CHEST;
      const delta = chest.clone().sub(from), forward = delta.dot(dir);
      if (forward < 0 || forward > reach + BODY || forward >= bestT) continue;
      if (delta.addScaledVector(dir, -forward).length() > CRACK.width + BODY) continue;
      best = { port, point: from.clone().addScaledVector(dir, Math.min(forward, reach)) }; bestT = forward;
    }
    return best;
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
    const { actor } = target;
    const result = this.contact.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.sunscar-whip', 'dmg.melee'], target: actor,
      amount: heavy ? CRACK.heavy : CRACK.light, point, dir, from, weaponId: this.row.id,
      moveId: heavy ? (second ? 'sunscar.whip.double.2' : 'sunscar.whip.double.1') : 'sunscar.whip.crack', surface: 'flesh' });
    if (result === null) return false;
    this.onHit?.(actor.id, false, result.killed);
    // The pull: the double crack's first lash wraps a small creature and yanks it to the player's feet (the second
    // lash then lands on it close); a big one shrugs the wrap off and the second lash staggers it.
    if (heavy && !result.killed) {
      const small = actor.attributes.maxHealth <= CRACK.pullMaxHp;
      if (small && !second) target.impulse?.(new Vector3(-dir.x, 0, -dir.z).normalize().multiplyScalar(CRACK.pull));
      else if (!small && second) target.stagger?.(dir, CRACK.stagger);
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
    if (this.wrapT > 0) { this.wrapT -= dt; if (this.wrapT <= 0 && this.wrapCoil) this.wrapCoil.visible = false; }
    if (this.crackT < 0) { lash.mesh.visible = false; coil.visible = this.parts.hd === null; grip.position.set(0, 0, 0); return; }
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
    // caught on a lever: the far end stays on it, taut (the model's frame: the world point through the viewmodel)
    if (this.wrapT > 0 && this.wrapAt !== null) { this.model.updateWorldMatrix(true, false); this.end.copy(this.wrapAt); this.model.worldToLocal(this.end); }
    const taut = this.wrapT > 0;
    lash.shape(this.from, this.end, taut ? 1 : Math.min(1, ext * (1 - slack * 0.35)), taut ? 0.05 : 0.25 + slack * 0.4, this.time);
  }
}

/** A combat port as the lash's target: its actor, its yank (when the body has one) and its stagger. */
function whipTarget(port: CombatTarget): WhipTarget {
  const body = port.target;
  return { actor: port.actor, ...(port.impulse === undefined ? {} : { impulse: port.impulse }),
    stagger: (dir: Vector3, strength: number): void => { body.stagger?.(dir, strength); } };
}
