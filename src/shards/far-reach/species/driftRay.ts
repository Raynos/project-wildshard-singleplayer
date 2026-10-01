import { CreatureBrain, StrikeRunner, canReach, NO_FUR, type SpeciesRow, type SpeciesLook, type Animal, type ThinkCtx, type StrikeSpec, type StrikeContext } from '#engine';
import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute } from 'three';
import { RAY } from '../layout';
import { STRINGS } from '../strings';

/** The dive: a committed lane toward where you stand, contact in 3-D (a sphere round the ray), then a glide back up. */
export const RAY_STRIKES: readonly StrikeSpec[] = [
  { id: 'far.ray.dive', shape: { kind: 'sphere', radius: 2.4 }, windup: 1.3, active: 1.6, recover: 0.9, cooldown: 6, range: 48, damage: 10,
    tags: ['creature.driftRay'], motion: { track: 'lead', speed: 17, overshoot: 7 }, eligibility: { maxDy: 30 }, weight: () => 1 },
];
/** how high above the player the ray hangs while it telegraphs, and where its dive lane runs */
export const TELEGRAPH_UP = 7, DIVE_UP = 1.1;

type RayState = 'circle' | 'dive' | 'rise';
/** Circles its roost high above Sunrest, dives at the player along a lane, then rises back out of reach. */
export class DriftRayBrain extends CreatureBrain<RayState> {
  private readonly strikes = new StrikeRunner();
  private angle = 0; private calmFor = 4; private riseFor = 0;
  constructor(actor: Animal) { super(actor, ['circle', 'dive', 'rise']); this.angle = Math.atan2(actor.position.x - RAY.x, actor.position.z - RAY.z); }
  private context(ctx: ThinkCtx): StrikeContext {
    const a = this.actor;
    return { actor: a, target: ctx.player, canReach: () => canReach(a, ctx.player), hit: (strike) => { ctx.hurt(strike.damage); } };
  }
  get phase(): string { return this.strikes.state; }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    if (this.state === 'dive' && !this.strikes.busy) { this.transition('rise'); this.riseFor = 3.5; return; }
    if (this.state !== 'circle' || ctx.calm || this.calmFor > 0) return;
    const pick = this.strikes.pick(RAY_STRIKES, this.context(ctx));
    if (pick) { this.strikes.start(pick, a, ctx.player); this.transition('dive'); }
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; this.calmFor = Math.max(0, this.calmFor - ctx.dt);
    if (this.state === 'dive') {
      const windup = this.strikes.state === 'windup', active = this.strikes.state === 'active';
      // Altitude first; the runner's lane heading (set inside update) wins over this steer's heading.
      ctx.flight.steer(a, a.yaw, 0, ctx.player.y + (windup ? TELEGRAPH_UP : active ? DIVE_UP : RAY.altitude), 3);
      this.strikes.update(ctx.dt, this.context(ctx));
      return;
    }
    this.strikes.update(ctx.dt, this.context(ctx));
    if (this.state === 'rise') {
      this.riseFor -= ctx.dt;
      const back = Math.atan2(RAY.x - a.position.x, RAY.z - a.position.z);
      ctx.flight.steer(a, back, 9, RAY.altitude, 1.6);
      if (this.riseFor <= 0) { this.transition('circle'); this.calmFor = 5; this.angle = Math.atan2(a.position.x - RAY.x, a.position.z - RAY.z); }
      return;
    }
    this.angle += ctx.dt * 0.32;
    const tx = RAY.x + Math.sin(this.angle) * RAY.radius, tz = RAY.z + Math.cos(this.angle) * RAY.radius;
    ctx.flight.steer(a, Math.atan2(tx - a.position.x, tz - a.position.z), 8.5, RAY.altitude, 1.8);
  }
}
const brains = new WeakMap<Animal, DriftRayBrain>();
export const rayBrain = (a: Animal): DriftRayBrain => { let value = brains.get(a); if (!value) { value = new DriftRayBrain(a); brains.set(a, value); } return value; };

export const DRIFT_RAY: SpeciesRow = { id: 'far.creature.driftRay', kind: 'driftRay', label: STRINGS.ray, aggressive: true, blood: false,
  flight: { altitude: RAY.altitude, above: 'world', climbRate: 7, diveRate: 16 },
  variants: [{ id: 'dusk', label: STRINGS.ray, weight: 1, rarity: 'common', scale: [1, 1], hp: 70 }],
  think: (a, ctx) => { rayBrain(a).think(ctx); }, act: (a, ctx) => { rayBrain(a).act(ctx); } };

/** Bone order: body (first, required), head (required), the two wings, the tail. */
const BONES = ['body', 'head', 'wingL', 'wingR', 'tail'] as const;
function rayGeometry(): BufferGeometry {
  const top = [0.18, 0.14, 0.24], belly = [0.62, 0.52, 0.58], edge = [0.3, 0.22, 0.32];
  const nose = [0, 0, 1.7], tipL = [-2.8, 0.05, -0.3], tipR = [2.8, 0.05, -0.3], back = [0, 0, -1.2], hump = [0, 0.38, 0.2], keel = [0, -0.22, 0.2];
  const tail = [0, 0.02, -3.6], tailL = [-0.12, 0, -1.25], tailR = [0.12, 0, -1.25];
  const pos: number[] = [], col: number[] = [], bone: number[] = [];
  const boneOf = (p: number[]): number => { const x = p[0] ?? 0, z = p[2] ?? 0; return z < -1.3 ? 4 : x < -0.7 ? 2 : x > 0.7 ? 3 : z > 1.2 ? 1 : 0; };
  const tri = (a: number[], b: number[], c: number[], color: number[]): void => {
    for (const p of [a, b, c]) { pos.push(...p); col.push(...color); bone.push(boneOf(p)); }
  };
  tri(nose, tipR, hump, top); tri(hump, tipR, back, top); tri(nose, hump, tipL, top); tri(hump, back, tipL, top);
  tri(nose, keel, tipR, belly); tri(keel, back, tipR, belly); tri(nose, tipL, keel, belly); tri(keel, tipL, back, belly);
  tri(tailL, tail, tailR, edge); tri(tailL, tailR, tail, edge);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3)); geometry.setAttribute('color', new Float32BufferAttribute(col, 3));
  const count = pos.length / 3, index = new Uint16Array(count * 4), weight = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { index[i * 4] = bone[i] ?? 0; weight[i * 4] = 1; }
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4)); geometry.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4));
  geometry.computeVertexNormals();
  return geometry;
}

export const DRIFT_RAY_LOOK: SpeciesLook = { id: 'far.look.driftRay', species: DRIFT_RAY.id, kind: 'driftRay', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.driftRay', sockets: [...BONES], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => ({
    bones: [{ name: 'body', parent: null, pos: [0, 0, 0] }, { name: 'head', parent: 'body', pos: [0, 0.05, 1.4] },
      { name: 'wingL', parent: 'body', pos: [-0.7, 0, 0] }, { name: 'wingR', parent: 'body', pos: [0.7, 0, 0] }, { name: 'tail', parent: 'body', pos: [0, 0, -1.3] }],
    furParts: [], hardParts: [rayGeometry()], eyeParts: [],
    dims: { bodyY: 0, bodyHalfLen: 1.4, bodyRadius: 0.7, headRadius: 0.35, legLen: 0, feet: [], halfWidth: 2.8 } }),
  animate: ({ bones, t, alive }) => {
    const flap = alive ? Math.sin(t * 2.1) * 0.32 : -0.6, l = bones['wingL'], r = bones['wingR'], tail = bones['tail'];
    if (l) l.rotation.z = -flap; if (r) r.rotation.z = flap; if (tail) tail.rotation.y = alive ? Math.sin(t * 1.3) * 0.25 : 0;
  },
};
