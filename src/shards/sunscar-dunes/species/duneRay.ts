import { CreatureBrain, StrikeRunner, NO_FUR, type SpeciesRow, type SpeciesLook, type Animal, type ThinkCtx, type StrikeSpec, type StrikeContext } from '#engine';
import { CylinderGeometry, Float32BufferAttribute, SphereGeometry, Uint16BufferAttribute, Vector3, type BufferGeometry } from 'three';
import { STRINGS } from '../strings';
import { RAY_HOME } from '../layout';

/** The flight block and the brain's numbers (metres, seconds, metres per second). */
export const RAY_FLIGHT = { altitude: 13, above: 'ground' as const, climbRate: 6, diveRate: 12 };
export const RAY = { orbit: 24, cruise: 8, cruiseAlt: 13, rearAlt: 17, rearTime: 0.9, swoopSpeed: 15, swoopAlt: 1.4, swoopMax: 5, climbAlt: 17, climbTime: 2.6,
  notice: 42, rest: 6, leash: 70, chest: 1.2 };
/** One strike: a body-sized sphere that lands once as the ray sweeps through the player's chest. */
export const RAY_STRIKES: readonly StrikeSpec[] = [
  { id: 'sunscar.ray.swoop', shape: { kind: 'sphere', radius: 2.1 }, windup: 0.35, active: 0.8, recover: 0.6, cooldown: 4, range: 11, damage: 14,
    tags: ['creature.duneRay'], weight: () => 1 },
];
type RayState = 'circle' | 'rear' | 'swoop' | 'climb';

/** Circles the crests; when the player walks near it rears up, dives through them, then climbs away to circle again. */
export class DuneRayBrain extends CreatureBrain<RayState> {
  private readonly strikes = new StrikeRunner();
  private readonly chest = new Vector3();
  private timer = 0; private rested = RAY.rest; private lastHp = -1;
  constructor(actor: Animal) { super(actor, ['circle', 'rear', 'swoop', 'climb']); }
  private context(ctx: ThinkCtx): StrikeContext {
    this.chest.set(ctx.player.x, ctx.player.y + RAY.chest, ctx.player.z);
    return { actor: this.actor, target: this.chest, airborne: true, canReach: () => true, hit: (strike) => { ctx.hurt(strike.damage); } };
  }
  private enter(state: RayState): void { if (this.state !== state) { this.transition(state); this.timer = 0; } }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    if (this.lastHp >= 0 && a.hp < this.lastHp && this.state !== 'climb') { this.strikes.cancel(); this.enter('climb'); }
    this.lastHp = a.hp;
    const d = Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
    if (this.state === 'circle' && !ctx.calm && d < RAY.notice && this.rested <= 0) this.enter('rear');
    else if (this.state === 'rear' && this.timer > RAY.rearTime) this.enter('swoop');
    else if (this.state === 'swoop') {
      if (!this.strikes.busy) { const c = this.context(ctx), pick = this.strikes.pick(RAY_STRIKES, c); if (pick) this.strikes.start(pick, a, c.target); }
      if (this.timer > RAY.swoopMax || this.strikes.state === 'recover') this.enter('climb');
    } else if (this.state === 'climb' && this.timer > RAY.climbTime) { this.enter('circle'); this.rested = RAY.rest; }
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; this.timer += ctx.dt; this.rested -= ctx.dt;
    this.strikes.update(ctx.dt, this.context(ctx));
    if (!a.alive) return;
    const toPlayer = Math.atan2(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
    if (this.state === 'rear') ctx.flight.steer(a, toPlayer, 3, RAY.rearAlt, 2);
    else if (this.state === 'swoop') ctx.flight.steer(a, toPlayer, RAY.swoopSpeed, RAY.swoopAlt, 2.4);
    else if (this.state === 'climb') ctx.flight.steer(a, a.yaw, 11, RAY.climbAlt, 0.6);
    else {
      // Orbit the player when near, else home: steer along the circle's tangent, pulled back onto its radius.
      const near = Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z) < RAY.leash;
      const cx = near ? ctx.player.x : RAY_HOME.x, cz = near ? ctx.player.z : RAY_HOME.z;
      const out = Math.atan2(a.position.x - cx, a.position.z - cz), r = Math.hypot(a.position.x - cx, a.position.z - cz);
      ctx.flight.steer(a, out + Math.PI / 2 + Math.max(-0.6, Math.min(0.6, (r - RAY.orbit) / RAY.orbit)), RAY.cruise, RAY.cruiseAlt, 1.2);
    }
  }
}
const brains = new WeakMap<Animal, DuneRayBrain>();
export const rayBrain = (a: Animal): DuneRayBrain => { let value = brains.get(a); if (!value) { value = new DuneRayBrain(a); brains.set(a, value); } return value; };
export const DUNE_RAY: SpeciesRow = { id: 'sunscar.creature.duneRay', kind: 'duneRay', label: STRINGS.ray, aggressive: true, blood: false, flight: RAY_FLIGHT,
  variants: [{ id: 'dusk', label: STRINGS.ray, weight: 1, rarity: 'common', scale: [1, 1], hp: 70 }],
  think: (a, ctx) => { rayBrain(a).think(ctx); }, act: (a, ctx) => { rayBrain(a).act(ctx); } };

const BODY_Y = 0.4, SPAN = 3.2;
/** Bones: 0 body, 1 head (the engine needs `body` and `head` on a custom rig), 2 left wing, 3 right wing, 4 tail. Wing weight ramps in from the body's edge. */
function skin(geometry: BufferGeometry, tail: boolean): BufferGeometry {
  const pos = geometry.getAttribute('position'), count = pos.count, colors: number[] = [], index = new Uint16Array(count * 4), weight = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i), y = pos.getY(i), top = y > BODY_Y;
    const shade = tail ? 0.05 : top ? 0.07 + 0.03 * Math.abs(x) / SPAN : 0.16;
    colors.push(shade * 1.2, shade * 0.95, shade);
    const w = tail ? 1 : Math.min(1, Math.max(0, (Math.abs(x) - 0.35) / 0.6));
    index[i * 4] = tail ? 4 : x > 0 ? 2 : 3; index[i * 4 + 1] = 0; weight[i * 4] = w; weight[i * 4 + 1] = 1 - w;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4));
  return geometry;
}
/** A manta silhouette from one sphere: wide, thin at the wing tips, swept back, a pointed snout. */
export function rayBody(): BufferGeometry {
  const body = new SphereGeometry(1, 28, 10), pos = body.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ax = Math.abs(x);
    pos.setXYZ(i, x * SPAN, BODY_Y + y * 0.3 * (1 - 0.8 * ax), z * (1.1 - 0.7 * ax) + ax * ax * 0.9 - (z < 0 ? 0.25 * (1 - ax) : 0));
  }
  body.rotateY(Math.PI); body.computeVertexNormals();   // the snout to +Z, the animal's forward
  return skin(body, false);
}
export function rayTail(): BufferGeometry {
  const tail = new CylinderGeometry(0.012, 0.06, 2.2, 5); tail.rotateX(-Math.PI / 2); tail.translate(0, BODY_Y, -2.0);
  return skin(tail, true);
}
export const DUNE_RAY_LOOK: SpeciesLook = { id: 'sunscar.look.duneRay', species: DUNE_RAY.id, kind: 'duneRay', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'sunscar.duneRay', sockets: ['body', 'head', 'wingL', 'wingR', 'tail'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => ({ bones: [{ name: 'body', parent: null, pos: [0, BODY_Y, 0] }, { name: 'head', parent: 'body', pos: [0, BODY_Y, 1.0] }, { name: 'wingL', parent: 'body', pos: [0.5, BODY_Y, 0] },
    { name: 'wingR', parent: 'body', pos: [-0.5, BODY_Y, 0] }, { name: 'tail', parent: 'body', pos: [0, BODY_Y, -0.9] }],
    furParts: [], hardParts: [rayBody(), rayTail()], eyeParts: [],
    dims: { bodyY: BODY_Y, bodyHalfLen: 1.1, bodyRadius: 1.1, headRadius: 0.5, legLen: 0.6, feet: [], halfWidth: SPAN } }),
  animate: ({ bones, t, alive, attack, speed }) => {
    const wingL = bones['wingL'], wingR = bones['wingR'], tail = bones['tail'], body = bones['body'];
    // Glide with slow beats; sweep the wings back while diving (attack), droop them when dead.
    const beat = alive ? (attack >= 0 ? 0.15 * Math.sin(t * 9) - 0.25 : 0.32 * Math.sin(t * (1.6 + speed * 0.12))) : -0.6;
    if (wingL) wingL.rotation.z = beat; if (wingR) wingR.rotation.z = -beat;
    if (tail) tail.rotation.y = 0.25 * Math.sin(t * 1.3);
    if (body) body.rotation.x = alive ? (attack >= 0 ? 0.25 : -0.05 * Math.sin(t * 0.8)) : 0;
  },
};
