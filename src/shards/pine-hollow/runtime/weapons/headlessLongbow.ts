import * as v from 'valibot';
import { Vector3 } from 'three';
import type { SimHost } from '@wildshard/engine/sim';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { DamageRequest } from '@wildshard/engine/combat/pipeline';
import { BowDraw } from '@wildshard/engine/combat/bowDraw';
import { projectileFlightStep } from '@wildshard/engine/combat/projectileFlight';
import { projectileContactTip, projectileGlance } from '@wildshard/engine/combat/projectileContact';
import { drawnSpreadDegrees } from '@wildshard/engine/combat/shotSpread';
import { floorBelow, sticksIn } from '@wildshard/engine/physics/query';
import { ARROW_FLIGHT, ARROW_MAX_FLYING, LONGBOW_LOOSE } from '../../weapons/longbowFlight';
import { EYE, aimAt, bodyHit, spreadInto, worldHit } from './headlessRanged';
import { PineStuckArrows, STUCK_ARROWS_SAVED } from './stuckArrows';

/** The longbow's fixed-step id; its continuation is the draw, the quiver, the aim and every arrow in flight. */
export const LONGBOW_STEP = 'pine.longbow';
/** The arrow pool's loop bound (ARROW_MAX_FLYING slots, well under it). Bow.ts launchFrom: the arrow starts this far down the aim line; the loose's cone (°, hip, standing). Projectiles: four
 *  substeps a tick, the broadhead's 2 cm ball, dead past the chunk + 80 m, below -150 m or after 12 s. */
const MAX_SLOTS = 64, MUZZLE = 0.55, SPREAD_DEG = 0.3, SUBSTEPS = 4, RADIUS = 0.02, BOUND = 250 + 80, FLOOR = -150, MAX_AGE = 12;
/** Projectiles' glance off a hard surface: lift off it, keep a little of the speed, a small bounce, a speed cap. */
const GLANCE_LIFT = 0.03, GLANCE_KEEP = 0.35, GLANCE_BOUNCE = 0.25, GLANCE_MAX = 9;
const GLANCE = { lift: GLANCE_LIFT, keep: GLANCE_KEEP, bounce: GLANCE_BOUNCE, maxSpeed: GLANCE_MAX };

interface Arrow { active: boolean; pos: Vector3; vel: Vector3; origin: Vector3; age: number; glanced: boolean }

const finite = v.pipe(v.number(), v.finite()), vec = v.tuple([finite, finite, finite]);
const Saved = v.strictObject({
  draw: v.strictObject({ drawT: finite, holdT: finite, renockT: finite, tiredT: finite, wasHeld: v.boolean(), needLift: v.boolean(), reachedFull: v.boolean() }),
  arrows: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(LONGBOW_LOOSE.quiver)), aim: v.nullable(v.string()),
  flying: v.pipe(v.array(v.strictObject({ active: v.boolean(), pos: vec, vel: vec, origin: vec, age: finite, glanced: v.boolean() })), v.length(ARROW_MAX_FLYING)),
  stuck: STUCK_ARROWS_SAVED,
});

/** What the longbow is lent: this tick's HEAVY hold (null when up; its target, if it names one), whether it is live (held,
 *  not mid-swap, not locked by a boss intro) and the bodies an arrow can hit. */
export interface PineLongbowPorts {
  readonly heavy: () => { readonly targetId?: string | undefined } | null;
  readonly enabled: () => boolean;
  readonly bodies: () => readonly AnimalSim[];
  /** the loosing tick's aim share along the target's body (headlessRanged.ts `aimAt`; absent: its middle) */
  readonly aim?: () => number;
  /** The ONE world/weather owner; an isolated installer without it explicitly keeps still air. */
  readonly wind?: { vecAt: (x: number, z: number, out: Vector3) => Vector3 };
  /** Actual combat-input samples, not inferred from corrected displacement. Missing samples remain standing/hip. */
  readonly aimed?: () => number;
  readonly speedFactor?: () => number;
  readonly extraSpread?: () => number;
  readonly mountSpread?: () => number;
}

/**
 * PINE HOLLOW'S LONGBOW in a renderer-free host (SF72), drawn as the page draws it (the engine's Bow on `bowDraw.ts`
 * `BowDraw`): the HEAVY hold is the draw (0.75 s to full), a release at full looses (the only way an arrow leaves), early
 * lets down, a long hold tires the arms; nothing draws while it is not live or the quiver (20, the King's reward) is empty.
 * The loose aims at the hold's last named body (else along the player's facing), with the page's 0.3° cone (√ radius, four
 * draws from the host's gameplay stream), from 0.55 m down the aim line at 32 + 30 m/s, and flies the arrow's own law
 * (engine combat/projectileFlight.ts with weapons/longbowFlight.ts's numbers) in four substeps a tick, each tested against
 * the world (a 2 cm ball) and the creatures' hitboxes short of the wall: a body takes max(1, round(the damage model's blow
 * from the loose point × 1.35)) through the host's combat pipeline; wood and ground keep the arrow, stone glances it and a
 * glanced arrow lies on the next surface it meets.
 *
 * The full Pine installer lends its single serialized weather/gust owner and authoritative motion sample. Isolated
 * callers without these ports keep still air/standing input. The native clock is explicit; equivalence to a variable
 * page frame clock requires the same sampled deltas. Pickup checks follow the page's eight-update clock, saved with
 * every stopped shaft. Aimed and mounted spread remain explicit input ports.
 */
export function installPineLongbow(host: SimHost, ports: PineLongbowPorts): { readonly draw: BowDraw; readonly state: { arrows: number; aim: string | null }; readonly flying: () => number; readonly stuck: PineStuckArrows } {
  const random = (): number => host.rng.stream('gameplay').next(), player = host.player;
  const draw = new BowDraw(), state: { arrows: number; aim: string | null } = { arrows: LONGBOW_LOOSE.quiver, aim: null };
  const arrows: Arrow[] = Array.from({ length: ARROW_MAX_FLYING }, () => ({ active: false, pos: new Vector3(), vel: new Vector3(), origin: new Vector3(), age: 0, glanced: false }));
  const eye = new Vector3(), dir = new Vector3(), across = new Vector3(), prev = new Vector3(), seg = new Vector3(), n = new Vector3(), contact = new Vector3(), wind = new Vector3();
  const stuck = new PineStuckArrows({ feet: player.position,
    floorAt: (x, y, z) => floorBelow(host.physics, x, z, y + 0.3, 60) ?? host.groundHeightAt(x, z),
    body: id => host.entities.get(id), canRecover: () => state.arrows < LONGBOW_LOOSE.quiver,
    recover: survived => { if (survived) state.arrows = Math.min(LONGBOW_LOOSE.quiver, state.arrows + 1); }, random });
  const req: DamageRequest = { source: player.health, sourceTags: ['weapon.longbow', 'dmg.ranged', 'cover.checked'], target: player.health, amount: 0, point: new Vector3(), dir: seg, headshot: false };
  const loose = (): void => {
    const target = state.aim === null ? undefined : host.entities.get(state.aim);
    if (target?.alive === true) aimAt(host, target, eye, dir, ports.aim?.());
    else { const p = player.position; eye.set(p.x, p.y + EYE, p.z); dir.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)); }
    const spread = drawnSpreadDegrees(SPREAD_DEG, LONGBOW_LOOSE.aimSpread, ports.aimed?.() ?? 0, 0.6,
      ports.speedFactor?.() ?? 0, ports.extraSpread?.() ?? 0, ports.mountSpread?.() ?? 0);
    spreadInto(dir, spread * (Math.PI / 180), random, true, across);
    // a free slot, else the oldest arrow's (Projectiles.launch)
    let a: Arrow | undefined;
    for (let i = 0; i < MAX_SLOTS; i++) {
      const x = arrows[i];
      if (x === undefined) break;
      if (!x.active) { a = x; break; }
      if (a === undefined || x.age > a.age) a = x;
    }
    if (a === undefined) return;
    a.active = true; a.age = 0; a.glanced = false;
    a.pos.copy(eye).addScaledVector(dir, MUZZLE); a.origin.copy(a.pos); a.vel.copy(dir).multiplyScalar(LONGBOW_LOOSE.speedBase + LONGBOW_LOOSE.speedDraw);
    state.arrows--;
  };
  /** the step prev → arrow: the nearer of a body and the world; true when the arrow stopped */
  const testHit = (a: Arrow): boolean => {
    seg.subVectors(a.pos, prev);
    const len = seg.length();
    if (len < 1e-6) return false;
    seg.multiplyScalar(1 / len);
    const wall = worldHit(host, prev, a.pos, RADIUS);
    const hit = bodyHit(ports.bodies(), prev, seg, wall ? wall.distance : len), body = hit?.body ?? null;
    if (hit !== null && body !== null) {
      req.target = body.combatActor(); req.amount = Math.max(1, Math.round(body.damageFor(hit.head, hit.point.distanceTo(a.origin)) * LONGBOW_LOOSE.damageScale));
      req.point.copy(hit.point); req.headshot = hit.head;
      host.combat.hit(req);
      stuck.stop(hit.point, seg, true, body.alive ? body : null);
      if (!body.alive) stuck.dropLast();
      return true;
    }
    if (!wall) return false;
    n.set(wall.normal.x, wall.normal.y, wall.normal.z);
    if (n.dot(seg) > 0) n.negate();
    contact.set(wall.point.x, wall.point.y, wall.point.z);
    if (a.glanced) { stuck.rest(contact, seg, n); return true; }
    if (sticksIn(wall.material)) { projectileContactTip(contact, seg, n, RADIUS); stuck.stop(contact, seg, false, null); return true; }
    projectileGlance(contact, a.vel, n, GLANCE);
    a.pos.copy(contact);
    a.glanced = true;
    return false;
  };
  const fly = (a: Arrow, dt: number): void => {
    a.age += dt;
    const h = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
      prev.copy(a.pos);
      const sampled = ports.wind === undefined ? null : ports.wind.vecAt(a.pos.x, a.pos.z, wind);
      projectileFlightStep(a.pos, a.vel, h, ARROW_FLIGHT, sampled);
      if (testHit(a)) { a.active = false; return; }
    }
    if (Math.abs(a.pos.x) > BOUND || Math.abs(a.pos.z) > BOUND || a.pos.y < FLOOR || a.age > MAX_AGE) a.active = false;
  };
  host.onStep(LONGBOW_STEP, dt => {
    const live = ports.enabled(), heavy = live ? ports.heavy() : null;
    // the hold's named body is the aim the release looses at (a release tick has no hold to name it)
    if (heavy !== null) state.aim = heavy.targetId ?? null;
    if (draw.step(dt, heavy !== null, !live || state.arrows <= 0) === 'loose') loose();
    for (let i = 0; i < MAX_SLOTS; i++) { const a = arrows[i]; if (a === undefined) break; if (a.active) fly(a, dt); }
    stuck.update();
  }, {
    snapshot: () => ({ draw: { ...draw.save() }, arrows: state.arrows, aim: state.aim,
      flying: arrows.map(a => ({ active: a.active, pos: [a.pos.x, a.pos.y, a.pos.z], vel: [a.vel.x, a.vel.y, a.vel.z], origin: [a.origin.x, a.origin.y, a.origin.z], age: a.age, glanced: a.glanced })), stuck: stuck.snapshot() }),
    restore: value => {
      const saved = v.parse(Saved, value);
      draw.load(saved.draw); state.arrows = saved.arrows; state.aim = saved.aim;
      stuck.restore(saved.stuck);
      saved.flying.forEach((s, i) => { const a = arrows[i]; if (a !== undefined) { a.active = s.active; a.pos.set(...s.pos); a.vel.set(...s.vel); a.origin.set(...s.origin); a.age = s.age; a.glanced = s.glanced; } });
    },
  }, 'afterBodies');
  return { draw, state, flying: () => arrows.filter(a => a.active).length, stuck };
}
