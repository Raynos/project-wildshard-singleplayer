import * as v from 'valibot';
import { Rng } from '@wildshard/engine/core/rng';
import type { AnimalSim, AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { killBelowWorld } from '@wildshard/engine/entities/killHeight';
import { castRay } from '@wildshard/engine/physics/query';
import type { SimHost, SimSpawn } from '@wildshard/engine/sim';
import type { SimSnapshot } from '@wildshard/engine/sim/snapshot';
import { SKY_SPAWNS } from '../data/spawns';
import { DECK, GOATS, RAY_HOMES, ROC, ROOST_RAYS, WISP_HOMES, apothem, type Home } from '../layout';
import { flockBrain, type FlockBrain } from './flockBrains';

/** The death plane under the islands: manifest `world.killY` (DECK - 24). The headless test holds the two equal (the
 * manifest itself imports views). */
export const SKY_KILL_Y = DECK - 24;
/** The flock keeper's fixed-step id; its continuation also says whether the goats have landed. */
export const FLOCK_STEP = 'far.flock';
/** How far above its island's deck a goat's spawn ray starts (runtime/index.ts GOAT_SPAWN_ABOVE, which imports views). */
const GOAT_RAY_ABOVE = 2;
/** The analytic placement floor of a structures-only world (game/shard/manifest `terrainFor`: y = -1000 m). */
export const SKY_ANALYTIC_FLOOR = -1000;
/** The creature manager's tick rate for a self-thinking species (AnimalManager.tickRate): 'legacy', decisions at 10 Hz and
 *  the body every frame at any distance, on the page scheduler's own clocks (SimHost.useBodyBands). */
const SKY_TICK_RATE = 'legacy';
/** The declared roster (data/spawns.ts): 13 finite bodies, so every keeper loop is bounded. */
const BODY_COUNT = 13;

interface Body { readonly id: string; readonly kind: string; readonly label: string; readonly home: Home; readonly range: readonly [number, number]; readonly recipe: SimSpawn; actor: AnimalSim | null; brain: FlockBrain | null }
/** What the keeper is lent: the baked native specs and each kind's variant scale range and label (the species rows). */
export interface SkyFlockPorts {
  readonly specs: ReadonlyMap<string, AnimalSimSpec>;
  readonly ranges: ReadonlyMap<string, readonly [number, number]>;
  /** The level seed (shard identity): the creature manager's stream is `Rng(seed + 31)` once the level is installed. */
  readonly seed: number;
}
const finite = v.pipe(v.number(), v.finite());
const Stream = v.strictObject({ version: v.literal(1), state: finite, initial: finite, scrambledFork: v.boolean() });
const Placed = v.object({ id: v.string(), seed: finite, scale: finite, at: v.strictObject({ x: finite, y: finite, z: finite }), yaw: finite });
const Saved = v.strictObject({ version: v.literal(1), rng: Stream, goats: v.boolean(),
  bodies: v.array(v.strictObject({ id: v.string(), live: v.boolean(), policy: v.nullable(v.string()) })) });

/**
 * Sky Reach's 13 declared bodies in a renderer-free host (SF72), as the shipping plugin and creature manager run them:
 * the eight flyers (the free ray, the three roost rays, the three wisps, then the Storm Roc) spawn at install in that
 * order, at their flight altitude over their authored circle; the five goats spawn on the first fixed step (the shipping
 * deferred `far.goats` fixed.post spawn), each on the first WORLD floor under its island deck + 2 m. Every spawn takes
 * the manager's six draws from its private stream `Rng(level seed + 31)` (scale, rig seed, actor seed, timer, fleeUntil,
 * callT), and the goats' wander draws come from the same stream. The host runs on the page's distance bands (`useBodyBands`,
 * before any spawn and before a restoring host restores its clocks): each body decides on the 'legacy' rate's clock (10 Hz,
 * the step the time since its last decision), moves every tick at any distance, and holds the page's creature capsule
 * only within 45 m of the player (released past 55 m). A body under the world's kill height dies by the fall pipeline. Nothing respawns (Sky's plugin never replaces a body).
 * Restore reinstalls exactly the saved roster from its recipes before the host restores, with no stream draw.
 */
export function installSkyFlock(host: SimHost, ports: SkyFlockPorts, saved?: Readonly<SimSnapshot>): {
  bodies: () => readonly { id: string; actor: AnimalSim | null; brain: FlockBrain | null }[];
  /** On restore, reinstall the landed goats after every other install-time registration (a no-op on a fresh boot). */
  land: () => void;
} {
  host.useBodyBands({ rate: () => SKY_TICK_RATE });
  const rng = new Rng(ports.seed + 31), rows = [...SKY_SPAWNS.actors, ...SKY_SPAWNS.bosses];
  const homes = new Map<string, Home>([
    ...RAY_HOMES.map((home, i) => [`far.ray.${String(i)}`, home] as const), ...ROOST_RAYS.map((home, i) => [`far.roost.${String(i)}`, home] as const),
    ...WISP_HOMES.map((home, i) => [`far.wisp.${String(i)}`, home] as const), ['far.roc', ROC] as const,
    ...GOATS.map((goat, i) => [`far.goat.${String(i)}`, { x: goat.isle.x, z: goat.isle.z, r: apothem(goat.isle), y: goat.isle.y }] as const)]);
  // shipping spawn order: the free ray, the roost rays, the wisps, the Roc, then the deferred goats
  const order = [...RAY_HOMES.map((_, i) => `far.ray.${String(i)}`), ...ROOST_RAYS.map((_, i) => `far.roost.${String(i)}`),
    ...WISP_HOMES.map((_, i) => `far.wisp.${String(i)}`), 'far.roc', ...GOATS.map((_, i) => `far.goat.${String(i)}`)];
  if (order.length !== BODY_COUNT || rows.length !== BODY_COUNT) throw new Error('Sky declares 13 finite bodies');
  const bodies: Body[] = order.map(id => {
    const row = rows.find(r => r.id === id), home = homes.get(id);
    if (row === undefined || home === undefined) throw new Error(`Missing declared Sky body ${id}`);
    const spec = ports.specs.get(row.kind), range = ports.ranges.get(row.kind);
    if (spec === undefined || range === undefined) throw new Error(`Missing native Sky recipe ${row.kind}`);
    // the height is set at the spawn: a goat's floor, a flyer's altitude over the world (or over its floor)
    return { id, kind: row.kind, label: spec.label, home, range, actor: null, brain: null,
      recipe: { id, spec, seed: 0, scale: 1, at: { x: row.at[0], y: 0, z: row.at[1] }, yaw: row.yaw } };
  });
  const flyers = bodies.filter(b => b.recipe.spec.flight !== undefined), goats = bodies.filter(b => b.recipe.spec.flight === undefined);
  let goatsDue = true;
  /** creatureFloor: the first WORLD hit under `fromY` (a structure, noted in `structure`), else the analytic floor. */
  const origin = { x: 0, y: 0, z: 0 }, down = { x: 0, y: -1, z: 0 }, sees = ['WORLD'] as const, under = { structure: false };
  const floor = (x: number, z: number, fromY: number): number => {
    origin.x = x; origin.y = fromY; origin.z = z;
    const hit = castRay(host.physics, origin, down, Math.max(201, fromY - SKY_ANALYTIC_FLOOR + 1), sees);
    under.structure = hit !== null; return hit === null ? SKY_ANALYTIC_FLOOR : hit.point.y;
  };
  /** A structures world gives every body the layered floor under its feet (AnimalManager.spawnAnimal `groundHeight`). */
  const groundHeight = (x: number, z: number, fromY: number): number => floor(x, z, fromY), brainPorts = { host, rng };
  const materialize = (body: Body, recipe: SimSpawn): AnimalSim => {
    const a = host.spawn(recipe); a.groundHeight = groundHeight;
    body.actor = a; body.brain = flockBrain(body.kind, body.label, a, body.home, brainPorts); return a;
  };
  /** The creature manager's six draws, into the body's own recipe (the host copies it at spawn), from its floor ray. */
  const arrive = (body: Body, fromY: number): void => {
    body.recipe.scale = rng.range(body.range[0], body.range[1]); rng.next(); body.recipe.seed = rng.next(); rng.next(); rng.next(); rng.next();
    const y = floor(body.recipe.at.x, body.recipe.at.z, fromY), structure = under.structure, flight = body.recipe.spec.flight;
    body.recipe.at.y = flight === undefined ? y : flight.altitude + (flight.above === 'world' ? 0 : y);
    materialize(body, body.recipe).levelGround = structure;
  };
  const world = { killY: SKY_KILL_Y };
  host.onStep(FLOCK_STEP, () => {
    // the body step that just ran: a body under the death plane dies by the fall pipeline (killBelowWorld)
    for (let i = 0; i < BODY_COUNT; i++) { const a = bodies[i]?.actor; if (a?.alive === true) killBelowWorld(a, world, host.combat); }
    if (goatsDue) {
      goatsDue = false;
      for (let i = 0; i < BODY_COUNT; i++) {
        const goat = goats[i]; if (goat === undefined) continue;
        arrive(goat, goat.home.y + GOAT_RAY_ABOVE);
      }
    }
    // the page's think loop: every body takes its decision step from its clock, alive or not (AnimalManager.update)
    for (let i = 0; i < BODY_COUNT; i++) {
      const body = bodies[i], a = body?.actor; if (body === undefined || a === null || a === undefined) continue;
      const think = host.brainDt(body.id); if (think <= 0 || !a.alive) continue;
      // a staggered self-thinking species holds (AnimalManager.think)
      if (a.stunned) { a.setMotion(a.yaw, 0, 1); a.lookTarget.copy(host.player.position); a.lookWeight = 1; continue; }
      body.brain?.decide(think);
    }
    for (let i = 0; i < BODY_COUNT; i++) {
      const body = bodies[i], a = body?.actor; if (body === undefined || a === null || a === undefined) continue;
      const step = host.bodyDt(body.id); if (step > 0 && a.alive && !a.stunned) body.brain?.move(step);
    }
  }, {
    snapshot: () => ({ version: 1, rng: { ...rng.snapshot() }, goats: !goatsDue,
      bodies: bodies.map(b => ({ id: b.id, live: b.actor !== null, policy: b.brain === null ? null : JSON.stringify(b.brain.snapshot()) })) }),
    restore: value => {
      const state = v.parse(Saved, value);
      if (state.goats === goatsDue || state.bodies.length !== bodies.length
        || state.bodies.some((b, i) => { const body = bodies.at(i); return body === undefined || b.id !== body.id || b.live !== (body.actor !== null); })) throw new Error('Incompatible Sky flock continuation');
      const policies = state.bodies.map(b => b.policy === null ? null : v.parse(v.string(), JSON.parse(b.policy)));
      rng.restore(state.rng);
      policies.forEach((policy, i) => { if (policy !== null) bodies[i]?.brain?.restore(policy); });
    },
  });
  // a flyer's floor ray starts a metre over the level spawn's height (manifest spawn y = DECK + 1)
  const view = (): readonly { id: string; actor: AnimalSim | null; brain: FlockBrain | null }[] => bodies.map(b => ({ id: b.id, actor: b.actor, brain: b.brain }));
  // a flyer's floor ray starts a metre over the level spawn's height (manifest spawn y = DECK + 1)
  if (saved === undefined) { flyers.forEach(body => { arrive(body, DECK + 2); }); return { bodies: view, land: () => undefined }; }
  const keeper = v.parse(Saved, saved.adapters.find(adapter => adapter.id === FLOCK_STEP)?.state);
  goatsDue = !keeper.goats;
  const reinstall = (group: readonly Body[]): void => keeper.bodies.forEach((b, i) => {
    const body = bodies[i]; if (body === undefined || !b.live || !group.includes(body)) return;
    const contract = saved.adapters.find(adapter => adapter.id === `runtime.actor.${body.id}`)?.state;
    if (typeof contract !== 'string') throw new Error(`Missing saved Sky body ${body.id}`);
    const placed = v.parse(Placed, JSON.parse(contract));
    if (placed.id !== body.id) throw new Error(`Incompatible saved Sky body ${body.id}`);
    materialize(body, { id: placed.id, spec: body.recipe.spec, seed: placed.seed, scale: placed.scale, at: placed.at, yaw: placed.yaw });
  });
  reinstall(flyers);
  // the goats landed on a later tick than every install-time registration: reinstall them last (`land`), so the
  // continuation keeps the order it had when it was saved
  return { bodies: view, land: () => { reinstall(goats); } };
}
