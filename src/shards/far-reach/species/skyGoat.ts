import { CreatureBrain, StrikeRunner, NO_FUR, type Animal, type AnimalSpecies, type SpeciesLook, type SpeciesRow, type StrikeContext, type StrikeSpec, type ThinkCtx } from '#engine';
import { BoxGeometry, ConeGeometry, type BufferGeometry } from 'three';
import { bindRigid, fit, skyMesh } from '../world/meshes';
import { DECK, WINDMILL, apothem } from '../layout';
import { STRINGS } from '../strings';
import { homeOf, hull, yawTo } from './rig';

/** The ram: a short lane straight ahead, telegraphed by a head-down windup. */
export const RAM: StrikeSpec = { id: 'far.goat.ram', shape: { kind: 'lane', length: 4, width: 1.4 }, windup: 0.8, active: 0.5, recover: 0.9, cooldown: 3,
  range: 5, damage: 12, tags: ['creature.skyGoat'], weight: () => 1 };
export const GOAT = { graze: 1.2, ram: 7.5, notice: 9, rimMargin: 2.5 } as const;
type GoatState = 'graze' | 'threat' | 'ram' | 'fall';

/**
 * A sky goat walks its island top: a flyer held at its island's deck height (ENGINE §19 `above: 'world'`; a spawn
 * cannot land a ground creature on a registry floor yet, G25). Grazing keeps it inside the rim; once a GUST carries it
 * past the rim it loses its footing and drops into the cloud sea, through `world.killY` (an out-of-world death).
 */
export class SkyGoatBrain extends CreatureBrain<GoatState> {
  private readonly strikes = new StrikeRunner();
  private wanderYaw = 0; private wanderT = 0; private ramYaw = 0;
  constructor(actor: Animal) { super(actor, ['graze', 'threat', 'ram', 'fall']); }
  private strike(ctx: ThinkCtx): StrikeContext { const a = this.actor; return { actor: a, target: ctx.player, canReach: () => ctx.reach(a), hit: (spec) => { ctx.hurt(spec.damage); } }; }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    const d = a.position.distanceTo(ctx.player), level = Math.abs(ctx.player.y - a.position.y) < 2.5;
    if (this.state === 'ram' || this.state === 'fall') return;
    this.transition(!ctx.calm && level && d < GOAT.notice ? 'threat' : 'graze');
    this.wanderT -= ctx.dt; if (this.wanderT <= 0) { this.wanderT = ctx.rng.range(2, 5); this.wanderYaw = ctx.rng.range(-Math.PI, Math.PI); }
    if (this.state === 'threat' && !this.strikes.busy && d < RAM.range && ctx.claim(a)) {
      this.ramYaw = yawTo(a, ctx.player.x, ctx.player.z); this.strikes.start(RAM, a, ctx.player); this.transition('ram');
    }
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    const home = homeOf(a, { x: WINDMILL.x, z: WINDMILL.z, r: apothem(WINDMILL), y: WINDMILL.y }), from = Math.hypot(a.position.x - home.x, a.position.z - home.z);
    if (from > home.r + 0.3 && this.state !== 'fall') { this.strikes.cancel(); a.cancelAttack(); this.transition('fall'); }
    if (this.state === 'fall') { ctx.flight.steer(a, a.yaw, 1, home.y - 80, 1); return; }
    if (a.hasImpulse) return;
    const out = from > home.r - GOAT.rimMargin;
    if (this.state === 'ram') {
      this.strikes.update(ctx.dt, this.strike(ctx));
      // The windup holds still (head down); the active window charges along the committed heading.
      ctx.flight.steer(a, this.ramYaw, this.strikes.busy && !out ? GOAT.ram * Math.min(1, Math.max(0, this.strikes.time - RAM.windup) * 4) : 0, home.y, 6);
      if (!this.strikes.busy) this.transition('graze');
      return;
    }
    const toHome = yawTo(a, home.x, home.z);
    if (out) ctx.flight.steer(a, toHome, GOAT.graze * 1.5, home.y, 3);
    else if (this.state === 'threat') ctx.flight.steer(a, yawTo(a, ctx.player.x, ctx.player.z), 1.6, home.y, 3);
    else ctx.flight.steer(a, this.wanderYaw, GOAT.graze, home.y, 1.5);
  }
}
const brains = new WeakMap<Animal, SkyGoatBrain>();
const brain = (a: Animal): SkyGoatBrain => { let value = brains.get(a); if (!value) { value = new SkyGoatBrain(a); brains.set(a, value); } return value; };
export const SKY_GOAT: SpeciesRow = { id: 'far.creature.skyGoat', kind: 'skyGoat', label: STRINGS.goat, aggressive: true, blood: false,
  flight: { altitude: DECK, above: 'world', climbRate: 6, diveRate: 16 },
  variants: [{ id: 'cloud', label: STRINGS.goat, weight: 1, rarity: 'common', scale: [0.95, 1.1], hp: 40 }],
  think: (a, ctx) => { brain(a).think(ctx); }, act: (a, ctx) => { brain(a).act(ctx); } };

const BODY = 0, LEG_FL = 2, LEG_FR = 3, LEG_BL = 4, LEG_BR = 5;
/** The code goat: primitive parts (the stand-in while the generated model is missing). */
function goatCode(): AnimalSpecies {
  return {
    bones: [{ name: 'body', parent: null, pos: [0, 0.85, 0] }, { name: 'head', parent: 'body', pos: [0, 1.15, 0.6] },
      { name: 'legFL', parent: 'body', pos: [0.22, 0.7, 0.4] }, { name: 'legFR', parent: 'body', pos: [-0.22, 0.7, 0.4] },
      { name: 'legBL', parent: 'body', pos: [0.22, 0.7, -0.4] }, { name: 'legBR', parent: 'body', pos: [-0.22, 0.7, -0.4] }],
    furParts: [], eyeParts: [],
    hardParts: [hull([
      { geometry: new BoxGeometry(0.62, 0.5, 1.15), bone: BODY, color: 0xece4da, at: [0, 0.88, 0] },
      { geometry: new BoxGeometry(0.66, 0.2, 1.05), bone: BODY, color: 0xd9cfc4, at: [0, 1.15, -0.02] },
      { geometry: new BoxGeometry(0.3, 0.34, 0.42), bone: 1, color: 0xe4dbd1, at: [0, 1.18, 0.74] },
      { geometry: new ConeGeometry(0.06, 0.4, 4), bone: 1, color: 0x4a3d48, at: [0.1, 1.42, 0.62], rot: [-0.7, 0, 0.3] },
      { geometry: new ConeGeometry(0.06, 0.4, 4), bone: 1, color: 0x4a3d48, at: [-0.1, 1.42, 0.62], rot: [-0.7, 0, -0.3] },
      { geometry: new BoxGeometry(0.12, 0.22, 0.12), bone: 1, color: 0xc9bdb0, at: [0, 0.96, 0.86] },
      ...[[LEG_FL, 0.22, 0.4], [LEG_FR, -0.22, 0.4], [LEG_BL, 0.22, -0.4], [LEG_BR, -0.22, -0.4]].map(([bone, x, z]) => ({
        geometry: new BoxGeometry(0.13, 0.66, 0.13), bone: bone ?? BODY, color: 0x5a4b55, at: [x ?? 0, 0.36, z ?? 0] as const })),
    ])],
    dims: { bodyY: 0.85, bodyHalfLen: 0.6, bodyRadius: 0.35, headRadius: 0.22, legLen: 0.7, feet: [], halfWidth: 0.35 } };
}
/** Leg facets: below this share of the goat's height. */
const GOAT_LEG = 0.42;
/**
 * The generated goat (C6: Hunyuan3D-2 from `art/far-reach/round-7-models/ref-goat.jpg`): 1.45 m nose to tail, hooves at
 * y 0. Facets low under the body ride the leg of their quadrant (each leg bone sits at its leg's top); the front third
 * above the shoulder is the head and horns.
 */
function goatMesh(source: BufferGeometry): AnimalSpecies {
  const g = fit(source, { size: 1.45, by: 'span', floor: 0 }), b = g.boundingBox, p = g.getAttribute('position');
  const h = b ? b.max.y : 1.3, z0 = b ? b.min.z : -0.7, z1 = b ? b.max.z : 0.7, legTop = h * GOAT_LEG, head = z1 - (z1 - z0) * 0.3;
  // each leg's top: the mean x / z of its quadrant's low vertices
  const sum = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], quad = (x: number, z: number): number => (z > 0 ? 0 : 2) + (x > 0 ? 0 : 1);
  for (let i = 0; i < p.count; i++) if (p.getY(i) < legTop * 0.8 && p.getZ(i) < head) { const q = sum[quad(p.getX(i), p.getZ(i))]; if (q) { q[0] = (q[0] ?? 0) + p.getX(i); q[1] = (q[1] ?? 0) + p.getZ(i); q[2] = (q[2] ?? 0) + 1; } }
  const top = (q: number, x: number, z: number): [number, number, number] => { const s = sum[q], n = s?.[2] ?? 0; return n > 0 ? [(s?.[0] ?? 0) / n, legTop, (s?.[1] ?? 0) / n] : [x, legTop, z]; };
  bindRigid(g, (x, y, z) => z > head && y > h * 0.5 ? 1 : y < legTop && z <= head + 0.05 ? LEG_FL + quad(x, z) : BODY);
  return { bones: [{ name: 'body', parent: null, pos: [0, h * 0.55, 0] }, { name: 'head', parent: 'body', pos: [0, h * 0.62, head] },
    { name: 'legFL', parent: 'body', pos: top(0, 0.2, 0.4) }, { name: 'legFR', parent: 'body', pos: top(1, -0.2, 0.4) },
    { name: 'legBL', parent: 'body', pos: top(2, 0.2, -0.4) }, { name: 'legBR', parent: 'body', pos: top(3, -0.2, -0.4) }],
    furParts: [], eyeParts: [], hardParts: [g],
    dims: { bodyY: h * 0.55, bodyHalfLen: (z1 - z0) / 2, bodyRadius: 0.35, headRadius: 0.22, legLen: legTop, feet: [], halfWidth: 0.35 } };
}
/** The body: the generated model when it loaded, else the code one. */
export const goatBody = (): AnimalSpecies => { const g = skyMesh('sky-goat'); return g ? goatMesh(g) : goatCode(); };
export const SKY_GOAT_LOOK: SpeciesLook = { id: 'far.look.skyGoat', species: SKY_GOAT.id, kind: 'skyGoat', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.skyGoat', sockets: ['body', 'head', 'legFL', 'legFR', 'legBL', 'legBR'], clips: ['idle', 'walk', 'attack', 'hit', 'die'] },
  build: () => goatBody(),
  animate: ({ bones, t, alive, speed, phase, attack, deathT }) => {
    // A stride-locked walk (the gait phase from the engine), opposite pairs in step, a clear swing even at a graze.
    const gait = alive ? Math.min(1, Math.abs(speed) / 0.8) : 0, swing = Math.sin(phase * Math.PI * 2) * 0.62 * gait;
    const fl = bones['legFL'], fr = bones['legFR'], bl = bones['legBL'], br = bones['legBR'], head = bones['head'], body = bones['body'];
    if (fl) fl.rotation.x = swing; if (br) br.rotation.x = swing; if (fr) fr.rotation.x = -swing; if (bl) bl.rotation.x = -swing;
    // The ram's windup drops the head (horns forward), the charge holds it there; dead goats fold their legs.
    const ram = attack >= 0 ? Math.min(1, attack * 3) : 0;
    if (head) head.rotation.x = alive ? Math.sin(t * 1.3) * 0.08 + ram * 0.55 + Math.abs(swing) * 0.08 : 0.5;
    if (body) body.rotation.x = alive ? Math.sin(phase * Math.PI * 4) * 0.03 * gait : 0;
    if (!alive && deathT > 0) for (const leg of [fl, fr, bl, br]) if (leg) leg.rotation.x = 1.1 * deathT;
  },
};
