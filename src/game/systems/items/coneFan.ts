import type { App } from '@wildshard/engine/app/app';
import { blocks } from '@wildshard/engine/blocks';
import type { EquipContext, EquipmentRow } from '@wildshard/engine/combat/Equipment';
import type { DeclaredAction } from '@wildshard/engine/input/InputService';
import { Weapon, type WeaponState } from '@wildshard/engine/combat/Weapon';
import { Vector2, Vector3, type Group, type Object3D } from 'three';
import { ConeStrikes, type ConeFanTarget, type ConeStrikeSpec } from './coneStrikes';

/**
 * The cone fan family (SHARD-PLATFORM M3): a held weapon with an arc slash and a cone gust. SWING is an arc slash through
 * the damage pipeline (every live target inside `slash.reach` m and `slash.halfAngle` rad of the aim takes `slash.light`);
 * holding the attack (touch, a still hold) or HEAVY (mouse 2) gives the heavy slash (`slash.heavy`, its own cooldown).
 * GUST blows a cone of wind (`gust.reach`, `gust.halfAngle`): every live target in it takes an impulse away from the player
 * (`gust.push` m/s level, `gust.lift` up) and a small wind hit (`gust.damage`). The moves' cooldowns and contacts are the
 * view-free `ConeStrikes`, which a renderer-free host runs too (its snapshot is `{ cooldown, gustCooldown }`).
 *
 * The view is rows (`ConeFanView`): the model held at `hold`, sprung on the view's turn; each move plays its key poses
 * (eased between them); at rest a slow breath; a held charge draws the fan up and back; a pendant part (a tassel) hangs
 * plumb against the hold's and the move's roll, swaying, and swishes with each move. A shard gives its model's parts
 * (`ConeFanParts`) and binds its row with `coneFanType`, never a subclass.
 *
 *   export const WarFan = coneFanType({ row: FAN_ROW, strikes: FAN_STRIKES, view: FAN_VIEW, gustAction: 'far.gust', parts: fanParts });
 *   const fan = new WarFan(app, targets);  fan.parts.silk.map = leaf;
 */

/** A viewmodel offset (metres, radians). */
export interface ConeFanPose { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly pitch: number; readonly roll: number }
/** A cone fan's three moves. */
export type ConeFanMotion = 'swing' | 'heavy' | 'gust';
/** One move as key poses over its duration: `[k (0…1), pose]`, eased (smoothstep) between keys. */
export interface ConeFanMoveView { readonly seconds: number; readonly keys: readonly (readonly [number, ConeFanPose])[] }
/** The cone fan's view as rows (metres, seconds, radians). */
export interface ConeFanView {
  /** the model's place, turn and scale in the view */
  readonly hold: { readonly x: number; readonly y: number; readonly z: number; readonly pitch: number; readonly yaw: number; readonly roll: number; readonly scale: number };
  /** the view spring (`blocks.viewmodel`) */
  readonly spring: { readonly gain: number; readonly clampYaw: number; readonly clampPitch: number; readonly k: number; readonly c: number };
  /** seconds of hold for a full charge */
  readonly charge: number;
  /** the three moves' key poses */
  readonly motions: Readonly<Record<ConeFanMotion, ConeFanMoveView>>;
  /** the idle breath: its rate (rad/s), lift (m) and pitch (rad) */
  readonly breath: { readonly rate: number; readonly lift: number; readonly pitch: number };
  /** the charge draw at full charge: up and back (m) and turned (rad; roll taken off) */
  readonly draw: { readonly x: number; readonly y: number; readonly z: number; readonly pitch: number; readonly yaw: number; readonly roll: number };
  /** the pendant's sway rate (rad/s) and swing (rad), and the swish each move gives it (the SWING the other way) */
  readonly pendant: { readonly rate: number; readonly sway: number; readonly swish: number };
  /** the model hides once the holster passes this */
  readonly hideAt: number;
}
/** The viewmodel's parts a cone fan moves: the root, and a pendant that hangs plumb (null: none). */
export interface ConeFanParts { readonly group: Group; readonly pendant: Object3D | null }

const REST: ConeFanPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
/** The pose `k` (0…1) of the way through a move, eased between its keys. */
export function coneFanPose(move: ConeFanMoveView, k: number): ConeFanPose {
  const keys = move.keys;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i]; if (a === undefined || b === undefined || k > b[0]) continue;
    const u = Math.max(0, Math.min(1, (k - a[0]) / Math.max(1e-6, b[0] - a[0]))), e = u * u * (3 - 2 * u), A = a[1], B = b[1];
    return { x: A.x + (B.x - A.x) * e, y: A.y + (B.y - A.y) * e, z: A.z + (B.z - A.z) * e, yaw: A.yaw + (B.yaw - A.yaw) * e, pitch: A.pitch + (B.pitch - A.pitch) * e, roll: A.roll + (B.roll - A.roll) * e };
  }
  return REST;
}

/** A cone fan's construction: its equipment row, strikes, view, the input action of its GUST and its parts' builder. */
export interface ConeFanOptions<P extends ConeFanParts> {
  readonly row: EquipmentRow;
  readonly strikes: ConeStrikeSpec;
  readonly view: ConeFanView;
  /** the input action bound to the GUST (beside `attack` and `heavy`) */
  readonly gustAction: DeclaredAction;
  /** builds the model's parts (once, when the weapon is built) */
  readonly parts: () => P;
}

/** A held cone fan: the arc slash, the held heavy and the cone gust on `ConeStrikes`, its viewmodel moved by its view rows. */
export class ConeFan<P extends ConeFanParts = ConeFanParts> extends Weapon {
  /** the model's parts (a shard dresses them, e.g. paints a leaf) */
  readonly parts: P;
  override readonly model: Group;
  private time = 0;
  override readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  override holster = 0; override enabled = true; override adsHeld = false; override aimInfo = null;
  /** told of every swing's start (heavy or light) */
  onSwing: ((heavy: boolean) => void) | null = null;
  /** told of every gust that leaves, with its origin and direction */
  onGust: ((from: Vector3, dir: Vector3) => void) | null = null;
  /** True while the fan is put away (e.g. riding a board): it hides and neither swings nor gusts. */
  stowed: () => boolean = () => false;
  private wasHeld = false; private held = 0;
  /** The move playing and how far through it (0…1; 1 = done). */
  motion: ConeFanMotion = 'swing'; motionK = 1;
  private readonly app: App; private readonly targets: () => readonly ConeFanTarget[];
  private readonly view: ConeFanView; private readonly gustAction: DeclaredAction;
  private readonly spring = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private readonly vm: ReturnType<typeof blocks.viewmodel>;
  private readonly contact: ReturnType<typeof blocks.melee>;
  private readonly strikes: ConeStrikes;
  override get charge(): number { return Math.min(1, this.held / this.view.charge); }

  constructor(app: App, targets: () => readonly ConeFanTarget[], o: ConeFanOptions<P>) {
    super(o.row);
    this.parts = o.parts(); this.model = this.parts.group;
    this.app = app; this.targets = targets; this.view = o.view; this.gustAction = o.gustAction;
    this.vm = blocks.viewmodel({ ...o.view.spring });
    this.contact = blocks.melee(app.combat);
    this.strikes = new ConeStrikes(o.strikes, { hit: (req) => this.contact.hit(req), targets: () => this.targets() });
    this.blocks.vm = this.vm; this.blocks.melee = this.contact;
    const hold = o.view.hold;
    this.model.position.set(hold.x, hold.y, hold.z); this.model.rotation.set(hold.pitch, hold.yaw, hold.roll); this.model.scale.setScalar(hold.scale);
  }
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, () => this.enabled);
    this.app.input.bind('heavy', () => { this.swing(true); }, ctx.scope, () => this.enabled);
    this.app.input.bind(this.gustAction, () => { this.gust(); }, ctx.scope, () => this.enabled);
    ctx.scope.onDispose(() => { this.wasHeld = false; this.held = 0; });
  }
  override tryFire(): void { this.swing(false); }
  private aim(): { from: Vector3; dir: Vector3 } | null {
    const host = this.app.equipmentHost; if (host === null) return null;
    const from = new Vector3(), dir = new Vector3();
    this.setAimSource(() => host.player.sampleAimCommand()); this.aimRay(from, dir);
    return { from, dir };
  }
  /** SWING (light) or HEAVY: claims the cooldown, plays the move and slashes along the aim. */
  swing(heavy: boolean): void {
    if (this.strikes.cooldown > 0 || !this.enabled || this.stowed()) return;
    this.strikes.startSwing(heavy); this.play(heavy ? 'heavy' : 'swing'); this.onSwing?.(heavy);
    const aim = this.aim(); if (aim !== null) this.slash(aim.from, aim.dir, heavy);
  }
  /** One slash from `from` along `dir`: every target in the arc takes a hit. Returns how many were struck. */
  slash(from: Vector3, dir: Vector3, heavy: boolean): number {
    const struck = this.strikes.slash(from, dir, heavy, (id, killed) => { this.onHit?.(id, false, killed); });
    if (struck > 0) this.onFire?.();
    return struck;
  }
  /** GUST: claims its cooldown, plays the move and blows the cone along the aim. */
  gust(): void {
    if (this.strikes.gustCooldown > 0 || !this.enabled || this.stowed()) return;
    this.strikes.startGust(); this.play('gust');
    const aim = this.aim(); if (aim === null) return;
    this.onGust?.(aim.from, aim.dir); this.blow(aim.from, aim.dir);
  }
  /** The GUST cone: an impulse away from `from` (plus a little lift) and a small hit on each target inside it. */
  blow(from: Vector3, dir: Vector3): number { return this.strikes.blow(from, dir); }
  private play(motion: ConeFanMotion): void { this.motion = motion; this.motionK = 0; }
  override update(dt: number): void {
    this.strikes.tick(dt);
    if (!this.enabled || this.holster > 0.001) { this.wasHeld = false; this.held = 0; }
    else if (this.adsHeld) this.held += dt;
    else if (this.wasHeld) { this.strikes.cooldown = 0; this.swing(true); this.held = 0; }
    this.wasHeld = this.enabled && this.holster <= 0.001 && this.adsHeld;
    const view = this.view, hold = view.hold, draw = view.draw;
    this.motionK = Math.min(1, this.motionK + dt / view.motions[this.motion].seconds);
    this.vm.step(this.spring, new Vector2(), dt);
    // idle: a slow breath and the pendant swinging; a move plays its key poses; holding for HEAVY draws the fan up and back
    this.time += dt; const pose = coneFanPose(view.motions[this.motion], this.motionK), c = this.motionK >= 1 ? this.charge : 0, breath = Math.sin(this.time * view.breath.rate);
    this.model.position.set(hold.x + pose.x + c * draw.x, hold.y + pose.y + breath * view.breath.lift + c * draw.y, hold.z + pose.z + c * draw.z);
    this.model.rotation.set(hold.pitch + pose.pitch + breath * view.breath.pitch + c * draw.pitch, hold.yaw + this.spring.yaw + pose.yaw + c * draw.yaw, hold.roll + pose.roll - c * draw.roll);
    const swish = this.motionK < 1 ? Math.sin(this.motionK * Math.PI) : 0;
    // the pendant hangs plumb (the hold's and the move's roll taken back out), swaying
    const pendant = this.parts.pendant;
    if (pendant !== null) pendant.rotation.z = -(hold.roll + pose.roll - c * draw.roll) + Math.sin(this.time * view.pendant.rate) * view.pendant.sway + swish * (this.motion === 'swing' ? -view.pendant.swish : view.pendant.swish);
    this.model.visible = this.holster < view.hideAt && !this.stowed();
  }
}

/** The constructor a row binds: `new WarFan(app, targets)`. */
export interface ConeFanType<P extends ConeFanParts> {
  new (app: App, targets?: () => readonly ConeFanTarget[]): ConeFan<P>;
  readonly prototype: ConeFan<P>;
}
/**
 * Bind a shard's row to the family (SHARD-PLATFORM M3): the shard writes data and a model, never a subclass.
 *
 *   export const WarFan = coneFanType({ row: FAN_ROW, strikes: FAN_STRIKES, view: FAN_VIEW, gustAction: 'far.gust', parts: fanParts });
 */
export function coneFanType<P extends ConeFanParts>(row: ConeFanOptions<P>): ConeFanType<P> {
  return class extends ConeFan<P> {
    constructor(app: App, targets: () => readonly ConeFanTarget[] = () => []) { super(app, targets, row); }
  };
}
