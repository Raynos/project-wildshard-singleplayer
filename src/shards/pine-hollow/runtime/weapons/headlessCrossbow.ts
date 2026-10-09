import * as v from 'valibot';
import { Vector3 } from 'three';
import type { SimHost } from '@wildshard/engine/sim';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { DamageRequest } from '@wildshard/engine/combat/pipeline';
import { castSegment, sticksIn, sweepBall, type Hit } from '@wildshard/engine/physics/query';
import { CROSSBOW_PROFILE } from '../../weapons/crossbow/profiles';

/** The crossbow's fixed-step id; its continuation is the bow's state and every bolt in flight. */
export const CROSSBOW_STEP = 'pine.crossbow';
/** The page Player's eye over its feet (player/Player.ts EYE): the aim line starts there. */
const EYE = 1.68;
/** Crossbow.ts: the bolt starts this far down the aim line, flies in four substeps a tick, dies past the chunk or after 12 s. */
const MUZZLE = 0.35, SUBSTEPS = 4, MAX_AGE = 12, BOUND = 250 + 60, FLOOR = -150;
/** Crossbow.ts's glance off a hard surface: lift off it, keep a little of the speed, a small bounce, a speed cap. */
const GLANCE_LIFT = 0.02, GLANCE_KEEP = 0.25, GLANCE_BOUNCE = 0.15, GLANCE_MAX = 6;

/** One bolt slot (Crossbow.ts's pool of `maxFlying`): in flight while `active`. */
interface Bolt { active: boolean; pos: Vector3; vel: Vector3; age: number; glanced: boolean }
/** A body's hit along a segment: the body, head or not, the distance along the segment, the point (the result is reused). */
interface BodyHit { body: AnimalSim | null; head: boolean; distance: number; point: Vector3 }
/** The most bodies a bolt is tested against (the roster's live cap). */
const MAX_BODIES = 512;
/** The capsule march's step (m) and its most steps (a bolt's substep is ~0.26 m; a test segment is never longer than 2 m). */
const MARCH = 0.02, MARCH_MAX = 100;
/** The most shots a tick reads (the tick's command allowance). */
const MAX_FLYING = 8, MAX_SHOTS = 1024, NO_SHOTS: readonly string[] = [];

/** Crossbow.ts's `boltFlightStep` (one law): gravity, then speed-squared drag, then the move. */
export function boltStep(pos: Vector3, vel: Vector3, h: number): void {
  vel.y -= CROSSBOW_PROFILE.gravity * h;
  vel.multiplyScalar(1 - CROSSBOW_PROFILE.drag * h * vel.length() * 0.1);
  pos.addScaledVector(vel, h);
}

const _ab = new Vector3(), _ap = new Vector3(), _c = new Vector3(), _a = new Vector3(), _b = new Vector3();
/** The distance along the unit ray (origin, dir) to a sphere, within `max`, or Infinity. */
function raySphere(origin: Vector3, dir: Vector3, centre: Vector3, r: number, max: number): number {
  _ap.subVectors(origin, centre);
  const b = _ap.dot(dir), c = _ap.lengthSq() - r * r;
  if (c <= 0) return 0;
  const disc = b * b - c;
  if (b > 0 || disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t <= max ? t : Infinity;
}
/** The distance along the unit ray to a capsule (segment a–b, radius r), within `max`, or Infinity (marched in 2 cm steps:
 *  the bolt's own substep is ~0.26 m, so the hit lands within a centimetre of the analytic one). */
function rayCapsule(origin: Vector3, dir: Vector3, a: Vector3, b: Vector3, r: number, max: number): number {
  _ab.subVectors(b, a);
  const len2 = Math.max(1e-9, _ab.lengthSq());
  for (let i = 0; i <= MARCH_MAX; i++) {
    const t = i * MARCH;
    if (t > max) break;
    _c.copy(origin).addScaledVector(dir, t);
    const u = Math.min(1, Math.max(0, _ap.subVectors(_c, a).dot(_ab) / len2));
    if (_ap.copy(a).addScaledVector(_ab, u).distanceToSquared(_c) <= r * r) return t;
  }
  return Infinity;
}

/**
 * The page's bolt against the creatures' hitboxes (physics/creatures.ts CreatureBodies: a head ball and a body capsule per
 * live, unhidden body: the Ghost Stag's fade and a parked King take no bolt), from the host body's own head and body
 * capsule (AnimalSim.headWorld / bodyCapsule): the nearest along the ray.
 */
const hitResult: BodyHit = { body: null, head: false, distance: 0, point: new Vector3() };
export function boltBodyHit(bodies: readonly AnimalSim[], origin: Vector3, dir: Vector3, max: number): BodyHit | null {
  let found = false, bestT = max;
  for (let i = 0; i < MAX_BODIES; i++) {
    const body = bodies[i];
    if (body === undefined) break;
    if (!body.alive || ('hidden' in body && body.hidden === true)) continue;
    const s = body.scale, d = body.dims;
    // a cheap reject: the segment never comes within reach of the body
    if (body.position.distanceTo(origin) > max + (d.bodyHalfLen + d.bodyRadius + d.headRadius) * s + d.bodyY * s + 2) continue;
    const th = raySphere(origin, dir, body.headWorld(_a), d.headRadius * s, bestT);
    body.bodyCapsule(_a, _b);
    const tb = rayCapsule(origin, dir, _a, _b, d.bodyRadius * s, Math.min(bestT, th));
    const t = Math.min(th, tb);
    if (t < bestT) { bestT = t; found = true; hitResult.body = body; hitResult.head = th <= tb; hitResult.distance = t; hitResult.point.copy(origin).addScaledVector(dir, t); }
  }
  return found ? hitResult : null;
}

const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ loaded: v.boolean(), quiver: finite, reloading: v.boolean(), reloadT: finite, cooldown: finite, sinceFire: finite,
  bolts: v.pipe(v.array(v.strictObject({ active: v.boolean(), pos: v.tuple([finite, finite, finite]), vel: v.tuple([finite, finite, finite]), age: finite, glanced: v.boolean() })),
    v.length(CROSSBOW_PROFILE.maxFlying)) });

/** What the crossbow is lent: the tick's shots (the body each is aimed at), the boss intro's weapon lock and the bodies a bolt can hit. */
export interface PineCrossbowPorts {
  readonly shots: () => readonly string[];
  readonly locked: () => boolean;
  readonly bodies: () => readonly AnimalSim[];
}

/**
 * PINE HOLLOW'S CROSSBOW in a renderer-free host (SF72): a real projectile item, as the page's Crossbow
 * (runtime/weapons/crossbow/Crossbow.ts) flies it. A player command's `attack` pulls the trigger aimed at that body's chest
 * (the page aims along the camera; the tape aims at a body): fired when loaded and off its 0.3 s cooldown, else a dry pull
 * starts the reload; a spent bow reloads itself 1.4 s after the shot (1.35 s); a 30-bolt quiver. The bolt leaves 0.35 m down
 * the aim line from the eye at 62 m/s with the page's hip spread (0.75°, from the host's gameplay stream: four draws as
 * the page's gameplayRandom) and flies the page's law (`boltStep`: gravity, drag) in four substeps a tick, each tested
 * against the world (a 3 cm ball swept through it, edges passed) and the creatures' hitboxes short of the wall: a body
 * takes the damage model's blow (`damageFor`: head ×2.5, range falloff) through the host's combat pipeline (its rules: the
 * King's bark and ribcage, a boss's shield, the elites' own); wood and ground keep the bolt, stone glances it. The
 * intro of a boss locks it (BossPorts.lockInput). Stuck bolts are the page's view alone.
 */
export function installPineCrossbow(host: SimHost, ports: PineCrossbowPorts): { readonly state: { loaded: boolean; quiver: number; reloading: boolean }; readonly flying: () => number } {
  const p = CROSSBOW_PROFILE, random = (): number => host.rng.stream('gameplay').next(), player = host.player;
  if (p.maxFlying !== MAX_FLYING) throw new Error('Pine crossbow profile changed its bolt pool');
  const state = { loaded: true, quiver: p.quiver, reloading: false, reloadT: 0, cooldown: 0, sinceFire: 99 };
  const bolts: Bolt[] = Array.from({ length: p.maxFlying }, () => ({ active: false, pos: new Vector3(), vel: new Vector3(), age: 0, glanced: false }));
  const reload = (): void => { if (!state.reloading && !state.loaded && state.quiver > 0) { state.reloading = true; state.reloadT = 0; } };
  const eye = new Vector3(), fwd = new Vector3(), side = new Vector3(), dir = new Vector3(), prev = new Vector3(), seg = new Vector3(), n = new Vector3();
  const fire = (target: AnimalSim): void => {
    state.loaded = false; state.quiver = Math.max(0, state.quiver - 1); state.cooldown = p.cooldown; state.sinceFire = 0;
    eye.set(player.position.x, player.position.y + EYE, player.position.z);
    target.bodyCapsule(_a, _b);
    fwd.addVectors(_a, _b).multiplyScalar(0.5).sub(eye).normalize();
    // the page's hip spread: a random axis across the line, a random fraction of 0.75°
    const spread = (0.15 + 0.6) * Math.PI / 180;
    side.set((random() - 0.5) * 2, (random() - 0.5) * 2, (random() - 0.5) * 2).cross(fwd).normalize();
    dir.copy(fwd).addScaledVector(side, Math.tan(spread * random())).normalize();
    // a free slot, else the oldest bolt's (Crossbow.ts spawnBolt)
    let b: Bolt | undefined;
    for (let i = 0; i < MAX_FLYING; i++) {
      const x = bolts[i];
      if (x === undefined) break;
      if (!x.active) { b = x; break; }
      if (b === undefined || x.age > b.age) b = x;
    }
    if (b === undefined) return;
    b.active = true; b.age = 0; b.glanced = false;
    b.pos.copy(eye).addScaledVector(fwd, MUZZLE); b.vel.copy(dir).multiplyScalar(p.speed);
  };
  /** worldHit: the ball swept from a to b through the world, passing the ground's edge strips */
  const worldHit = (a: Vector3, b: Vector3): Hit | null => {
    let from: { x: number; y: number; z: number } = a, skip: Hit['collider'] | undefined, travelled = 0;
    for (let pass = 0; pass < 4; pass++) {
      const hit = p.radius > 0 ? sweepBall(host.physics, from, b, p.radius, undefined, skip) : castSegment(host.physics, from, b, undefined, skip);
      if (hit?.material !== 'edge') { if (hit) hit.distance += travelled; return hit; }
      travelled += hit.distance; from = hit.point; skip = hit.collider;
    }
    return null;
  };
  // one request, refilled per hit (the pipeline copies the contact frame and the tags)
  const req: DamageRequest = { source: player.health, sourceTags: ['weapon.crossbow', 'dmg.ranged', 'cover.checked'], target: player.health, amount: 0, point: new Vector3(), dir: seg, headshot: false };
  /** the step prev → bolt: the nearer of a body and the world; true when the bolt stopped */
  const testHit = (b: Bolt): boolean => {
    seg.subVectors(b.pos, prev);
    const len = seg.length();
    if (len < 1e-6) return false;
    seg.multiplyScalar(1 / len);
    const wall = worldHit(prev, b.pos);
    const hit = boltBodyHit(ports.bodies(), prev, seg, wall ? wall.distance : len), body = hit?.body ?? null;
    if (hit !== null && body !== null) {
      // the pipeline copies the contact frame (its scratch vectors are reused)
      req.target = body.combatActor(); req.amount = body.damageFor(hit.head, hit.point.distanceTo(player.position));
      req.point.copy(hit.point); req.headshot = hit.head;
      host.combat.hit(req);
      return true;
    }
    if (!wall) return false;
    n.set(wall.normal.x, wall.normal.y, wall.normal.z);
    if (n.dot(seg) > 0) n.negate();
    if (b.glanced && n.y >= 0.5) return true; // a spent bolt lies where it lands
    if (!b.glanced && sticksIn(wall.material)) return true;
    const vn = b.vel.dot(n);
    b.vel.addScaledVector(n, -vn).multiplyScalar(GLANCE_KEEP).addScaledVector(n, -vn * GLANCE_BOUNCE);
    if (b.vel.length() > GLANCE_MAX) b.vel.setLength(GLANCE_MAX);
    b.pos.set(wall.point.x, wall.point.y, wall.point.z).addScaledVector(n, GLANCE_LIFT);
    b.glanced = true;
    return false;
  };
  const fly = (b: Bolt, dt: number): void => {
    b.age += dt;
    const h = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) { prev.copy(b.pos); boltStep(b.pos, b.vel, h); if (testHit(b)) { b.active = false; return; } }
    if (Math.abs(b.pos.x) > BOUND || Math.abs(b.pos.z) > BOUND || b.pos.y < FLOOR || b.age > MAX_AGE) b.active = false;
  };
  host.onStep(CROSSBOW_STEP, dt => {
    const shots = ports.locked() ? NO_SHOTS : ports.shots();
    for (let i = 0; i < MAX_SHOTS; i++) {
      const id = shots[i];
      if (id === undefined) break;
      const target = host.entities.get(id);
      if (target === undefined || state.reloading || state.cooldown > 0) continue;
      if (!state.loaded) { reload(); continue; }
      fire(target);
    }
    state.cooldown = Math.max(0, state.cooldown - dt); state.sinceFire += dt;
    if (!state.loaded && !state.reloading && state.quiver > 0 && state.sinceFire > p.autoReload) reload();
    if (state.reloading) { state.reloadT += dt; if (state.reloadT >= p.reload) { state.reloading = false; state.loaded = true; } }
    for (let i = 0; i < MAX_FLYING; i++) { const b = bolts[i]; if (b?.active === true) fly(b, dt); }
  }, {
    snapshot: () => ({ ...state, bolts: bolts.map(b => ({ active: b.active, pos: [b.pos.x, b.pos.y, b.pos.z], vel: [b.vel.x, b.vel.y, b.vel.z], age: b.age, glanced: b.glanced })) }),
    restore: value => {
      const saved = v.parse(Saved, value);
      Object.assign(state, { loaded: saved.loaded, quiver: saved.quiver, reloading: saved.reloading, reloadT: saved.reloadT, cooldown: saved.cooldown, sinceFire: saved.sinceFire });
      saved.bolts.forEach((s, i) => { const b = bolts[i]; if (b !== undefined) { b.active = s.active; b.pos.set(...s.pos); b.vel.set(...s.vel); b.age = s.age; b.glanced = s.glanced; } });
    },
  });
  return { state, flying: () => bolts.filter(b => b.active).length };
}
