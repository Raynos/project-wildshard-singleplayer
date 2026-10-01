import { CreatureBrain, StrikeRunner, NO_FUR, type SpeciesRow, type SpeciesLook, type Animal, type ThinkCtx, type StrikeSpec, type StrikeContext } from '#engine';
import { smoothstep } from '#engine/data';
import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Vector3 } from 'three';
import { RAY_HOME } from '../layout';
import { STRINGS } from '../strings';

/** Flight tuning, metres and metres per second. */
export const RAY = { cruise: 15, notice: 70, orbit: 18, orbitSpeed: 9, diveSpeed: 15, diveAlt: 1.5, lingerAlt: 2.6, lingerTime: 3, climbAlt: 17, climbTime: 3, rest: 5 };
/** The swoop's contact: a 3-D sphere around the ray's body, landing once as it skims the player's chest. */
export const SWOOP: StrikeSpec = { id: 'sunscar.ray.swoop', shape: { kind: 'sphere', radius: 2.4 }, windup: 0.25, active: 0.5, recover: 0.6, cooldown: 1,
  range: 9, damage: 14, tags: ['creature.duneRay'], motion: { track: 'lead', speed: RAY.diveSpeed, overshoot: 6 }, weight: () => 1 };

type RayState = 'circle' | 'dive' | 'linger' | 'climb';
/** Circles high over the crests; when the player is near it dives low, skims them, hangs low a moment (the whip's window) and climbs away. */
export class DuneRayBrain extends CreatureBrain<RayState> {
  private readonly strikes = new StrikeRunner(); private readonly chest = new Vector3();
  private timer = 0; private struck = false; private orbitDir = 1;
  constructor(actor: Animal) { super(actor, ['circle', 'dive', 'linger', 'climb']); }
  private context(ctx: ThinkCtx): StrikeContext {
    const a = this.actor; this.chest.set(ctx.player.x, ctx.player.y + 1.1, ctx.player.z);
    return { actor: a, target: this.chest, airborne: true, canReach: () => ctx.reach(a), hit: (strike) => { ctx.hurt(strike.damage); } };
  }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    this.timer += ctx.dt;
    const d = Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
    if (ctx.calm) { if (this.state !== 'circle') { this.transition('circle'); this.timer = 0; } return; }
    switch (this.state) {
      case 'circle': if (d < RAY.notice && this.timer > RAY.rest) { this.transition('dive'); this.timer = 0; this.struck = false; } break;
      case 'dive':
        if (!this.struck && !this.strikes.busy && d < SWOOP.range) { this.strikes.start(SWOOP, a, this.chest.set(ctx.player.x, ctx.player.y + 1.1, ctx.player.z)); this.struck = true; }
        if ((this.struck && !this.strikes.busy) || this.timer > 6) { this.transition('linger'); this.timer = 0; }
        break;
      case 'linger': if (this.timer > RAY.lingerTime) { this.transition('climb'); this.timer = 0; this.orbitDir = -this.orbitDir; } break;
      case 'climb': if (this.timer > RAY.climbTime) { this.transition('circle'); this.timer = 0; } break;
      default: break;
    }
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    this.strikes.update(ctx.dt, this.context(ctx));
    const px = ctx.player.x, pz = ctx.player.z, toPlayer = Math.atan2(px - a.position.x, pz - a.position.z);
    const near = Math.hypot(px - a.position.x, pz - a.position.z) < RAY.notice;
    const cx = near ? px : RAY_HOME.x, cz = near ? pz : RAY_HOME.z, r = near ? RAY.orbit : RAY_HOME.radius;
    const around = Math.atan2(a.position.x - cx, a.position.z - cz), dist = Math.hypot(a.position.x - cx, a.position.z - cz);
    // Tangent to the orbit, bent inward or outward to hold the radius.
    const tangent = around + this.orbitDir * (Math.PI / 2 + Math.atan2(dist - r, r) * 0.8);
    switch (this.state) {
      case 'circle': ctx.flight.steer(a, tangent, RAY.orbitSpeed, RAY.cruise, 1.2); break;
      case 'dive': ctx.flight.steer(a, toPlayer, RAY.diveSpeed, RAY.diveAlt, 2.4); break;
      case 'linger': ctx.flight.steer(a, around + this.orbitDir * Math.PI / 2, 3.5, RAY.lingerAlt, 1.5); break;
      case 'climb': ctx.flight.steer(a, toPlayer + Math.PI, 10, RAY.climbAlt, 1.5); break;
      default: break;
    }
  }
}
const brains = new WeakMap<Animal, DuneRayBrain>();
export const rayBrain = (a: Animal): DuneRayBrain => { let value = brains.get(a); if (!value) { value = new DuneRayBrain(a); brains.set(a, value); } return value; };

export const DUNE_RAY: SpeciesRow = { id: 'sunscar.creature.duneRay', kind: 'duneRay', label: STRINGS.ray, aggressive: true, blood: false,
  flight: { altitude: RAY.cruise, above: 'ground', climbRate: 7, diveRate: 24 },
  variants: [{ id: 'adult', label: STRINGS.ray, weight: 1, rarity: 'common', scale: [1.5, 1.5], hp: 70 }],
  think: (a, ctx) => { rayBrain(a).think(ctx); }, act: (a, ctx) => { rayBrain(a).act(ctx); } };

/** Bones (absolute bind-space, +Z forward): body first, then head, the two wings and the tail. */
const BONES = { body: 0, head: 1, wingL: 2, wingR: 3, tail: 4 } as const;
type V = readonly [number, number, number];
/** A flat manta: a diamond of wings round a low ridge, a whip tail; dark on top, pale beneath. */
function rayGeometry(): BufferGeometry {
  const rim: V[] = [[0, 0, 1.55], [0.4, 0, 1.45], [1.25, 0.05, 0.6], [2.7, 0.18, -0.25], [1.5, 0, -0.6], [0.45, 0, -0.95], [0, 0, -1.05],
    [-0.45, 0, -0.95], [-1.5, 0, -0.6], [-2.7, 0.18, -0.25], [-1.25, 0.05, 0.6], [-0.4, 0, 1.45]];
  const top: V = [0, 0.28, 0.25], bottom: V = [0, -0.14, 0.25];
  const pos: number[] = [], col: number[] = [];
  const tri = (p: V, q: V, s: V, c: V): void => { for (const v of [p, q, s]) { pos.push(...v); col.push(...c); } };
  for (let i = 0; i < rim.length; i++) {
    const p = rim[i], q = rim[(i + 1) % rim.length]; if (p === undefined || q === undefined) continue;
    tri(top, q, p, [0.1, 0.065, 0.075]); tri(bottom, p, q, [0.5, 0.4, 0.38]);
  }
  const tail: V[] = [[0.07, 0.02, -1.0], [-0.07, 0.02, -1.0], [0, 0.06, -3.3]];
  const [t0, t1, t2] = tail; if (t0 && t1 && t2) { tri(t0, t1, t2, [0.08, 0.05, 0.06]); tri(t1, t0, t2, [0.08, 0.05, 0.06]); }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(col, 3));
  const count = pos.length / 3, index = new Uint16Array(count * 4), weight = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const x = pos[i * 3] ?? 0, z = pos[i * 3 + 2] ?? 0, w = smoothstep(0.45, 1.6, Math.abs(x)), tw = smoothstep(-1.0, -1.6, z);
    index[i * 4] = BONES.body; index[i * 4 + 1] = tw > 0 ? BONES.tail : x > 0 ? BONES.wingL : BONES.wingR;
    const second = tw > 0 ? tw : w; weight[i * 4] = 1 - second; weight[i * 4 + 1] = second;
  }
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4)); geometry.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4));
  geometry.computeVertexNormals();
  return geometry;
}

export const DUNE_RAY_LOOK: SpeciesLook = { id: 'sunscar.look.duneRay', species: DUNE_RAY.id, kind: 'duneRay', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'sunscar.duneRay', sockets: ['body', 'head', 'wingL', 'wingR', 'tail'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => ({
    bones: [{ name: 'body', parent: null, pos: [0, 0.1, 0] }, { name: 'head', parent: 'body', pos: [0, 0.15, 1.2] },
      { name: 'wingL', parent: 'body', pos: [0.45, 0.1, 0.2] }, { name: 'wingR', parent: 'body', pos: [-0.45, 0.1, 0.2] }, { name: 'tail', parent: 'body', pos: [0, 0.05, -1.0] }],
    furParts: [], hardParts: [rayGeometry()], eyeParts: [],
    dims: { bodyY: 0.1, bodyHalfLen: 1.3, bodyRadius: 0.9, headRadius: 0.5, legLen: 0, feet: [], halfWidth: 2.7 } }),
  animate: ({ bones, t, alive }) => {
    const flap = alive ? Math.sin(t * 2.1) * 0.32 : -0.5, l = bones['wingL'], r = bones['wingR'], tail = bones['tail'];
    if (l) l.rotation.z = flap; if (r) r.rotation.z = -flap;
    if (tail) tail.rotation.y = Math.sin(t * 1.3) * 0.25;
  },
};
