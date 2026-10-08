import type { App } from '@wildshard/engine/app/app';
import { blocks } from '@wildshard/engine/blocks';
import type { EquipContext } from '@wildshard/engine/combat/Equipment';
import type { Actor } from '@wildshard/engine/combat/pipeline';
import { Weapon, type WeaponState } from '@wildshard/engine/combat/Weapon';
import { Vector2, Vector3, type Texture } from 'three';
import { FAN_SWING, FAN_GUST } from '../data/items';
import { FAN_ROW } from './rows';
import { fanParts } from './fanModel';

/** Anything the fan can strike: a world position and its combat actor. */
export interface FanTarget { readonly position: Vector3; readonly actor: Actor | null; impulse?: (velocity: Vector3) => void }
export const SWING = { ...FAN_SWING };
/** The idle hold (mockup B / C): the fan open at a three-quarter angle, lower right, the hand under it; never over the discs. */
/** Loop 5 (council R1C-14): raised so the grip and the hand sit above the GUST / DODGE / JUMP cluster. */
/** E399 (the council mockups A, C and proposal B): lower, smaller (the seats: 'twice the mockup's size') and turned open, face-on to you, its tassel hanging free. */
// council round 3 (all seats: 'the same face-on half-disc, the pivot and fist behind GUST'): leaned over toward the
// upper left on its pivot, the gloved hand, wrist and tassel in plain view at the lower right, as mockup C sweeps it
// (round 7: a larger, more central hold, for mockup C, covered A's bridge and D's dais, where mockups A, B, D and proposal B
// hold it small at the lower right: the hold stays)
// Top-10 row 3 (E407): ONE hold for every view, measured against the mockups' fans (390 x 844 portrait frame; A's pivot at
// about (364, 605), its leaf's left tip (244, 547), top 480; B's left 275, top 452; proposal B's left 200, top 475): the
// pivot low at the right (~345, 610), the leaf opening up and to the left, its right guard running off the frame's edge,
// tipped back a little so the silk still faces you. It was leaned over with its pivot behind GUST (left 171, top 456).
export const HOLD = { x: 0.155, y: -0.194, z: -0.6, pitch: 0.35, yaw: -0.5, roll: 0.55, scale: 0.46 } as const;
/** The painted silk's tint (E399 seats: 'plain and bright'): mockup C's silk is a muted, deeper teal. */
// E399 seats: the mockups' silk is a lighter sea-green with pale cloud swirls
export const SILK_TINT = 0xdfece6;
export const GUST = { ...FAN_GUST };

/** A viewmodel offset from HOLD (metres, radians). */
interface Pose { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly pitch: number; readonly roll: number }
const REST: Pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
type Motion = 'swing' | 'heavy' | 'gust';
/**
 * The three moves (loop 3, P3), as key poses over each move's duration:
 * SWING a quick flat slash, right to left, from a short wind-up to the right;
 * HEAVY a raised wind-up, then a diagonal chop down and across;
 * GUST the fan drawn back and turned face-on, then thrust out to the centre like a push of wind.
 */
export const MOTIONS: Readonly<Record<Motion, { readonly seconds: number; readonly keys: readonly (readonly [number, Pose])[] }>> = {
  swing: { seconds: 0.34, keys: [[0, REST], [0.18, { x: 0.05, y: 0.01, z: 0.02, yaw: 0.45, pitch: 0.05, roll: -0.15 }],
    [0.5, { x: -0.16, y: 0.02, z: -0.05, yaw: -1.05, pitch: -0.1, roll: 0.25 }], [1, REST]] },
  heavy: { seconds: 0.6, keys: [[0, REST], [0.3, { x: 0.06, y: 0.12, z: 0.04, yaw: 0.35, pitch: 0.6, roll: -0.45 }],
    [0.55, { x: -0.14, y: -0.1, z: -0.08, yaw: -0.9, pitch: -0.7, roll: 0.5 }], [0.7, { x: -0.13, y: -0.09, z: -0.07, yaw: -0.85, pitch: -0.65, roll: 0.45 }], [1, REST]] },
  gust: { seconds: 0.55, keys: [[0, REST], [0.25, { x: 0.02, y: 0.02, z: 0.07, yaw: 0.55, pitch: 0.1, roll: 0.2 }],
    [0.45, { x: -0.11, y: 0.05, z: -0.14, yaw: 0.62, pitch: -0.05, roll: 0.32 }], [0.62, { x: -0.1, y: 0.05, z: -0.12, yaw: 0.6, pitch: -0.04, roll: 0.3 }], [1, REST]] },
};
/** The pose `k` (0…1) of the way through `motion`, eased between its keys. */
export function motionPose(motion: Motion, k: number): Pose {
  const keys = MOTIONS[motion].keys;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i]; if (a === undefined || b === undefined || k > b[0]) continue;
    const u = Math.max(0, Math.min(1, (k - a[0]) / Math.max(1e-6, b[0] - a[0]))), e = u * u * (3 - 2 * u), A = a[1], B = b[1];
    return { x: A.x + (B.x - A.x) * e, y: A.y + (B.y - A.y) * e, z: A.z + (B.z - A.z) * e, yaw: A.yaw + (B.yaw - A.yaw) * e, pitch: A.pitch + (B.pitch - A.pitch) * e, roll: A.roll + (B.roll - A.roll) * e };
  }
  return REST;
}

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
  private readonly parts = fanParts();
  override readonly model = this.parts.group;
  private time = 0;
  override readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  override holster = 0; override enabled = true; override adsHeld = false; override aimInfo = null;
  onSwing: ((heavy: boolean) => void) | null = null;
  onGust: ((from: Vector3, dir: Vector3) => void) | null = null;
  /** True while the fan is put away (riding the hoverboard): it hides and neither swings nor gusts. */
  stowed: () => boolean = () => false;
  private cooldown = 0; private gustCooldown = 0; private wasHeld = false; private held = 0;
  /** The move playing and how far through it (0…1; 1 = done). */
  motion: Motion = 'swing'; motionK = 1;
  private readonly app: App; private readonly targets: () => readonly FanTarget[];
  private readonly spring = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private readonly vm = blocks.viewmodel({ gain: 0.01, clampYaw: 0.1, clampPitch: 0.1, k: 50, c: 12 });
  private readonly contact: ReturnType<typeof blocks.melee>;
  override get charge(): number { return Math.min(1, this.held / 0.6); }
  /** Paint the silk with the leaf texture (loaded and owned by the plugin's scope). */
  setLeaf(leaf: Texture): void { this.parts.silk.map = leaf; this.parts.silk.color.set(SILK_TINT); this.parts.silk.needsUpdate = true; }

  constructor(app: App, targets: () => readonly FanTarget[] = () => []) {
    super(FAN_ROW); this.app = app; this.targets = targets; this.contact = blocks.melee(app.combat);
    this.blocks.vm = this.vm; this.blocks.melee = this.contact;
    this.model.position.set(HOLD.x, HOLD.y, HOLD.z); this.model.rotation.set(HOLD.pitch, HOLD.yaw, HOLD.roll); this.model.scale.setScalar(HOLD.scale);
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
    const from = new Vector3(), dir = new Vector3();
    this.setAimSource(() => host.player.sampleAimCommand()); this.aimRay(from, dir);
    return { from, dir };
  }
  swing(heavy: boolean): void {
    if (this.cooldown > 0 || !this.enabled || this.stowed()) return;
    this.cooldown = heavy ? SWING.heavyCooldown : SWING.cooldown; this.play(heavy ? 'heavy' : 'swing'); this.onSwing?.(heavy);
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
    if (this.gustCooldown > 0 || !this.enabled || this.stowed()) return;
    this.gustCooldown = GUST.cooldown; this.play('gust');
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
  private play(motion: Motion): void { this.motion = motion; this.motionK = 0; }
  override update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt); this.gustCooldown = Math.max(0, this.gustCooldown - dt);
    if (!this.enabled || this.holster > 0.001) { this.wasHeld = false; this.held = 0; }
    else if (this.adsHeld) this.held += dt;
    else if (this.wasHeld) { this.cooldown = 0; this.swing(true); this.held = 0; }
    this.wasHeld = this.enabled && this.holster <= 0.001 && this.adsHeld;
    this.motionK = Math.min(1, this.motionK + dt / MOTIONS[this.motion].seconds);
    this.vm.step(this.spring, new Vector2(), dt);
    // idle: a slow breath and the tassel swinging; a move plays its key poses; holding for HEAVY draws the fan up and back
    this.time += dt; const pose = motionPose(this.motion, this.motionK), c = this.motionK >= 1 ? this.charge : 0, breath = Math.sin(this.time * 1.3);
    this.model.position.set(HOLD.x + pose.x + c * 0.04, HOLD.y + pose.y + breath * 0.004 + c * 0.06, HOLD.z + pose.z + c * 0.03);
    this.model.rotation.set(HOLD.pitch + pose.pitch + breath * 0.015 + c * 0.35, HOLD.yaw + this.spring.yaw + pose.yaw + c * 0.2, HOLD.roll + pose.roll - c * 0.25);
    const swish = this.motionK < 1 ? Math.sin(this.motionK * Math.PI) : 0;
    // the tassel hangs plumb (the hold's and the move's roll taken back out), swaying
    this.parts.tassel.rotation.z = -(HOLD.roll + pose.roll - c * 0.25) + Math.sin(this.time * 2.1) * 0.25 + swish * (this.motion === 'swing' ? -0.7 : 0.7);
    this.model.visible = this.holster < 0.5 && !this.stowed();
  }
}
