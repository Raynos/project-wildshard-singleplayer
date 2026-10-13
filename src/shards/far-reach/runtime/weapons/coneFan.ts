import type { ContactFamily, ContactFamilyPorts, ContactScanTarget } from '@wildshard/engine/combat/contactWeapon';
import type { EquipContext, EquipmentRow } from '@wildshard/engine/combat/Equipment';
import type { DeclaredAction } from '@wildshard/engine/input/InputService';
import { HeldContactWeapon, HeldPlayback } from '@wildshard/game/plugin/weaponFamily';
import playback from '../../data/heldPlayback.generated.json' with { type: 'json' };
import { Vector3, Object3D, type Group } from 'three';

type App = ConstructorParameters<typeof HeldContactWeapon>[0];
/** The shared body's contact position, combat actor and optional impulse port. */
export interface ConeFanTarget extends ContactScanTarget { readonly position: Vector3; impulse?: (velocity: Vector3) => void }
/** The trusted loader creates the original contact controller from admitted rows. */
export type ConeFanContacts = (ports: Pick<ContactFamilyPorts<ConeFanTarget>, 'hit' | 'targets' | 'struck'>) => ContactFamily<ConeFanTarget>;

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

/** A cone fan's construction: its equipment row, strikes, view, the input action of its GUST and its parts' builder. */
export interface ConeFanOptions<P extends ConeFanParts> {
  readonly row: EquipmentRow;
  readonly view: ConeFanView;
  /** the input action bound to the GUST (beside `attack` and `heavy`) */
  readonly gustAction: DeclaredAction;
  /** builds the model's parts (once, when the weapon is built) */
  readonly parts: () => P;
}

/** A held cone fan: the arc slash, the held heavy and the cone gust on the shared contact family's rows, its viewmodel moved by its view rows. */
export class ConeFan<P extends ConeFanParts = ConeFanParts> extends HeldContactWeapon<ConeFanTarget> {
  /** the model's parts (a shard dresses them, e.g. paints a leaf) */
  readonly parts: P;
  override readonly model: Group;
  private readonly playback: HeldPlayback;
  private readonly observed = { phase: 1, charge: 0, spring: 0, holster: 0, stowed: 0 };
  /** told of every gust that leaves, with its origin and direction */
  onGust: ((from: Vector3, dir: Vector3) => void) | null = null;
  /** True while the fan is put away (e.g. riding a board): it hides and neither swings nor gusts. */
  stowed: () => boolean = () => false;
  /** The move playing and how far through it (0…1; 1 = done). */
  motion: ConeFanMotion = 'swing'; motionK = 1;
  private readonly targets: () => readonly ConeFanTarget[];
  private readonly view: ConeFanView; private readonly gustAction: DeclaredAction;
  protected readonly moves: ContactFamily<ConeFanTarget>;
  private secondary: ((family: ContactFamily<ConeFanTarget>) => number | null) | null = null;

  constructor(app: App, targets: () => readonly ConeFanTarget[], o: ConeFanOptions<P>, contacts: ConeFanContacts) {
    super(app, o.row, o.view.spring, o.view.charge);
    this.parts = o.parts(); this.model = this.parts.group;
    this.targets = targets; this.view = o.view; this.gustAction = o.gustAction;
    this.playback = new HeldPlayback(playback, new Map([['root', this.model], ['pendant', this.parts.pendant ?? new Object3D()]]));
    this.moves = contacts({ hit: (req) => this.contact.hit(req), targets: () => this.targets(), struck: (id, killed) => { this.onHit?.(id, false, killed); } });
    const hold = o.view.hold;
    this.model.position.set(hold.x, hold.y, hold.z); this.model.rotation.set(hold.pitch, hold.yaw, hold.roll); this.model.scale.setScalar(hold.scale);
  }
  /** Retain the held clock and bind only the already admitted secondary action. */
  bindSecondary(start: (family: ContactFamily<ConeFanTarget>) => number | null, charge: number): void { this.secondary = start; this.chargeSeconds = charge; }
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.app.input.bind(this.gustAction, () => { this.gust(); }, ctx.scope, () => this.enabled);
  }
  private aimed(): { from: Vector3; dir: Vector3 } | null {
    const from = new Vector3(), dir = new Vector3();
    return this.aim(from, dir) ? { from, dir } : null;
  }
  /** SWING (light) or HEAVY: claims the cooldown, plays the move and slashes along the aim. */
  swing(heavy: boolean): boolean {
    if (this.moves.cooldown > 0 || !this.enabled || this.stowed()) return false;
    this.moves.claim(heavy ? 1 : 0); this.play(heavy ? 'heavy' : 'swing'); this.onSwing?.(heavy);
    const aim = this.aimed(); if (aim !== null) this.slash(aim.from, aim.dir, heavy);
    return true;
  }
  /** One slash from `from` along `dir`: every target in the arc takes a hit. Returns how many were struck. */
  slash(from: Vector3, dir: Vector3, heavy: boolean): number {
    const struck = this.moves.land(heavy ? 1 : 0, 0, from, dir);
    if (struck > 0) this.onFire?.();
    return struck;
  }
  /** GUST: claims its cooldown, plays the move and blows the cone along the aim. */
  gust(): void {
    if (this.moves.secondaryCooldown > 0 || !this.enabled || this.stowed()) return;
    if (this.secondary?.(this.moves) !== 2) return;
    this.play('gust');
    const aim = this.aimed(); if (aim === null) return;
    this.onGust?.(aim.from, aim.dir); this.blow(aim.from, aim.dir);
  }
  /** The GUST cone: an impulse away from `from` (plus a little lift) and a small hit on each target inside it. */
  blow(from: Vector3, dir: Vector3): number { this.moves.land(2, 0, from, dir); return this.moves.touched; }
  private play(motion: ConeFanMotion): void { this.motion = motion; this.motionK = 0; }
  override update(dt: number): void {
    this.stepHeld(dt);
    this.motionK = Math.min(1, this.motionK + dt / this.view.motions[this.motion].seconds);
    this.playback.beginFrame(dt);
    const observed = this.observed;
    observed.phase = this.motionK; observed.charge = this.charge; observed.spring = this.spring.yaw; observed.holster = this.holster; observed.stowed = Number(this.stowed());
    this.playback.apply(this.motion, observed);
  }
}

/** The constructor a row binds: `new WarFan(app, targets)`. */
export interface ConeFanType<P extends ConeFanParts> {
  new (app: App, targets: () => readonly ConeFanTarget[], contacts: ConeFanContacts): ConeFan<P>;
  readonly prototype: ConeFan<P>;
}
/**
 * Bind a shard's row to the family (SHARD-PLATFORM M3): the shard writes data and a model, never a subclass.
 *
 *   export const WarFan = coneFanType({ row: FAN_ROW, strikes: FAN_STRIKES, view: FAN_VIEW, gustAction: 'far.gust', parts: fanParts });
 */
export function coneFanType<P extends ConeFanParts>(row: ConeFanOptions<P>): ConeFanType<P> {
  return class extends ConeFan<P> {
    constructor(app: App, targets: () => readonly ConeFanTarget[], contacts: ConeFanContacts) { super(app, targets, row, contacts); }
  };
}
