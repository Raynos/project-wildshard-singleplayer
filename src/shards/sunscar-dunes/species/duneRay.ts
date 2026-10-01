/**
 * The dune ray: a big leathery glider (7 m span) that rides the dusk air. Its brain flies it by the animal's `yOffset`
 * (altitude over the local ground) and `setMotion` (heading and speed), never the ground steering:
 *   glide  circles high round a centre that drifts after the player
 *   swoop  a `lane` StrikeSpec: the windup hangs and rears (the telegraph), the active phase dives down the lane to
 *          chest height at the player and pulls out past them. It lands only within 2.6 m of the player.
 *   climb  back up to the glide height. A whip hit during the windup or the dive breaks the swoop into a climb.
 */
import { CreatureBrain, StrikeRunner, NO_FUR, type SpeciesRow, type SpeciesLook, type Animal, type ThinkCtx, type StrikeSpec, type StrikeContext } from '#engine';
import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute } from 'three';
import { STRINGS } from '../strings';

export const RAY_FLIGHT = { glideAlt: 17, glideSpeed: 9, orbitR: 24, swoopSpeed: 17, chest: 1.3, reach: 2.6, climbSpeed: 7, minGlide: 5, maxGlide: 9, sightR: 48 } as const;

export const RAY_STRIKES: readonly StrikeSpec[] = [
  { id: 'sunscar.ray.swoop', shape: { kind: 'lane', length: 40, width: 2.2 }, windup: 1.1, active: 3, recover: 1, cooldown: 2, range: 38, damage: 14,
    tags: ['creature.duneRay'], motion: { speed: RAY_FLIGHT.swoopSpeed, track: 'lead', overshoot: 18 }, eligibility: { maxDy: 3 }, weight: () => 1 },
];

type RayState = 'glide' | 'swoop' | 'climb';
const smooth = (t: number): number => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

export class DuneRayBrain extends CreatureBrain<RayState> {
  readonly strikes = new StrikeRunner();
  /** absolute height (m) the body is flying at; the brain turns it into `yOffset` each body tick */
  altitude: number = RAY_FLIGHT.glideAlt; glideFor: number = RAY_FLIGHT.minGlide; private orbitX = 0; private orbitZ = 0; private hp = -1;
  private swoopFrom = 0; private swoopDist = 1; private landed = false;
  constructor(actor: Animal) { super(actor, ['glide', 'swoop', 'climb']); this.orbitX = actor.position.x; this.orbitZ = actor.position.z; }

  private context(ctx: ThinkCtx): StrikeContext {
    const a = this.actor;
    return { actor: a, target: ctx.player, canReach: () => a.position.distanceTo(ctx.player) < RAY_FLIGHT.reach + 1.2,
      hit: (strike) => { this.landed = true; ctx.hurt(strike.damage); } };
  }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    const ground = ctx.heightAt(a.position.x, a.position.z);
    if (this.hp < 0) { this.hp = a.hp; this.altitude = ground + RAY_FLIGHT.glideAlt; }
    const struck = a.hp < this.hp; this.hp = a.hp;
    // the orbit centre drifts after the player, so the ray stays overhead without tracking every step
    this.orbitX += (ctx.player.x - this.orbitX) * Math.min(1, ctx.dt * 0.15); this.orbitZ += (ctx.player.z - this.orbitZ) * Math.min(1, ctx.dt * 0.15);
    if (this.state === 'swoop') {
      if (struck || ctx.calm || (!this.strikes.busy)) { this.breakOff(); return; }
      if (this.strikes.state === 'recover' || this.strikes.state === 'cooldown') this.transition('climb');
      return;
    }
    if (this.state === 'climb') { if (this.altitude >= ground + RAY_FLIGHT.glideAlt - 1) { this.transition('glide'); this.glideFor = RAY_FLIGHT.minGlide + ctx.rng.next() * (RAY_FLIGHT.maxGlide - RAY_FLIGHT.minGlide); } return; }
    this.glideFor -= ctx.dt;
    const near = Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z) < RAY_FLIGHT.sightR;
    if (this.glideFor <= 0 && near && !ctx.calm && !this.strikes.busy && ctx.claim(a)) {
      const c = this.context(ctx), pick = this.strikes.pick(RAY_STRIKES, c);
      if (pick !== null) { this.strikes.start(pick, a, ctx.player); this.transition('swoop'); this.landed = false;
        this.swoopFrom = this.altitude; this.swoopDist = Math.max(4, Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z)); }
    }
  }
  private breakOff(): void { this.strikes.cancel(); this.actor.cancelAttack(); this.transition('climb'); }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    const ground = ctx.heightAt(a.position.x, a.position.z), glide = ground + RAY_FLIGHT.glideAlt;
    // the strike clock runs in every state (its recover and cooldown finish during the climb); the glide's setMotion
    // below comes after it, so the runner's lane brake never holds the ray in the air
    this.strikes.update(ctx.dt, this.context(ctx));
    if (this.state === 'swoop') {
      const s = this.strikes;
      if (s.state === 'windup') this.altitude += (this.swoopFrom + 2.5 - this.altitude) * Math.min(1, ctx.dt * 2); // rears up: the tell
      else if (s.state === 'active') {
        const along = (a.position.x - s.x0) * (s.x1 - s.x0) / Math.max(1, s.length) + (a.position.z - s.z0) * (s.z1 - s.z0) / Math.max(1, s.length);
        const low = ctx.player.y + RAY_FLIGHT.chest;
        this.altitude = along < this.swoopDist ? low + (this.swoopFrom + 2.5 - low) * (1 - smooth(along / this.swoopDist)) : low + (along - this.swoopDist) * 0.7;
      } else this.altitude += RAY_FLIGHT.climbSpeed * ctx.dt;
      a.mem['fold'] = s.state === 'active' && !this.landed ? 1 : 0;
    } else {
      // glide: a tangent to the orbit circle, corrected toward its radius
      const dx = a.position.x - this.orbitX, dz = a.position.z - this.orbitZ, r = Math.hypot(dx, dz) || 1;
      const tangent = Math.atan2(-dz, dx), correct = Math.max(-0.8, Math.min(0.8, (r - RAY_FLIGHT.orbitR) / RAY_FLIGHT.orbitR));
      a.setMotion(tangent - correct, RAY_FLIGHT.glideSpeed, 0.9);
      const want = this.state === 'climb' ? glide : glide + Math.sin(ctx.t * 0.35) * 2;
      this.altitude += Math.max(-3 * ctx.dt, Math.min(RAY_FLIGHT.climbSpeed * ctx.dt, want - this.altitude));
      a.mem['fold'] = 0;
    }
    a.yOffset = Math.max(0.9, this.altitude - ground);
  }
}

const brains = new WeakMap<Animal, DuneRayBrain>();
export const rayBrain = (a: Animal): DuneRayBrain => { let value = brains.get(a); if (!value) { value = new DuneRayBrain(a); brains.set(a, value); } return value; };

export const DUNE_RAY: SpeciesRow = { id: 'sunscar.creature.duneRay', kind: 'duneRay', label: STRINGS.ray, aggressive: true, blood: false,
  variants: [{ id: 'dusk', label: STRINGS.ray, weight: 1, rarity: 'common', scale: [1, 1], hp: 90 }],
  think: (a, ctx) => { rayBrain(a).think(ctx); }, act: (a, ctx) => { rayBrain(a).act(ctx); } };

/** Bone order is the skin index order. */
const BONES = [
  { name: 'body', parent: null, pos: [0, 0.6, 0] }, { name: 'head', parent: 'body', pos: [0, 0.6, 1.3] },
  { name: 'wingL', parent: 'body', pos: [0.9, 0.6, 0.1] }, { name: 'tipL', parent: 'wingL', pos: [2.3, 0.6, -0.3] },
  { name: 'wingR', parent: 'body', pos: [-0.9, 0.6, 0.1] }, { name: 'tipR', parent: 'wingR', pos: [-2.3, 0.6, -0.3] },
  { name: 'tail', parent: 'body', pos: [0, 0.6, -1.4] },
] as const satisfies readonly { name: string; parent: string | null; pos: [number, number, number] }[];

const SPAN = 3.6, NS = 9, NC = 7;
/** The planform: a broad diamond with swept tips, thick at the centre, a whip tail; dark back, pale mottled belly. */
export function rayGeometry(): BufferGeometry {
  const pos: number[] = [], col: number[] = [], idx: number[] = [], skin: number[] = [], wt: number[] = [];
  const push = (x: number, y: number, z: number, top: boolean, s: number): void => {
    pos.push(x, y, z);
    const mottle = 0.85 + 0.15 * Math.sin(x * 5.1 + z * 3.7) * Math.sin(z * 4.3 - x * 1.9);
    if (top) col.push(0.11 * mottle, 0.08 * mottle, 0.065 * mottle); else col.push(0.36 * mottle, 0.27 * mottle, 0.21 * mottle);
    const side = x >= 0 ? 2 : 4, w = smooth((s - 0.2) / 0.35), tip = smooth((s - 0.6) / 0.3);
    skin.push(0, side, side + 1, 0); wt.push(1 - w, w * (1 - tip), w * tip, 0);
  };
  for (const top of [true, false]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NS * 2; i++) {
      const s = Math.abs(i - NS) / NS, x = (i - NS) / NS * SPAN;
      const lead = 1.7 - 2.1 * s ** 0.9, trail = -1.45 + 1.05 * s ** 1.2;
      for (let j = 0; j <= NC; j++) {
        const c = j / NC, z = lead + (trail - lead) * c, th = 0.3 * (1 - s) ** 1.6 * Math.sin(Math.PI * c) + 0.015;
        push(x, 0.6 + (top ? th : -th * 0.55) - s * s * 0.15, z, top, s);
      }
    }
    for (let i = 0; i < NS * 2; i++) for (let j = 0; j < NC; j++) {
      const a = base + i * (NC + 1) + j, b = a + 1, c = a + NC + 1, d = c + 1;
      if (top) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  // the tail: a thin four-sided spike
  const t0 = pos.length / 3;
  for (const [z, r] of [[-1.3, 0.09], [-4.4, 0.012]] as const) for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2; pos.push(Math.cos(a) * r, 0.6 + Math.sin(a) * r, z); col.push(0.1, 0.075, 0.06); skin.push(z < -2 ? 6 : 0, 0, 0, 0); wt.push(1, 0, 0, 0);
  }
  for (let k = 0; k < 4; k++) { const a = t0 + k, b = t0 + (k + 1) % 4; idx.push(a, b, a + 4, b, b + 4, a + 4); }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(skin), 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(wt, 4));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export const DUNE_RAY_LOOK: SpeciesLook = { id: 'sunscar.look.duneRay', species: DUNE_RAY.id, kind: 'duneRay', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'sunscar.duneRay', sockets: ['body', 'head'], clips: ['idle', 'walk', 'attack', 'hit', 'die'] },
  build: () => ({ bones: BONES.map((b) => ({ name: b.name, parent: b.parent, pos: [b.pos[0], b.pos[1], b.pos[2]] })), furParts: [], hardParts: [rayGeometry()], eyeParts: [],
    dims: { bodyY: 0.6, bodyHalfLen: 1.6, bodyRadius: 1.1, headRadius: 0.5, legLen: 0.6, feet: [], halfWidth: SPAN } }),
  animate: ({ bones, t, alive, deathT, mem, attack, flinch, animal, dt }) => {
    const fold = mem['fold'] ?? 0, wingL = bones['wingL'], wingR = bones['wingR'], tipL = bones['tipL'], tipR = bones['tipR'], tail = bones['tail'], body = bones['body'];
    // a slow glide undulation; the windup spreads and lifts the wings, the dive sweeps them back
    const beat = alive ? Math.sin(t * 1.4) * 0.22 * (1 - fold) + (attack >= 0 ? -0.35 * Math.sin(Math.PI * attack) : 0) + fold * 0.35 : 0.5 * Math.max(0, deathT);
    if (wingL) { wingL.rotation.z = beat; wingL.rotation.y = -fold * 0.45; }
    if (wingR) { wingR.rotation.z = -beat; wingR.rotation.y = fold * 0.45; }
    const tipBeat = alive ? Math.sin(t * 1.4 - 0.7) * 0.25 * (1 - fold) : 0.3;
    if (tipL) tipL.rotation.z = tipBeat; if (tipR) tipR.rotation.z = -tipBeat;
    if (tail) tail.rotation.y = Math.sin(t * 2.1) * 0.25;
    if (body) { body.rotation.x = fold * 0.35 - flinch * 0.4; body.rotation.z = Math.sin(t * 0.7) * 0.08; }
    // dead: it drops out of the sky onto the sand
    if (!alive) animal.yOffset = Math.max(0, animal.yOffset - dt * 9);
  },
};
