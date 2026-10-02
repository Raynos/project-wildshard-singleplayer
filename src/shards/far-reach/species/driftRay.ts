import { CreatureBrain, StrikeRunner, NO_FUR, type Animal, type SpeciesLook, type SpeciesRow, type StrikeContext, type StrikeSpec, type ThinkCtx } from '#engine';
import { Color, Float32BufferAttribute, BufferGeometry, Uint16BufferAttribute, Vector3 } from 'three';
import { DECK, RAY_HOMES } from '../layout';
import { STRINGS } from '../strings';

/** The dive: a 3-D sphere contact around the ray, tested against the player's chest (ENGINE §19 "Short flyer"). */
export const DIVE: StrikeSpec = { id: 'far.ray.dive', shape: { kind: 'sphere', radius: 1.9 }, windup: 1.1, active: 1.1, recover: 0.6, cooldown: 5,
  range: 14, damage: 10, tags: ['creature.driftRay'], units: 'world', weight: () => 1 };
/** How the ray flies: its circle speed, how high it hangs over the player before the dive, its dive speed, its rest after one. */
export const RAY = { circleSpeed: 8, hang: 9, stalkSpeed: 10, diveSpeed: 16, rest: 6, notice: 40, giveUp: 60 } as const;
type RayState = 'circle' | 'stalk' | 'dive' | 'rise';

export class DriftRayBrain extends CreatureBrain<RayState> {
  private readonly strikes = new StrikeRunner();
  private readonly home: { x: number; z: number; r: number; y: number };
  private angle = 0; private rest = 3; private timer = 0; private diving = 0;
  private readonly chest = new Vector3();
  constructor(actor: Animal, home: { x: number; z: number; r: number; y: number }) {
    super(actor, ['circle', 'stalk', 'dive', 'rise']); this.home = home; this.angle = Math.atan2(actor.position.z - home.z, actor.position.x - home.x);
  }
  private strike(ctx: ThinkCtx): StrikeContext {
    const a = this.actor; this.chest.copy(ctx.player); this.chest.y += 1.2;
    return { actor: a, target: this.chest, canReach: () => ctx.reach(a), hit: (spec) => { ctx.hurt(spec.damage); } };
  }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    if (ctx.calm) { if (this.state !== 'circle') { this.strikes.cancel(); a.cancelAttack(); this.transition('circle'); } return; }
    this.rest -= ctx.dt; this.timer += ctx.dt;
    const d = Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
    if (this.state === 'circle' && this.rest <= 0 && d < RAY.notice && ctx.mayAttack(a)) { this.timer = 0; this.transition('stalk'); }
    else if (this.state === 'stalk' && (d > RAY.giveUp || this.timer > 12)) this.transition('rise');
    else if (this.state === 'rise' && a.position.y > this.home.y - 2) this.transition('circle');
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    const p = ctx.player, dx = p.x - a.position.x, dz = p.z - a.position.z, d = Math.hypot(dx, dz), toPlayer = Math.atan2(dx, dz);
    const strike = this.strike(ctx);
    if (this.state === 'circle') {
      this.angle += (ctx.dt * RAY.circleSpeed) / this.home.r;
      const tx = this.home.x + Math.cos(this.angle) * this.home.r, tz = this.home.z + Math.sin(this.angle) * this.home.r;
      ctx.flight.steer(a, Math.atan2(tx - a.position.x, tz - a.position.z), RAY.circleSpeed, this.home.y, 1.6);
    } else if (this.state === 'stalk') {
      const over = p.y + RAY.hang;
      ctx.flight.steer(a, toPlayer, Math.min(RAY.stalkSpeed, d * 1.5), over, 3);
      if (d < 3 && Math.abs(a.position.y - over) < 1.6 && !this.strikes.busy && ctx.reach(a) && ctx.claim(a)) {
        this.strikes.start(DIVE, a, this.chest); this.diving = 0; this.transition('dive');
      }
    } else if (this.state === 'dive') {
      this.diving += ctx.dt;
      // The windup is the telegraph: the ray hangs still over the player, then drops onto the chest.
      if (this.diving < DIVE.windup) ctx.flight.steer(a, toPlayer, 0, p.y + RAY.hang, 3);
      else ctx.flight.steer(a, toPlayer, RAY.diveSpeed, this.chest.y, 4);
      this.strikes.update(ctx.dt, strike);
      if (!this.strikes.busy) { this.rest = RAY.rest; this.transition('rise'); }
    } else {
      ctx.flight.steer(a, toPlayer + Math.PI, RAY.circleSpeed, this.home.y, 2);
    }
  }
}
const brains = new WeakMap<Animal, DriftRayBrain>();
const brain = (a: Animal): DriftRayBrain => {
  let value = brains.get(a);
  if (!value) {
    const home = RAY_HOMES.reduce((best, h) => Math.hypot(h.x - a.position.x, h.z - a.position.z) < Math.hypot(best.x - a.position.x, best.z - a.position.z) ? h : best, RAY_HOMES[0]);
    value = new DriftRayBrain(a, home); brains.set(a, value);
  }
  return value;
};
export const DRIFT_RAY: SpeciesRow = { id: 'far.creature.driftRay', kind: 'driftRay', label: STRINGS.ray, aggressive: true, blood: false,
  flight: { altitude: DECK + 14, above: 'world', climbRate: 6, diveRate: 20 },
  variants: [{ id: 'dusk', label: STRINGS.ray, weight: 1, rarity: 'common', scale: [1, 1], hp: 50 }],
  think: (a, ctx) => { brain(a).think(ctx); }, act: (a, ctx) => { brain(a).act(ctx); } };

/** Bone indices in build().bones order. */
const BODY = 0, HEAD = 1, WING_L = 2, WING_R = 3, TAIL = 4;
/** A flat manta: an eight-point outline lofted to a ridge on top and a pale belly, a whip tail. Faces +Z. */
export function rayGeometry(): BufferGeometry {
  const y = 0.3, v = (x: number, yy: number, z: number, bone: number): [Vector3, number] => [new Vector3(x, yy, z), bone];
  const outline = [v(0, y, 1.8, HEAD), v(1.3, y + 0.08, 0.9, BODY), v(2.7, y + 0.06, -0.4, WING_L), v(1, y + 0.03, -0.9, BODY),
    v(0, y, -1.2, BODY), v(-1, y + 0.03, -0.9, BODY), v(-2.7, y + 0.06, -0.4, WING_R), v(-1.3, y + 0.08, 0.9, BODY)];
  const top = v(0, y + 0.42, 0.2, BODY), belly = v(0, y - 0.2, 0.2, BODY);
  const pos: number[] = [], col: number[] = [], bones: number[] = [], c = new Color();
  const face = (corners: [Vector3, number][], color: number, up: boolean): void => {
    const [a, b, d] = corners; if (!a || !b || !d) return;
    const n = b[0].clone().sub(a[0]).cross(d[0].clone().sub(a[0]));
    const ordered = (n.y > 0) === up ? [a, b, d] : [a, d, b]; c.setHex(color);
    for (const [p, bone] of ordered) { pos.push(p.x, p.y, p.z); col.push(c.r, c.g, c.b); bones.push(bone); }
  };
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length]; if (!a || !b) continue;
    face([a, b, top], i % 2 ? 0x3b3550 : 0x463e5e, true); face([a, b, belly], 0xf0e2dc, false);
  }
  const tailRoot = outline[4]?.[0] ?? new Vector3(), tip = v(0, y, -3.4, TAIL);
  face([v(0.1, y, tailRoot.z, BODY), v(-0.1, y, tailRoot.z, BODY), tip], 0x2e2940, true);
  face([v(0.1, y, tailRoot.z, BODY), v(-0.1, y, tailRoot.z, BODY), tip], 0x2e2940, false);
  const g = new BufferGeometry(), count = pos.length / 3;
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  const index = new Uint16Array(count * 4), weight = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { index[i * 4] = bones[i] ?? BODY; weight[i * 4] = 1; }
  g.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4));
  g.computeVertexNormals(); return g;
}
export const DRIFT_RAY_LOOK: SpeciesLook = { id: 'far.look.driftRay', species: DRIFT_RAY.id, kind: 'driftRay', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.driftRay', sockets: ['body', 'head', 'wingL', 'wingR', 'tail'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => ({
    bones: [{ name: 'body', parent: null, pos: [0, 0.3, 0] }, { name: 'head', parent: 'body', pos: [0, 0.3, 1.5] },
      { name: 'wingL', parent: 'body', pos: [1, 0.3, 0] }, { name: 'wingR', parent: 'body', pos: [-1, 0.3, 0] }, { name: 'tail', parent: 'body', pos: [0, 0.3, -1.2] }],
    furParts: [], hardParts: [rayGeometry()], eyeParts: [],
    dims: { bodyY: 0.3, bodyHalfLen: 1.4, bodyRadius: 0.9, headRadius: 0.4, legLen: 0.1, feet: [], halfWidth: 2.7 } }),
  animate: ({ bones, t, alive }) => {
    const flap = alive ? Math.sin(t * 2.3) * 0.38 : 0.6;
    const left = bones['wingL'], right = bones['wingR'], tail = bones['tail'];
    if (left) left.rotation.z = flap; if (right) right.rotation.z = -flap; if (tail) tail.rotation.y = alive ? Math.sin(t * 1.4) * 0.25 : 0;
  },
};
