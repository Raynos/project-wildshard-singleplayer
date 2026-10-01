import { CreatureBrain, StrikeRunner, canReach, NO_FUR, type Animal, type SpeciesLook, type SpeciesRow, type StrikeContext, type StrikeSpec, type ThinkCtx } from '#engine';
import { Float32BufferAttribute, Uint16BufferAttribute, BufferGeometry } from 'three';
import { RAY } from '../layout';
import { STRINGS } from '../strings';

/** The dive: a telegraphed hover, then a committed 3-D pass at the player's chest that overshoots and climbs away. */
export const RAY_STRIKES: readonly StrikeSpec[] = [
  { id: 'far.ray.dive', shape: { kind: 'sphere', radius: 2.6 }, windup: 1.2, active: 2.5, recover: 1.2, cooldown: 3.5, range: 42, damage: 12,
    tags: ['creature.driftRay'], motion: { track: 'lead', speed: 19, overshoot: 7 }, weight: () => 1 },
];
export const RAY_FLIGHT = { altitude: RAY.altitude, above: 'world', climbRate: 9, diveRate: 24 } as const;
/** It engages a player within this ground distance of its home circle's edge, and only one standing well above the clouds. */
export const RAY_SENSE = { range: 30, minY: 10 } as const;

type RayState = 'circle' | 'dive' | 'rise';
export class DriftRayBrain extends CreatureBrain<RayState> {
  readonly strikes = new StrikeRunner();
  private orbit = 0; private stunned = 0; private aim = { x: 0, y: 0, z: 0 };
  constructor(actor: Animal) { super(actor, ['circle', 'dive', 'rise']); this.orbit = Math.atan2(actor.position.x - RAY.x, actor.position.z - RAY.z); }
  private context(ctx: ThinkCtx): StrikeContext { const a = this.actor;
    return { actor: a, target: ctx.player, canReach: () => canReach(a, ctx.player), hit: (strike) => { ctx.hurt(strike.damage); } }; }
  /** A gust (the war fan) breaks a dive: the ray tumbles back and climbs before it may dive again. */
  gusted(): void { if (this.strikes.busy) this.strikes.recoverNow(); this.stunned = 2.2; this.transition('rise'); }
  get diving(): boolean { return this.state === 'dive'; }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    if (ctx.calm) { this.transition('circle'); return; }
    if (this.state === 'circle' && !this.strikes.busy && this.stunned <= 0 && ctx.player.y > RAY_SENSE.minY
      && Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z) < RAY_SENSE.range) {
      this.aim = { x: ctx.player.x, y: ctx.player.y + 1, z: ctx.player.z };
      const c = this.context(ctx), pick = this.strikes.pick(RAY_STRIKES, c);
      if (pick) { this.strikes.start(pick, a, this.aim); this.transition('dive'); }
    } else if (this.state === 'dive' && (this.strikes.state === 'recover' || this.strikes.state === 'cooldown' || !this.strikes.busy)) this.transition('rise');
    else if (this.state === 'rise' && a.position.y > RAY.altitude - 3 && this.stunned <= 0) this.transition('circle');
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; this.strikes.update(ctx.dt, this.context(ctx)); this.stunned = Math.max(0, this.stunned - ctx.dt);
    if (!a.alive) return;
    if (this.state === 'dive' && this.strikes.state === 'windup') {
      // the telegraph: it stalls, turns to face the player and drops to a hover above them
      ctx.flight.steer(a, Math.atan2(ctx.player.x - a.position.x, ctx.player.z - a.position.z), 1.5, Math.max(ctx.player.y + 8, a.position.y - 4), 3);
    } else if (this.state === 'dive' && this.strikes.state === 'active') {
      ctx.flight.steer(a, this.strikes.yaw, 19, ctx.player.y + 1, 0.35);
    } else if (this.state === 'rise') {
      ctx.flight.steer(a, a.yaw, this.stunned > 0 ? 3 : 9, RAY.altitude, 0.8);
    } else {
      this.orbit += ctx.dt * 7 / RAY.radius;
      const tx = RAY.x + Math.sin(this.orbit) * RAY.radius, tz = RAY.z + Math.cos(this.orbit) * RAY.radius;
      ctx.flight.steer(a, Math.atan2(tx - a.position.x, tz - a.position.z), 7, RAY.altitude, 1.6);
    }
  }
}
const brains = new WeakMap<Animal, DriftRayBrain>();
export const rayBrain = (a: Animal): DriftRayBrain => { let value = brains.get(a); if (!value) { value = new DriftRayBrain(a); brains.set(a, value); } return value; };

export const DRIFT_RAY: SpeciesRow = { id: 'far.creature.driftRay', kind: 'driftRay', label: STRINGS.ray, aggressive: true, blood: false, flight: RAY_FLIGHT,
  variants: [{ id: 'common', label: STRINGS.ray, weight: 1, rarity: 'common', scale: [1, 1], hp: 48 }, { id: 'old', label: STRINGS.rayBig, weight: 0, rarity: 'rare', scale: [1.4, 1.4], hp: 90 }],
  think: (a, ctx) => { rayBrain(a).think(ctx); }, act: (a, ctx) => { rayBrain(a).act(ctx); } };

type P = readonly [number, number, number];
const TOP = [0.16, 0.19, 0.27] as const, EDGE = [0.3, 0.33, 0.45] as const, BELLY = [0.86, 0.82, 0.8] as const;
/** The ray's hull (bones: body, head — the engine requires both on a custom rig — wingL, wingR, tail): a flat diamond of wings on a raised back, a whip tail; wings skin to their own bones so they flap. */
export function rayGeometry(): BufferGeometry {
  const y = 0.6, pos: number[] = [], col: number[] = [], idx: number[] = [];
  const bone = { body: 0, head: 1, wingL: 2, wingR: 3, tail: 4 } as const;
  const face = (pts: readonly [P, number][], up: boolean, c: readonly [number, number, number]): void => {
    const [a, b, d] = pts; if (!a || !b || !d) return;
    const [ax, , az] = a[0], [bx, , bz] = b[0], [cx, , cz] = d[0];
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    const order = (ny > 0) === up ? [a, b, d] : [a, d, b];
    for (const [p, k] of order) { pos.push(p[0], p[1], p[2]); col.push(c[0], c[1], c[2]); idx.push(k); }
  };
  const N: [P, number] = [[0, y + 0.05, 2.1], bone.body], CT: [P, number] = [[0, y + 0.7, 0.2], bone.body], CB: [P, number] = [[0, y - 0.4, 0.2], bone.body];
  const R: [P, number] = [[0, y + 0.1, -1.5], bone.body], T: [P, number] = [[0, y + 0.05, -4.6], bone.tail];
  for (const s of [-1, 1]) {
    const w = s < 0 ? bone.wingL : bone.wingR;
    const M: [P, number] = [[s * 1.7, y + 0.18, 0.15], w], Tip: [P, number] = [[s * 3.7, y + 0.28, -0.55], w];
    const H: [P, number] = [[s * 0.45, y, 2.55], bone.head], Hb: [P, number] = [[s * 0.25, y, 1.95], bone.head], Tl: [P, number] = [[s * 0.13, y + 0.1, -1.45], bone.body];
    face([N, M, CT], true, TOP); face([CT, M, R], true, TOP); face([N, Tip, M], true, EDGE); face([M, Tip, R], true, TOP);
    face([N, M, CB], false, BELLY); face([CB, M, R], false, BELLY); face([N, Tip, M], false, BELLY); face([M, Tip, R], false, BELLY);
    face([H, Hb, N], true, TOP); face([H, Hb, N], false, BELLY);
    face([Tl, T, R], true, TOP); face([Tl, T, R], false, TOP);
  }
  const g = new BufferGeometry(), count = pos.length / 3;
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  const si = new Uint16Array(count * 4), sw = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { si[i * 4] = idx[i] ?? 0; sw[i * 4] = 1; }
  g.setAttribute('skinIndex', new Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(sw, 4));
  g.computeVertexNormals();
  return g;
}
export const DRIFT_RAY_LOOK: SpeciesLook = { id: 'far.look.driftRay', species: DRIFT_RAY.id, kind: 'driftRay', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.driftRay', sockets: ['body', 'head', 'wingL', 'wingR', 'tail'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => ({ bones: [{ name: 'body', parent: null, pos: [0, 0.6, 0] }, { name: 'head', parent: 'body', pos: [0, 0.62, 1.9] },
    { name: 'wingL', parent: 'body', pos: [-0.8, 0.65, 0.1] },
    { name: 'wingR', parent: 'body', pos: [0.8, 0.65, 0.1] }, { name: 'tail', parent: 'body', pos: [0, 0.65, -1.5] }],
    furParts: [], hardParts: [rayGeometry()], eyeParts: [],
    dims: { bodyY: 0.6, bodyHalfLen: 2, bodyRadius: 1.3, headRadius: 0.6, legLen: 0.6, feet: [], halfWidth: 3.6 } }),
  animate: ({ bones, t, alive, attack, deathT }) => {
    const flap = alive ? Math.sin(t * (attack >= 0 ? 6 : 2.2)) * (attack >= 0 ? 0.18 : 0.38) : -0.6 * Math.max(0, deathT);
    bones['wingL']?.rotation.set(0, 0, -flap); bones['wingR']?.rotation.set(0, 0, flap);
    bones['tail']?.rotation.set(Math.sin(t * 1.7) * 0.12, Math.sin(t * 1.3) * 0.25, 0);
  },
};
