// Shipping policy oracle captured from b478f70cf:src/shards/far-reach/species/stormRoc.ts.
// Presentation is excluded; the exact original decision/act bodies are kept for SF72 replay checks.
import { CreatureBrain } from '../../../src/engine/ai/CreatureBrain';
import { StrikeRunner, type StrikeContext, type StrikeSpec } from '../../../src/engine/ai/strikes';
import type { Animal } from '../../../src/engine/entities/AnimalView';
import type { ThinkCtx } from '../../../src/engine/entities/species/registry';
import { Vector3 } from 'three';
import { CROWN, DAIS, ROC } from '../../../src/shards/far-reach/layout';
import { crownStones } from '../../../src/shards/far-reach/runtime/crownLayout';
import { STORM } from '../../../src/shards/far-reach/data/storm';
import { pushPlayer, yawTo } from '../../../src/shards/far-reach/species/rig';

/** Phase 1: the stoop, a 3-D sphere dive from the storm onto the player's chest. */
export const STOOP: StrikeSpec = { id: 'far.roc.stoop', shape: { kind: 'sphere', radius: 2.6 }, windup: 1.2, active: 1.2, recover: 0.8, cooldown: 4,
  range: 22, damage: 14, tags: ['creature.stormRoc'], units: 'world', weight: () => 1 };
/** Phase 2: a gale wall, a wide lane of wind swept across the crown from the Roc's hover; it shoves you along the lane toward the rim (G24). */
export const GALE_WALL: StrikeSpec = { id: 'far.roc.galeWall', shape: { kind: 'lane', length: 26, width: 6 }, windup: 1.5, active: 0.6, recover: 1.4, cooldown: 3.5,
  range: 30, damage: 12, tags: ['creature.stormRoc'], units: 'world', weight: () => 1 };
/** Phase 3: grounded, a wing sweep around the dais. */
export const SWEEP: StrikeSpec = { id: 'far.roc.sweep', shape: { kind: 'arc', radius: 4.5, halfAngle: 1.2 }, windup: 0.9, active: 0.3, recover: 1.1, cooldown: 2.2,
  range: 5, damage: 16, tags: ['creature.stormRoc'], units: 'world', weight: () => 1 };
/** The gale wall's shove (m/s along the lane, m/s up): enough to slide you most of the way across the crown. */
export const ROC_GALE = { shove: 14, lift: 2 } as const;
export const ROC_SPEED = { circle: 10, stalk: 12, dive: 20, walk: 2.4 } as const;
/**
 * The take-off as a fight begins: its seconds, the slow speed it gathers out from the perch (m/s), how fast it
 * swings round onto the player (rad/s) and the most it leans into that swing (rad).
 */
// (round 9, the lead: the fight starts at the bridge landing; a player walks into the arena's view in ~3.1 s)
// (round 13, seat A and the lead: it launched at a fixed rim point, head-on and level; now it drops off its perch facing
// into the storm's wind (perchYaw) and swings round onto the player, leaning into the turn as an eagle does at low speed)
export const ROC_TAKEOFF = { seconds: 4, speed: 1.6, turn: 0.15, bank: 0.35 } as const;
/** The Roc's perch: the top of the ring's tallest stone (world/crown.ts), the one opposite the arena's entrance. */
const PERCH = (): { x: number; y: number; z: number } => {
  const tallest = crownStones().reduce((best, st) => (st.h > best.h ? st : best));
  return { x: tallest.x, y: CROWN.y + tallest.h + 0.6, z: tallest.z };
};
/** The storm's eye (world/build.ts hangs the vortex STORM.ahead north of the crown). */
const STORM_EYE = { x: CROWN.x, z: CROWN.z - STORM.ahead } as const;
/**
 * The perched Roc's heading: into the storm's wind (E410 row 5; the seats: a fixed 0.8 rad turn from the entrance was
 * chosen against mockup D's camera, not by the arena). A perched raptor faces into the wind, so its feathers lie flat and
 * it lifts off into it. The storm's winds circle its eye the way its painted vortex turns: the lower disc spins positive
 * about +y (STORM.layers[0].spin, counter-clockwise seen from above), so on the crown, south of the eye, they blow east
 * across the arena and the Roc on the tallest stone faces west into them, side-on to whoever walks in from the bridge.
 * Its take-off then swings it round onto the player.
 */
export const perchYaw = (): number => {
  const perch = PERCH(), spin = Math.sign(STORM.layers[0].spin), dx = perch.x - STORM_EYE.x, dz = perch.z - STORM_EYE.z;
  // the wind at the perch is spin * (up × out-from-the-eye) = spin * (dz, -dx); the Roc faces the other way
  return Math.atan2(-spin * dz, spin * dx);
};
export type RocPhase = 0 | 1 | 2;
type RocState = 'circle' | 'stalk' | 'strike' | 'rest';

/** The Storm Roc's body. The boss script owns the fight (phases, arena); this brain flies and strikes for the current phase. */
export class StormRocBrain extends CreatureBrain<RocState, Animal> {
  phase: RocPhase = 0; fighting = false;
  /** The strike in flight, for the gale-wall visual. */
  current: StrikeSpec | null = null; windup = 0;
  private readonly strikes = new StrikeRunner(); private angle = 0; private rest = 2; private readonly chest = new Vector3();
  /** The take-off's seconds left (E399 round 8): as a fight begins the Roc rises over its perch before it sets off on its lap. */
  private takeoff = 0; private wasFighting = false;
  /** The committed strike heading (the gale wall's lane). */
  aim = 0;
  constructor(actor: Animal) { super(actor, ['circle', 'stalk', 'strike', 'rest']); }
  private strike(ctx: ThinkCtx): StrikeContext { const a = this.actor; this.chest.copy(ctx.player); this.chest.y += this.phase === 0 ? 1.2 : 0;
    return { actor: a, target: this.chest, canReach: () => ctx.reach(a), hit: (spec) => { ctx.hurt(spec.damage); if (spec === GALE_WALL) pushPlayer(this.aim, ROC_GALE.shove, ROC_GALE.lift); } }; }
  private spec(): StrikeSpec { return this.phase === 0 ? STOOP : this.phase === 1 ? GALE_WALL : SWEEP; }
  /** The altitude the Roc holds in this phase: high in the storm, a wall-height hover, or standing on the dais. */
  private altitude(): number { return this.phase === 0 ? ROC.y : this.phase === 1 ? CROWN.y + 7 : CROWN.y + DAIS.h + 0.05; }
  /**
   * Capture staging (E399, the mock-D view): a first-phase stalk under way, the Roc at `at` at its circle's height, flying
   * in at `face`. Real flight state, nothing else.
   */
  /**
   * Stage the circling lap (E399 round 7, the lead's ruling): the rest after a strike, which every fight shows for 2.4 s,
   * circling the dais at its lap altitude: placed on the circle at `theta`, flying along it. Real flight state only.
   */
  stageLap(theta: number): void {
    const a = this.actor; if (!this.fighting || this.phase !== 0) return;
    this.strikes.cancel(); a.cancelAttack(); this.current = null; this.angle = theta; this.rest = 2.4; this.transition('rest');
    a.place(ROC.x + Math.cos(theta) * ROC.r, ROC.z + Math.sin(theta) * ROC.r, 0, ROC.y);
    a.yaw = yawTo(a, ROC.x + Math.cos(theta + 0.3) * ROC.r, ROC.z + Math.sin(theta + 0.3) * ROC.r);
  }
  /**
   * Stage the fight's opening (E399 round 8, seats B and C, X1: 'the state this spot produces'): the Roc on its perch on the
   * tallest stone as the boss begins, its first 2 s rest running; it lifts off and swings round onto the player (round 13),
   * then circles into its first stalk. What every fight shows in its first seconds, from wherever the player entered.
   */
  /** A fight restart (the boss's retry or checkpoint): the first rest and the take-off run again (round 9: on a retry the
   * rest timer was never reset, so the take-off did not replay). */
  restart(): void {
    this.strikes.cancel(); this.actor.cancelAttack(); this.current = null; this.rest = 2; this.takeoff = 0; this.wasFighting = false; this.transition('circle');
    // back on its perch (round 12, the lead: a retry left it wherever it was), at rest (round 13: placed mid-lap it kept its
    // lap speed and slid ~5 m off the stone before the take-off began), facing into the storm's wind
    const perch = PERCH(); this.angle = Math.atan2(perch.z - ROC.z, perch.x - ROC.x);
    this.actor.place(perch.x, perch.z, 0, perch.y); this.actor.yaw = perchYaw(); this.actor.speed = 0; this.actor.mem['rocBank'] = 0;
  }
  stageOpening(): void {
    const a = this.actor; if (!this.fighting || this.phase !== 0) return;
    const perch = PERCH();
    this.strikes.cancel(); a.cancelAttack(); this.current = null; this.rest = 2; this.transition('circle');
    this.angle = Math.atan2(perch.z - ROC.z, perch.x - ROC.x);
    a.place(perch.x, perch.z, 0, perch.y); a.yaw = perchYaw(); a.speed = 0; a.mem['rocBank'] = 0; this.takeoff = ROC_TAKEOFF.seconds; this.rest = ROC_TAKEOFF.seconds + 0.5; this.wasFighting = true;
  }
  stageStalk(at: { x: number; z: number }, face: { x: number; z: number }): void {
    const a = this.actor; if (!this.fighting || this.phase !== 0) return;
    this.rest = 0; this.strikes.cancel(); a.cancelAttack(); this.current = null; this.transition('stalk');
    a.place(at.x, at.z, 0, ROC.y); a.yaw = yawTo(a, face.x, face.z);
  }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    // the take-off, then the first rest: the stalk waits until the Roc is off its perch
    if (this.fighting && !this.wasFighting && this.phase === 0) { this.takeoff = ROC_TAKEOFF.seconds; this.rest = Math.max(this.rest, ROC_TAKEOFF.seconds + 0.5); }
    this.wasFighting = this.fighting;
    if (!this.fighting || ctx.calm) { if (this.state !== 'circle') { this.strikes.cancel(); a.cancelAttack(); this.current = null; this.transition('circle'); } return; }
    this.rest -= ctx.dt;
    if (this.state === 'circle' && this.rest <= 0) this.transition('stalk');
    if (this.state === 'rest' && this.rest <= 0) this.transition('stalk');
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    const s = this.strike(ctx), spec = this.spec(), p = ctx.player;
    if (this.state === 'circle' && !this.fighting) {
      // at rest it perches on the tallest standing stone, opposite the arena's entrance, facing into the storm's wind (council
      // round 2: the arena view frames the Roc, not an empty sky under its bar)
      const perch = PERCH(), d = Math.hypot(perch.x - a.position.x, perch.z - a.position.z);
      ctx.flight.steer(a, d > 0.6 ? yawTo(a, perch.x, perch.z) : perchYaw(), d > 0.6 ? Math.min(ROC_SPEED.circle, d * 1.2) : 0, perch.y, 2);
      a.mem['rocLean'] = 0;
      return;
    }
    if (this.state === 'circle' && this.takeoff > 0) {
      // the take-off: a slow rise over the perch, turning out toward its lap
      this.takeoff = Math.max(0, this.takeoff - ctx.dt);
      const k = 1 - this.takeoff / ROC_TAKEOFF.seconds;
      // (round 13, seat A: it aimed at the fixed rim point (DAIS.x, CROWN.z + CROWN.r), not at the player) it launches at
      // the player, wherever they stand as it lifts off: from its perch, side-on into the wind, it swings round onto them at
      // ROC_TAKEOFF.turn, leaning into the swing (the lean eases in as it drops off the stone and rolls out as it lines up);
      // it lifts first and gathers speed as it goes, so the launch rises off the stone rather than sliding sideways off it
      const want = yawTo(a, p.x, p.z), off = Math.atan2(Math.sin(want - a.yaw), Math.cos(want - a.yaw));
      a.mem['rocLean'] = -Math.max(-ROC_TAKEOFF.bank, Math.min(ROC_TAKEOFF.bank, off * 1.2)) * Math.min(1, k * 4);
      // (E410: it rose a fixed 2 m and hung at the sun's height, its talons over the sun from the arena) it lifts off into the
      // storm's wind, which gives it airspeed before it has ground speed, so it climbs off the stone to its lap height over the
      // take-off and the lap begins level
      const perchY = PERCH().y;
      ctx.flight.steer(a, want, ROC_TAKEOFF.speed * k, perchY + (this.altitude() - perchY) * k, ROC_TAKEOFF.turn);
      return;
    }
    a.mem['rocLean'] = 0;
    if (this.state === 'circle' || this.state === 'rest') {
      this.angle += (ctx.dt * ROC_SPEED.circle) / ROC.r;
      const r = this.phase === 2 ? DAIS.r * 0.4 : ROC.r, cx = this.phase === 2 ? DAIS.x : ROC.x, cz = this.phase === 2 ? DAIS.z : ROC.z;
      ctx.flight.steer(a, yawTo(a, cx + Math.cos(this.angle) * r, cz + Math.sin(this.angle) * r), this.phase === 2 ? ROC_SPEED.walk : ROC_SPEED.circle, this.altitude(), 2);
      return;
    }
    if (this.state === 'stalk') {
      const d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
      // Phase 1 hangs over the player; phase 2 holds off at the wall's range; phase 3 walks up to the player on the dais.
      const want = this.phase === 0 ? 2.5 : this.phase === 1 ? 14 : 3;
      const heading = this.phase === 1 && d < want ? yawTo(a, p.x, p.z) + Math.PI : yawTo(a, p.x, p.z);
      ctx.flight.steer(a, heading, this.phase === 2 ? ROC_SPEED.walk : Math.min(ROC_SPEED.stalk, Math.abs(d - want) * 1.5), this.phase === 0 ? p.y + 10 : this.altitude(), 3);
      const ready = this.phase === 0 ? d < 4 && Math.abs(a.position.y - (p.y + 10)) < 2 : this.phase === 1 ? Math.abs(d - want) < 3 : d < spec.range;
      if (ready && ctx.reach(a) && ctx.claim(a)) { this.aim = yawTo(a, p.x, p.z); this.strikes.start(spec, a, this.chest); this.current = spec; this.windup = 0; this.transition('strike'); }
      return;
    }
    this.windup += ctx.dt;
    if (spec === STOOP && this.windup >= STOOP.windup) ctx.flight.steer(a, yawTo(a, this.chest.x, this.chest.z), ROC_SPEED.dive, this.chest.y, 4);
    else ctx.flight.steer(a, this.aim, 0, this.phase === 0 ? p.y + 10 : this.altitude(), 4);
    this.strikes.update(ctx.dt, s);
    if (!this.strikes.busy) { this.current = null; this.rest = this.phase === 2 ? 1.2 : 2.4; this.transition('rest'); }
  }
}
