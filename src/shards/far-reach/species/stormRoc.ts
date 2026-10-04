import { CreatureBrain } from '@wildshard/engine/ai/CreatureBrain';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { StrikeRunner, type StrikeContext, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import type { Animal } from '@wildshard/engine/entities/Animal';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { AnimalSpecies, BoneDef, ThinkCtx } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { BoxGeometry, Color, ConeGeometry, Float32BufferAttribute, IcosahedronGeometry, Uint16BufferAttribute, Vector3, type BufferGeometry } from 'three';
import { bindRigid, fit, skyHd, skyMesh, type SkyHd } from '../world/meshes';
import { CROWN, DAIS, ROC } from '../layout';
import { crownStones } from '../world/crown';
import { STORM } from '../world/storm';
import { STRINGS } from '../strings';
import { hull, pushPlayer, yawTo } from './rig';

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
export class StormRocBrain extends CreatureBrain<RocState> {
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
const brains = new WeakMap<Animal, StormRocBrain>();
export const rocBrain = (a: Animal): StormRocBrain => { let value = brains.get(a); if (!value) { value = new StormRocBrain(a); brains.set(a, value); } return value; };
export const STORM_ROC: SpeciesRow = { id: 'far.creature.stormRoc', kind: 'stormRoc', label: STRINGS.roc, aggressive: true, blood: false,
  // bank (engine 8252e3978): it rolls into its turns, so the lap round the dais banks (round 7: 'a frontal level bird')
  flight: { altitude: ROC.y, above: 'world', climbRate: 9, diveRate: 24, lockRange: 40, bank: 0.35 },
  variants: [{ id: 'storm', label: STRINGS.roc, weight: 1, rarity: 'legendary', scale: [1, 1], hp: 420 }],
  think: (a, ctx) => { rocBrain(a).think(ctx); }, act: (a, ctx) => { rocBrain(a).act(ctx); } };

const BODY = 0, HEAD = 1, WING_L = 2, WING_R = 3, TAIL = 4;
const wing = (side: number, bone: number): { geometry: ConeGeometry; bone: number; color: number; at: readonly [number, number, number]; rot: readonly [number, number, number] }[] => [
  { geometry: new ConeGeometry(0.9, 4.8, 4), bone, color: 0x3b3150, at: [side * 2.9, 1.6, -0.2], rot: [0, 0, side * Math.PI / 2] },
  { geometry: new ConeGeometry(0.6, 3.2, 4), bone, color: 0xd9a066, at: [side * 4.4, 1.5, -0.7], rot: [0.2, 0, side * Math.PI / 2] },
];
/** Where a wing starts (metres off the centre line): outboard of it a facet rides its wing bone. */
const ROC_WING_ROOT = 1.1;
/** The Roc's wingspan (metres). */
// E399 (mockup D: a great eagle whose wings span the portrait frame from the arena's entrance; it was 11 m)
// (round 7, the seats: mockup D's eagle spans ~0.96 of the portrait frame from the arena; at its lap ~33 m out that is ~20 m)
const ROC_SPAN = 16;
const ROC_BONES = (head: number, headY: number, tail: number): BoneDef[] => [{ name: 'body', parent: null, pos: [0, 1.6, 0] },
  { name: 'head', parent: 'body', pos: [0, headY, head] }, { name: 'wingL', parent: 'body', pos: [ROC_WING_ROOT, 1.7, 0] },
  { name: 'wingR', parent: 'body', pos: [-ROC_WING_ROOT, 1.7, 0] }, { name: 'tail', parent: 'body', pos: [0, 1.5, tail] }];
/** The code Roc: primitive parts (the stand-in while the generated model is missing). */
function rocCode(): AnimalSpecies {
  return { bones: ROC_BONES(1.6, 2.1, -1.4), furParts: [], eyeParts: [],
    hardParts: [hull([
      { geometry: new IcosahedronGeometry(1.1, 0), bone: BODY, color: 0x463a5c, at: [0, 1.6, 0], rot: [0, 0, 0] },
      { geometry: new BoxGeometry(1.3, 1, 2.4), bone: BODY, color: 0x3b3150, at: [0, 1.6, -0.2] },
      { geometry: new IcosahedronGeometry(0.55, 0), bone: HEAD, color: 0xe8dcc8, at: [0, 2.2, 1.7] },
      { geometry: new ConeGeometry(0.22, 0.8, 4), bone: HEAD, color: 0xf0b542, at: [0, 2.1, 2.4], rot: [Math.PI / 2, 0, 0] },
      ...wing(1, WING_L), ...wing(-1, WING_R),
      { geometry: new ConeGeometry(0.7, 2.2, 4), bone: TAIL, color: 0x2e2640, at: [0, 1.5, -2.4], rot: [-Math.PI / 2, 0, 0] },
      { geometry: new BoxGeometry(0.18, 1.1, 0.18), bone: BODY, color: 0xf0b542, at: [0.35, 0.55, 0.1] },
      { geometry: new BoxGeometry(0.18, 1.1, 0.18), bone: BODY, color: 0xf0b542, at: [-0.35, 0.55, 0.1] },
    ])],
    dims: { bodyY: 1.6, bodyHalfLen: 1.4, bodyRadius: 1.1, headRadius: 0.55, legLen: 1, feet: [], halfWidth: 5.5 } };
}
/**
 * The generated Roc (C6: Hunyuan3D-2 from `art/far-reach/round-7-models/ref-roc.jpg`): generated upright (the ref faces the
 * camera), so it is pitched forward to fly, its pale banded front becoming the underside you see from the crown; 11 m from
 * wing tip to wing tip, its middle at the body bone. Facets outboard of the wing roots ride the wings; along the centre line the front third
 * is the head, the back third the tail.
 */
/**
 * The Roc's underside (council R2C-2: during the dive its plain belly filled the frame): cream breast feathers with dark
 * chevrons under the body, barred flight feathers under the wings with dark tips, painted into the model's vertex colours
 * on every face that looks down.
 */
function paintUnderside(g: BufferGeometry): void {
  if (!g.hasAttribute('color')) return;
  if (!g.hasAttribute('normal')) g.computeVertexNormals();
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), c = g.getAttribute('color');
  // E399 (mockup D: a great eagle, dark brown wings with paler barred flight feathers, a cream breast; it is seen from
  // below against the low sun, so the old cream-and-slate underside read as a grey blur)
  const cream = new Color(0xe9dcc2), slate = new Color(0x3c3446), rust = new Color(0x9a5a34), brown = new Color(0x5e4230), barred = new Color(0xb39572), dusk = new Color(0x2b221c), out = new Color();
  for (let i = 0; i < p.count; i++) {
    const down = -n.getY(i); if (down < 0.25) continue;
    const x = p.getX(i), z = p.getZ(i), ax = Math.abs(x), k = Math.min(1, (down - 0.25) / 0.4);
    if (ax < ROC_WING_ROOT * 1.3) {
      // the breast: cream with dark chevrons down the body, a rust wash toward the tail
      const chevron = (((z + ax * 0.7) * 2.6) % 1 + 1) % 1 < 0.3;
      out.copy(cream).lerp(rust, Math.max(0, -z) * 0.12).lerp(slate, chevron ? 0.75 : 0);
    } else {
      // the wings: barred flight feathers, the tips dark
      const bar = ((ax * 1.7) % 1 + 1) % 1 < 0.28, tip = ax > ROC_SPAN * 0.42;
      out.copy(tip ? dusk : bar ? barred : brown);
    }
    c.setXYZ(i, c.getX(i) + (out.r - c.getX(i)) * k, c.getY(i) + (out.g - c.getY(i)) * k, c.getZ(i) + (out.b - c.getZ(i)) * k);
  }
  c.needsUpdate = true;
}
/** Rig a fitted Roc (facing +z, wings along x, its middle at the body bone): facets outboard of the wing roots ride the
 * wings; along the centre line the front third is the head, the back third the tail. */
function rocRig(g: BufferGeometry): { bones: BoneDef[]; len: number } {
  const p = g.getAttribute('position');
  let z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < ROC_WING_ROOT) { z0 = Math.min(z0, p.getZ(i)); z1 = Math.max(z1, p.getZ(i)); }
  const len = Math.max(0.5, z1 - z0), head = z1 - len * 0.3, tail = z0 + len * 0.3;
  bindRigid(g, (x, _y, z) => x > ROC_WING_ROOT ? WING_L : x < -ROC_WING_ROOT ? WING_R : z > head ? HEAD : z < tail ? TAIL : BODY);
  return { bones: ROC_BONES(head, 1.8, tail), len };
}
/** How far below the flight line the lifted head still looks (radians): a soaring eagle eyes the ground ahead of it. */
const ROC_HEAD_DIP = 0.3;
const smooth = (a: number, b: number, v: number): number => { const k = Math.min(1, Math.max(0, (v - a) / (b - a))); return k * k * (3 - 2 * k); };
/**
 * Skin the textured eagle with blended weights (council round 13, finding 1: 'torn: sky shows through its legs and tail').
 * Bound a whole triangle to one bone, every triangle across a wing root opened a crack as the wings flapped, and the
 * line x = ±1.1 m ran down through both legs and the tail fan. Here each vertex blends: a wing's weight eases in across
 * its root (|x| 1.3 to 2.6 m) and out again toward the tail fan, so the legs, the breast and the fan stay with the body
 * and the skin bends instead of splitting. The weights are read in the model's own upright frame (`pitch` undone:
 * `up` runs from the tail fan to the head, `fwd` out of the breast), so they hold for any flight pitch.
 */
function rocSkin(g: BufferGeometry, pitch: number): { bones: BoneDef[]; len: number } {
  const p = g.getAttribute('position'), n = p.count, c = Math.cos(pitch), s = Math.sin(pitch);
  let z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) if (Math.abs(p.getX(i)) < ROC_WING_ROOT) { z0 = Math.min(z0, p.getZ(i)); z1 = Math.max(z1, p.getZ(i)); }
  const len = Math.max(0.5, z1 - z0), head = z1 - len * 0.3, tail = z0 + len * 0.3;
  const index = new Uint16Array(n * 4), weight = new Float32Array(n * 4), lift = new Float32Array(n);
  const upOf = (i: number): number => p.getY(i) * c + p.getZ(i) * s, fwdOf = (i: number): number => p.getZ(i) * c - p.getY(i) * s;
  let up0 = Infinity, fwd0 = Infinity;
  for (let i = 0; i < n; i++) { up0 = Math.min(up0, upOf(i)); fwd0 = Math.min(fwd0, fwdOf(i)); }
  for (let i = 0; i < n; i++) {
    // metres up from the tail fan's tip, and forward from the tail's back edge (the 16 m eagle: its fan is the lowest ~2.8 m)
    const x = p.getX(i), z = p.getZ(i), up = upOf(i) - up0, fwd = fwdOf(i) - fwd0;
    // the wings: out from the shoulder, and not the tail fan below them (the fan's sides reach |x| 3 m)
    const wingW = smooth(ROC_WING_ROOT * 1.2, ROC_WING_ROOT * 2.4, Math.abs(x)) * (1 - smooth(2.9, 1.7, up));
    // the tail: the fan below and behind the legs
    const fan = (1 - wingW) * smooth(2.7, 1.5, up) * smooth(3.3, 2.3, fwd);
    // the head: the front of the centre line, eased in across the neck so it can turn without a seam
    const rest = 1 - wingW - fan, headW = rest * smooth(head - 0.7, head + 0.5, z);
    index[i * 4] = x > 0 ? WING_L : WING_R; weight[i * 4] = wingW;
    index[i * 4 + 1] = TAIL; weight[i * 4 + 1] = fan;
    index[i * 4 + 2] = HEAD; weight[i * 4 + 2] = headW;
    index[i * 4 + 3] = BODY; weight[i * 4 + 3] = rest - headW;
    lift[i] = rest * smooth(head - 0.6, head + 0.9, z);
  }
  // the neck: where the centre line crosses into the head
  let ny = 0, nk = 0;
  for (let i = 0; i < n; i++) if (Math.abs(p.getX(i)) < ROC_WING_ROOT && Math.abs(p.getZ(i) - head) < 0.4) { ny += p.getY(i); nk++; }
  const neckY = nk > 0 ? ny / nk : 1.8, neckZ = head;
  // (round 13: 'no face or beak shows') the eagle was modelled upright, its face toward the camera; laid level to fly, its
  // face looked at the ground and a viewer below saw only its white crown. Lift the head back up by the flight pitch
  // (less ROC_HEAD_DIP), bending the neck smoothly across its blend, so the face and hooked beak look ahead along the flight.
  if (!g.hasAttribute('normal')) g.computeVertexNormals();
  const nrm = g.getAttribute('normal'), bend = ROC_HEAD_DIP - pitch;
  for (let i = 0; i < n; i++) {
    const a = bend * (lift[i] ?? 0); if (a === 0) continue;
    const ca = Math.cos(a), sa = Math.sin(a), dy = p.getY(i) - neckY, dz = p.getZ(i) - neckZ;
    p.setXYZ(i, p.getX(i), neckY + dy * ca - dz * sa, neckZ + dy * sa + dz * ca);
    const ny0 = nrm.getY(i), nz0 = nrm.getZ(i); nrm.setXYZ(i, nrm.getX(i), ny0 * ca - nz0 * sa, ny0 * sa + nz0 * ca);
  }
  p.needsUpdate = true; nrm.needsUpdate = true; g.computeBoundingBox(); g.computeBoundingSphere();
  g.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4));
  return { bones: ROC_BONES(head, neckY - 1.6, tail), len };
}
const rocDims = (len: number): AnimalSpecies['dims'] => ({ bodyY: 1.6, bodyHalfLen: Math.max(1.4, len / 2), bodyRadius: 1.1, headRadius: 0.55, legLen: 1, feet: [], halfWidth: ROC_SPAN / 2 });
function rocMesh(source: BufferGeometry): AnimalSpecies {
  const g = fit(source, { size: ROC_SPAN, by: 'span', middle: 1.6, pitch: Math.PI / 2 }), { bones, len } = rocRig(g);
  paintUnderside(g);
  return { bones, furParts: [], eyeParts: [], hardParts: [g], dims: rocDims(len) };
}
/**
 * The textured Roc (E392/E399, mockup D; `art/far-reach/round-19-hero-models/refs/ref-rocbelow`): Hunyuan3D-2's painted
 * great eagle (dark brown underwings with pale barred flight feathers, a cream-white head and breast, a golden beak and
 * talons), generated from straight below in one plane, so it is pitched forward to fly with its painted side down. Its own paint is the map (the vertex colours stay white), fed back a little as emissive so
 * it reads against the low sun; rigged like the faceted one, so the wings flap.
 */
// (top-10 row 8, art/far-reach/round-27-roc: the eagle from mockup D, modelled from the front: pitched into flight and
// turned so its head leads)
// (round 13, seat A and the lead: pitched only 0.45 it flew nearly upright, head up behind the boss bar and its tail fan
// hanging over the sun; 1.1 lays its body near level, head forward and below the wings, tail trailing behind)
const ROC_HD = { pitch: 1.1, yaw: 0, selfLight: 0.35 } as const;
function rocHd(m: SkyHd): AnimalSpecies {
  const g = m.geometry.toNonIndexed(); m.geometry.dispose();
  g.rotateY(ROC_HD.yaw); fit(g, { size: ROC_SPAN, by: 'span', middle: 1.6, pitch: ROC_HD.pitch });
  g.setAttribute('color', new Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(1), 3));
  const { bones, len } = rocSkin(g, ROC_HD.pitch);
  return { bones, furParts: [], eyeParts: [], hardParts: [g], dims: rocDims(len), map: m.map, facetJitter: 0, selfLight: ROC_HD.selfLight };
}
/** The body: the textured model when it loaded, else the faceted generated one, else the code one. */
export const rocBody = (): AnimalSpecies => { const t = skyHd('roc-hd'); if (t) return rocHd(t); const g = skyMesh('storm-roc'); return g ? rocMesh(g) : rocCode(); };
/** The soaring wings' raised V (radians): level, from the arena they read edge-on; raised, their undersides face a viewer below. */
const ROC_DIHEDRAL = 0.1;
export const STORM_ROC_LOOK: SpeciesLook = { id: 'far.look.stormRoc', species: STORM_ROC.id, kind: 'stormRoc', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.stormRoc', sockets: ['body', 'head', 'wingL', 'wingR', 'tail'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => rocBody(),
  animate: ({ bones, t, dt, alive, mem }) => {
    // a 19 m raptor soars (round 7: a steady beat caught the wings raised edge-on in half the frames; mockup D's eagle glides,
    // wings spread): a slow flex, with a few strong beats in a short burst every ~6 s
    const burst = Math.max(0, Math.sin(t * 1.05) - 0.85) / 0.15;
    const flap = alive ? ROC_DIHEDRAL + Math.sin(t * 0.9) * 0.06 + Math.sin(t * 3.8) * 0.45 * burst : 0.9;
    const l = bones['wingL'], r = bones['wingR'], tail = bones['tail'], body = bones['body'];
    if (l) l.rotation.z = flap; if (r) r.rotation.z = -flap; if (tail) tail.rotation.x = alive ? Math.sin(t * 1.1) * 0.15 : 0;
    // the take-off's lean into its swing onto the player (the brain's rocLean), eased; level flight adds the engine's bank
    const lean = (mem['rocBank'] ?? 0) + ((alive ? mem['rocLean'] ?? 0 : 0) - (mem['rocBank'] ?? 0)) * Math.min(1, dt * 3);
    mem['rocBank'] = lean; if (body) body.rotation.z = lean;
    // (round 13: 'no face or beak shows') the head looks into the turn it leans into, so from the ground you see a turned
    // white head and its hooked beak, as mockup D's eagle shows them
    const head = bones['head'];
    if (head) head.rotation.y = alive ? Math.max(-0.6, Math.min(0.6, -lean * 1.8)) + Math.sin(t * 0.45) * 0.12 : 0;
  },
};
