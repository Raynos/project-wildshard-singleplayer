import { CreatureBrain, StrikeRunner, NO_FUR, type Animal, type AnimalSpecies, type BoneDef, type SpeciesLook, type SpeciesRow, type StrikeContext, type StrikeSpec, type ThinkCtx } from '#engine';
import { BoxGeometry, Color, ConeGeometry, IcosahedronGeometry, Vector3, type BufferGeometry } from 'three';
import { bindRigid, fit, skyMesh } from '../world/meshes';
import { CROWN, DAIS, ROC } from '../layout';
import { crownStones } from '../world/crown';
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
/** The Roc's perch: the top of the ring's tallest stone (world/crown.ts), the one opposite the arena's entrance. */
const PERCH = (): { x: number; y: number; z: number } => {
  const tallest = crownStones().reduce((best, st) => (st.h > best.h ? st : best));
  return { x: tallest.x, y: CROWN.y + tallest.h + 0.6, z: tallest.z };
};
export type RocPhase = 0 | 1 | 2;
type RocState = 'circle' | 'stalk' | 'strike' | 'rest';

/** The Storm Roc's body. The boss script owns the fight (phases, arena); this brain flies and strikes for the current phase. */
export class StormRocBrain extends CreatureBrain<RocState> {
  phase: RocPhase = 0; fighting = false;
  /** The strike in flight, for the gale-wall visual. */
  current: StrikeSpec | null = null; windup = 0;
  private readonly strikes = new StrikeRunner(); private angle = 0; private rest = 2; private readonly chest = new Vector3();
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
  stageStalk(at: { x: number; z: number }, face: { x: number; z: number }): void {
    const a = this.actor; if (!this.fighting || this.phase !== 0) return;
    this.rest = 0; this.strikes.cancel(); a.cancelAttack(); this.current = null; this.transition('stalk');
    a.place(at.x, at.z, 0, ROC.y); a.yaw = yawTo(a, face.x, face.z);
  }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    if (!this.fighting || ctx.calm) { if (this.state !== 'circle') { this.strikes.cancel(); a.cancelAttack(); this.current = null; this.transition('circle'); } return; }
    this.rest -= ctx.dt;
    if (this.state === 'circle' && this.rest <= 0) this.transition('stalk');
    if (this.state === 'rest' && this.rest <= 0) this.transition('stalk');
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    const s = this.strike(ctx), spec = this.spec(), p = ctx.player;
    if (this.state === 'circle' && !this.fighting) {
      // at rest it perches on the tallest standing stone, opposite the arena's entrance, watching the bridge (council
      // round 2: the arena view frames the Roc, not an empty sky under its bar)
      const perch = PERCH(), d = Math.hypot(perch.x - a.position.x, perch.z - a.position.z);
      ctx.flight.steer(a, d > 0.6 ? yawTo(a, perch.x, perch.z) : yawTo(a, DAIS.x, DAIS.z + 40), d > 0.6 ? Math.min(ROC_SPEED.circle, d * 1.2) : 0, perch.y, 2);
      return;
    }
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
  flight: { altitude: ROC.y, above: 'world', climbRate: 9, diveRate: 24, lockRange: 40 },
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
const ROC_SPAN = 15;
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
function rocMesh(source: BufferGeometry): AnimalSpecies {
  const g = fit(source, { size: ROC_SPAN, by: 'span', middle: 1.6, pitch: Math.PI / 2 }), p = g.getAttribute('position');
  let z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < ROC_WING_ROOT) { z0 = Math.min(z0, p.getZ(i)); z1 = Math.max(z1, p.getZ(i)); }
  const len = Math.max(0.5, z1 - z0), head = z1 - len * 0.3, tail = z0 + len * 0.3;
  bindRigid(g, (x, _y, z) => x > ROC_WING_ROOT ? WING_L : x < -ROC_WING_ROOT ? WING_R : z > head ? HEAD : z < tail ? TAIL : BODY);
  paintUnderside(g);
  return { bones: ROC_BONES(head, 1.8, tail), furParts: [], eyeParts: [], hardParts: [g],
    dims: { bodyY: 1.6, bodyHalfLen: Math.max(1.4, len / 2), bodyRadius: 1.1, headRadius: 0.55, legLen: 1, feet: [], halfWidth: ROC_SPAN / 2 } };
}
/** The body: the generated model when it loaded, else the code one. */
export const rocBody = (): AnimalSpecies => { const g = skyMesh('storm-roc'); return g ? rocMesh(g) : rocCode(); };
export const STORM_ROC_LOOK: SpeciesLook = { id: 'far.look.stormRoc', species: STORM_ROC.id, kind: 'stormRoc', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.stormRoc', sockets: ['body', 'head', 'wingL', 'wingR', 'tail'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => rocBody(),
  animate: ({ bones, t, alive }) => {
    const flap = alive ? Math.sin(t * 1.9) * 0.45 : 0.9;
    const l = bones['wingL'], r = bones['wingR'], tail = bones['tail'];
    if (l) l.rotation.z = flap; if (r) r.rotation.z = -flap; if (tail) tail.rotation.x = alive ? Math.sin(t * 1.1) * 0.15 : 0;
  },
};
