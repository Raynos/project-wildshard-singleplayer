import { CreatureBrain, StrikeRunner, NO_FUR, type SpeciesRow, type SpeciesLook, type Animal, type ThinkCtx, type StrikeSpec, type StrikeContext, type StrikeActor } from '#engine';
import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Vector3 } from 'three';
import { STRINGS } from '../strings';
import { MANTA_HOME, CLOUD_Y } from '../layout';

/**
 * The drift ray (E364 concept B): a manta that flies. It circles high over the islands, telegraphs, dives straight at
 * the player along a lane, then rises back out of reach. The public flight body owns its movement and altitude.
 */
export const MANTA = { grace: 10, cruise: MANTA_HOME.alt, circleR: 18, circleSpeed: 9, aware: 34, diveSpeed: 19, riseSpeed: 7, glide: 10, hitHeight: 1.1 } as const;
export const MANTA_STRIKES: readonly StrikeSpec[] = [
  { id: 'farReach.manta.dive', shape: { kind: 'sphere', radius: 2.6 }, windup: 1.2, active: 2.5, recover: 1.6, cooldown: 7, range: 60, damage: 10,
    tags: ['creature.skyManta', 'cover.exempt'], motion: { speed: MANTA.diveSpeed, track: 'lead', overshoot: 8 }, weight: () => 1 },
];
export type MantaState = 'circle' | 'dive' | 'rise';

/** Pure flight state, apart from the Animal so a test can fly it. */
export class MantaFlight {
  readonly pos = new Vector3(); yaw = 0; speed = 0; bank = 0; flap = 0.6; angle = 0; diveFrom = MANTA.cruise;
  readonly knock = new Vector3(); falling = false;
  constructor(x: number, z: number, y: number) { this.pos.set(x, y, z); this.angle = Math.atan2(x - MANTA_HOME.x, z - MANTA_HOME.z); }
}

export class MantaBrain extends CreatureBrain<MantaState> {
  readonly strikes = new StrikeRunner(); readonly flight: MantaFlight; private calmFor: number = MANTA.grace;
  private readonly body: StrikeActor;
  constructor(actor: Animal) {
    super(actor, ['circle', 'dive', 'rise']);
    this.flight = new MantaFlight(actor.position.x, actor.position.z, MANTA.cruise);
    const flight = this.flight;
    this.body = { position: actor.position, get alive() { return actor.alive; }, scale: actor.scale, get yaw() { return actor.yaw; },
      startAttack: (seconds) => { actor.startAttack(seconds); }, cancelAttack: () => { actor.cancelAttack(); },
      setMotion: (yaw, speed) => { flight.yaw = yaw; flight.speed = speed; } };
  }
  private context(ctx: ThinkCtx): StrikeContext {
    return { actor: this.body, target: { x: ctx.player.x, y: ctx.player.y + MANTA.hitHeight, z: ctx.player.z }, canReach: () => true, hit: (strike) => { ctx.hurt(strike.damage); } };
  }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive || ctx.calm) { if (this.state === 'dive') { this.strikes.cancel(); this.transition('rise'); } return; }
    const f = this.flight, near = Math.hypot(ctx.player.x - f.pos.x, ctx.player.z - f.pos.z) < MANTA.aware;
    this.calmFor = Math.max(0, this.calmFor - ctx.dt);
    if (this.state === 'circle' && this.calmFor === 0 && near && !this.strikes.busy && ctx.player.y > CLOUD_Y) {
      const c = this.context(ctx), pick = this.strikes.pick(MANTA_STRIKES, c);
      if (pick) { f.diveFrom = f.pos.y; this.strikes.start(pick, this.body, c.target); this.transition('dive'); }
    }
  }
  /** A GUST: a ray in its dive is thrown off the lane and climbs away. */
  push(dir: Vector3, power: number): void {
    const f = this.flight; f.knock.addScaledVector(dir, power).setY(Math.max(f.knock.y, power * 0.4));
    if (this.state === 'dive') { this.strikes.cancel(); this.actor.cancelAttack(); this.transition('rise'); }
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor, f = this.flight, dt = ctx.dt;
    f.pos.copy(a.position);
    if (!a.alive) { f.falling = true; f.flap = 0; this.pose(a); return; }
    this.strikes.update(dt, this.context(ctx));
    let altitude = f.pos.y;
    let speed: number = MANTA.circleSpeed;
    if (this.state === 'dive') {
      const phase = this.strikes.state;
      if (phase === 'windup') { altitude += 1.5 * dt; speed = 0; f.flap = 1; }
      else if (phase === 'active') {
        speed = f.speed; f.flap = 0.1;
        altitude = ctx.player.y + MANTA.hitHeight;
      } else { this.transition('rise'); }
    } else if (this.state === 'rise') {
      f.flap = 0.9; altitude = MANTA.cruise; speed = MANTA.glide;
      const toHome = Math.atan2(MANTA_HOME.x - f.pos.x, MANTA_HOME.z - f.pos.z); f.yaw = turn(f.yaw, toHome, 1.2 * dt);
      if (f.pos.y >= MANTA.cruise - 0.5) { f.angle = Math.atan2(f.pos.x - MANTA_HOME.x, f.pos.z - MANTA_HOME.z); this.transition('circle'); }
    } else {
      f.flap = 0.4; f.angle += MANTA.circleSpeed / MANTA.circleR * dt;
      const tx = MANTA_HOME.x + Math.sin(f.angle) * MANTA.circleR, tz = MANTA_HOME.z + Math.cos(f.angle) * MANTA.circleR, ty = MANTA.cruise + Math.sin(ctx.t * 0.4) * 1.5;
      const want = Math.atan2(tx - f.pos.x, tz - f.pos.z); f.yaw = turn(f.yaw, want, 1.5 * dt);
      altitude = ty;
    }
    if (f.knock.lengthSq() > 1e-4) {
      const vx = Math.sin(f.yaw) * speed + f.knock.x, vz = Math.cos(f.yaw) * speed + f.knock.z;
      f.yaw = Math.atan2(vx, vz); speed = Math.hypot(vx, vz); altitude += f.knock.y * dt;
      f.knock.multiplyScalar(Math.max(0, 1 - dt * 3));
    }
    ctx.flight.steer(a, f.yaw, speed, altitude, 20);
    f.bank += ((this.state === 'circle' ? -0.35 : 0) - f.bank) * Math.min(1, dt * 3);
    this.pose(a);
  }
  private pose(a: Animal): void { const f = this.flight; a.mem['flap'] = f.flap; a.mem['bank'] = f.bank; }
}
function turn(from: number, to: number, max: number): number {
  let d = to - from; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  return from + Math.max(-max, Math.min(max, d));
}

const brains = new WeakMap<Animal, MantaBrain>();
export const mantaBrain = (a: Animal): MantaBrain => { let value = brains.get(a); if (!value) { value = new MantaBrain(a); brains.set(a, value); } return value; };
export const SKY_MANTA: SpeciesRow = { id: 'farReach.creature.skyManta', kind: 'skyManta', label: STRINGS.manta, aggressive: true, blood: false,
  flight: { altitude: MANTA.cruise, above: 'world', climbRate: MANTA.riseSpeed, diveRate: 40 },
  variants: [{ id: 'drift', label: STRINGS.manta, weight: 1, rarity: 'common', scale: [1, 1], hp: 70 }],
  think: (a, ctx) => { mantaBrain(a).think(ctx); }, act: (a, ctx) => { mantaBrain(a).act(ctx); } };

/** Bones: body (root) · head · wingL · wingR · tail. The wings and tail are skinned to their bones. */
const BONES = ['body', 'head', 'wingL', 'wingR', 'tail'] as const;
const TOP = [0.55, 0.62, 0.72], BELLY = [0.93, 0.92, 0.88], TIP = [0.3, 0.36, 0.48], GLOW = [0.45, 0.95, 1];
export function mantaGeometry(): BufferGeometry {
  const pos: number[] = [], col: number[] = [], skin: number[] = [], weight: number[] = [], index: number[] = [];
  const span = 16, chord = 5, half = 2.1;
  const add = (x: number, y: number, z: number, c: readonly number[], bone: number, w: number): number => {
    pos.push(x, y, z); col.push(c[0] ?? 1, c[1] ?? 1, c[2] ?? 1); skin.push(0, bone, 0, 0); weight.push(1 - w, w, 0, 0); return pos.length / 3 - 1;
  };
  for (const side of [1, -1]) {
    const rows: number[][] = [];
    for (let i = 0; i <= span; i++) {
      const u = i / span, x = side * u * half, front = 0.95 - u ** 1.15, back = -0.7 + 0.62 * u, thick = 0.2 * (1 - u) ** 1.4 + 0.012;
      const bone = side > 0 ? 2 : 3, w = Math.min(1, Math.max(0, (u - 0.18) / 0.4)), row: number[] = [];
      for (let j = 0; j <= chord; j++) {
        const v = j / chord, z = back + (front - back) * v, bulge = Math.sin(v * Math.PI);
        const tint = TOP.map((t, k) => t + ((TIP[k] ?? 0) - t) * u * u);
        row.push(add(x, thick * bulge, z, tint, bone, w), add(x, -thick * bulge * 0.7, z, BELLY, bone, w));
      }
      rows.push(row);
    }
    for (let i = 0; i < span; i++) for (let j = 0; j < chord; j++) {
      const r0 = rows[i] ?? [], r1 = rows[i + 1] ?? [];
      for (const s of [0, 1]) {
        const a = r0[j * 2 + s] ?? 0, b = r1[j * 2 + s] ?? 0, c = r1[(j + 1) * 2 + s] ?? 0, d = r0[(j + 1) * 2 + s] ?? 0;
        const flip = (side > 0) !== (s === 1);
        if (flip) index.push(a, b, c, a, c, d); else index.push(a, c, b, a, d, c);
      }
    }
  }
  // the tail: a thin glowing whip behind the body
  const t0 = add(0.05, 0, -0.65, TOP, 4, 1), t1 = add(-0.05, 0, -0.65, TOP, 4, 1), t2 = add(0, 0.05, -0.65, TOP, 4, 1), tip = add(0, 0, -2.8, GLOW, 4, 1);
  index.push(t0, t2, tip, t2, t1, tip, t1, t0, tip);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3)); geometry.setAttribute('color', new Float32BufferAttribute(col, 3));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(skin), 4)); geometry.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4));
  geometry.setIndex(index); geometry.computeVertexNormals();
  return geometry;
}
export const SKY_MANTA_LOOK: SpeciesLook = { id: 'farReach.look.skyManta', species: SKY_MANTA.id, kind: 'skyManta', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'farReach.skyManta', sockets: ['body', 'head'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => ({ bones: [{ name: BONES[0], parent: null, pos: [0, 0, 0] }, { name: BONES[1], parent: 'body', pos: [0, 0, 0.7] },
    { name: BONES[2], parent: 'body', pos: [0.35, 0, 0] }, { name: BONES[3], parent: 'body', pos: [-0.35, 0, 0] }, { name: BONES[4], parent: 'body', pos: [0, 0, -0.65] }],
  furParts: [], hardParts: [mantaGeometry()], eyeParts: [],
  dims: { bodyY: 0, bodyHalfLen: 0.8, bodyRadius: 0.7, headRadius: 0.35, legLen: 0, feet: [], halfWidth: 2.1 } }),
  animate: ({ bones, t, alive, mem }) => {
    const flap = mem['flap'] ?? 0.5, beat = Math.sin(t * (alive ? 3.2 : 0.8)) * (0.12 + 0.5 * flap);
    const left = bones['wingL'], right = bones['wingR'], tail = bones['tail'], body = bones['body'];
    if (left) left.rotation.z = beat; if (right) right.rotation.z = -beat;
    if (tail) tail.rotation.y = Math.sin(t * 2.1) * 0.25;
    if (body) body.rotation.z = mem['bank'] ?? 0;
  },
};
