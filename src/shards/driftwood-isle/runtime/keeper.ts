import * as v from 'valibot';
import { Vector3 } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { WeightedTable } from '@wildshard/engine/ai/weighted';
import { HuntBrain, type HuntBody, type HuntGround } from '@wildshard/engine/ai/hunt';
import { castRay } from '@wildshard/engine/physics/query';
import type { SimHost, SimSpawn } from '@wildshard/engine/sim';
import type { SimSnapshot } from '@wildshard/engine/sim/snapshot';
import { CRAB } from '../species/crab';
import { SAILOR } from '../species/sailor';
import { MONKEY_VARIANTS } from '../species/monkeyVariants';
import { DRIFTWOOD_PRACTICE } from '../creatures/tables';
import { placeEnemies, PRACTICE_AT } from './placement';
import { enemyBrain, type EnemyBrain } from './enemyBrains';
import type { DriftwoodBake } from './baked';

/** The island keeper's fixed-step id; its continuation also names the live roster to reinstall before restore. */
export const ISLAND_STEP = 'driftwood.island';
/** The fauna's anchor searches' draws on the creature stream before the first enemy (the four sounders and two bears;
 *  test/shards/driftwood-isle/physics-bake.test.ts reads them off the bake). */
export const FAUNA_DRAWS = 148;
/** The roster (13 fauna + 21 enemies): every keeper loop is bounded by it. */
const BODY_COUNT = 34;
/** manifest.ts `fight` (E297: telegraphed melee, two attack tokens); the headless test holds them equal. */
export const DRIFTWOOD_FIGHT = { telegraphed: true, attackers: 2 } as const;
/** The scheduler's 'ai' tick rate (app/scheduler.ts AI): decisions at 20 Hz within 60 m of the player, 10 Hz to 160 m,
 *  paused beyond (the time away discarded); a sidestepping crab thinks every frame ('always'). */
const NEAR = 60, FAR = 160, NEAR_HZ = 20, FAR_HZ = 10, FRAME = 1 / 60;
const { delay: PRACTICE_BACK, away: PRACTICE_AWAY } = DRIFTWOOD_PRACTICE.respawn;
/** AnimalView.fadeOut: a dead practice crab's shell fades 1.5 s before the new one is placed (Enemies.tickPractice). */
const SHELL_FADE = 1.5;
/** terrainField.normalAt's central-difference step (m). */
const NORMAL_EPS = 0.6;
const ENEMIES = new Map<string, readonly { readonly id: string; readonly weight: number; readonly scale: readonly [number, number] }[]>([
  ['crab', CRAB.variants], ['sailor', SAILOR.variants], ['monkey', MONKEY_VARIANTS]]);
/** What a renderer-free body adds for the hunting brain: never hidden (no view), no ground tilt to sample. */
const HUNT_BODY = { hidden: false, sampleTerrain: (): void => undefined };

/** One body of the island: its id, kind / variant, label, herd slot (−1: none) and recipe; `actor` is null once retired. */
export interface IslandBody {
  readonly id: string; readonly kind: string; readonly variant: string; herd: number; readonly recipe: SimSpawn;
  readonly range: readonly [number, number]; actor: HuntBody | null; brain: EnemyBrain | null;
}
export interface IslandPorts {
  readonly bake: DriftwoodBake;
  /** every (kind.variant)'s baked native spec */
  readonly specs: ReadonlyMap<string, AnimalSimSpec>;
  /** the level seed (shard identity): the creature stream is `Rng(seed + 31)`, the placement stream `Rng(seed ^ 0xe11e)` */
  readonly seed: number;
  /** the island's still sea level (a crab whose point is not 0.15 m above it is skipped) */
  readonly waterLevel: number;
  /** the level spawn's height (AnimalManager.spawnAnimal's floor ray starts a metre over max(spawn y, ground)) */
  readonly spawnY: number;
}
const finite = v.pipe(v.number(), v.finite());
const Stream = v.strictObject({ version: v.literal(1), state: finite, initial: finite, scrambledFork: v.boolean() });
const Placed = v.object({ id: v.string(), seed: finite, scale: finite, at: v.strictObject({ x: finite, y: finite, z: finite }), yaw: finite });
const Saved = v.strictObject({ version: v.literal(1), rng: Stream, tokens: v.array(v.string()), herds: v.array(v.tuple([finite, finite])), clocks: v.array(v.tuple([finite, finite, finite])),
  bodies: v.array(v.strictObject({ id: v.string(), live: v.boolean(), policy: v.nullable(v.string()) })),
  practice: v.strictObject({ dead: finite, fade: finite }) });

/**
 * Driftwood Isle's creatures in a renderer-free host (SF72), as the shipping AnimalManager and creatures/Enemies.ts keep
 * them. The 13 fauna (four sounders and two bears) come from their baked recipes; the creature stream `Rng(seed + 31)`
 * then stands exactly past their anchor searches' 148 draws. The 21 enemies are placed by `placeEnemies` (crab groups,
 * the practice crab, three monkey troops, the sailor in the hold), each with the manager's spawn draws from that stream (a
 * monkey's variant roll, then scale, rig seed, body seed, and the three memory draws: timer, fleeUntil, callT). Every body
 * stands on the manager's creature floor: the first WORLD hit under its spawn ray, the terrain when that is the ground's
 * heightfield; a body on a structure keeps the layered floor under its feet. The herds are the manager's hunting brain's
 * (`HuntBrain`, src/engine/ai/hunt.ts), in its order: the fauna's, then the enemies' at their `addHerd` points.
 *
 * The enemies run their shipping policies (runtime/enemyBrains.ts) on the scheduler's 'ai' decision clock (20 Hz within
 * 60 m, 10 Hz to 160 m, paused beyond; every frame while a crab sidesteps) and strike every tick,
 * steering and confined through the hunting brain over the island (the baked floor, its normals, the open sea, no trees,
 * no cabins), holding the manager's two E297 attack tokens (swept when an attack is over). The practice crab comes back
 * 45 s after it dies once the player is 30 m off, after its 1.5 s shell fade: a fresh body in its slot (same id, six more
 * draws), a new herd of one. Restore reinstalls exactly the saved roster from its recipes before the host restores, with
 * no stream draw. Not yet owned: the fauna's decisions (they stand: the hunting brain resolves their species rows through
 * the global registry, which needs their renderer looks) and the coconuts (a monkey's throw releases nothing).
 */
export function installIsland(host: SimHost, ports: IslandPorts, saved?: Readonly<SimSnapshot>): {
  bodies: () => readonly IslandBody[];
  hunt: HuntBrain<HuntBody>;
  /** On restore, reinstall the bodies spawned in play after every other install-time registration (no-op when fresh). */
  settle: () => void;
} {
  const { bake, specs } = ports, rng = new Rng(ports.seed + 31), bodies: IslandBody[] = [], heightAt = bake.floorAt, player = host.player.position;
  const normalY = (x: number, z: number): number => {
    const nx = heightAt(x - NORMAL_EPS, z) - heightAt(x + NORMAL_EPS, z), nz = heightAt(x, z - NORMAL_EPS) - heightAt(x, z + NORMAL_EPS);
    return 2 * NORMAL_EPS / Math.hypot(nx, 2 * NORMAL_EPS, nz);
  };
  const ground: HuntGround = {
    heightAt, normalY, waterLevel: () => ports.waterLevel, chunkHalf: CHUNK_HALF,
    inChunk: (x, z, margin) => Math.abs(x) <= CHUNK_HALF - margin && Math.abs(z) <= CHUNK_HALF - margin,
    // the herd placer's trail clearance: the fauna's placement is baked, so nothing here asks it
    trailDistance: () => { throw new Error('Driftwood headless has no trail field (its fauna placement is baked)'); },
    cabinMask: () => 0, streamAt: () => null, pond: () => null, sea: () => true, wetAt: () => false,
    trees: () => [], treeless: () => true, terrain: () => true,
  };
  const hunt = new HuntBrain<HuntBody>({ rng, fight: DRIFTWOOD_FIGHT, faunaTuning: () => undefined }, {
    ground, nav: () => null, reach: () => { throw new Error('Driftwood headless fauna do not decide yet'); }, wanderGoal: () => null, unaware: () => false,
    now: () => host.clock.now * 1000, sound: () => undefined, charge: () => { throw new Error('Driftwood headless fauna do not decide yet'); },
  }, player);
  const habitat = bake.habitat, world = {
    perches: habitat.perches.map(p => new Vector3(p.x, p.y, p.z)), perchBases: habitat.perchBases.map(p => new Vector3(p.x, p.y, p.z)),
    hold: { x: habitat.hold.x, z: habitat.hold.z, r: habitat.hold.r, guardR: habitat.hold.guardR, floorAt: bake.holdFloorAt },
  };
  const brainPorts = { host, hunt, rng, world, heightAt, waterLevel: ports.waterLevel };
  const origin = { x: 0, y: 0, z: 0 }, down = { x: 0, y: -1, z: 0 }, sees = ['WORLD'] as const, under = { structure: false };
  /** creatureFloor: the first WORLD hit under `fromY`; the terrain when it is the ground's heightfield (or nothing). */
  const floor = (x: number, z: number, fromY: number): number => {
    const terrain = host.groundHeightAt(x, z);
    origin.x = x; origin.y = fromY; origin.z = z;
    const hit = castRay(host.physics, origin, down, Math.max(201, fromY - terrain + 1), sees);
    under.structure = hit !== null && hit.collider.shape.type !== host.physics.R.ShapeType.HeightField;
    return hit === null || !under.structure ? terrain : hit.point.y;
  };
  const spec = (kind: string, variant: string): AnimalSimSpec => {
    const known = specs.get(`${kind}.${variant}`); if (known === undefined) throw new Error(`Missing native Driftwood recipe ${kind}.${variant}`); return known;
  };
  const materialize = (body: IslandBody, recipe: SimSpawn, structure: boolean): void => {
    const a = Object.assign(host.spawn(recipe), HUNT_BODY);
    a.levelGround = structure; if (structure) a.groundHeight = floor;
    body.actor = a;
    const members = hunt.herds[body.herd]?.members ?? null;
    members?.push(a);
    body.brain = ENEMIES.has(body.kind) ? enemyBrain(body.kind, recipe.spec.label, a, members, brainPorts) : null;
  };
  /** AnimalManager.spawnAnimal's placement: the floor ray from a metre over max(spawn y, ground). */
  const arrive = (body: IslandBody): void => {
    const at = body.recipe.at, y = floor(at.x, at.z, Math.max(ports.spawnY, host.groundHeightAt(at.x, at.z)) + 1);
    at.y = y; materialize(body, body.recipe, under.structure);
  };
  /** The manager's spawn draws after a named variant: scale, rig seed, body seed, then the memory's timer, fleeUntil, callT. */
  const draw = (body: IslandBody): void => {
    body.recipe.scale = rng.range(body.range[0], body.range[1]); rng.next(); body.recipe.seed = rng.next(); rng.next(); rng.next(); rng.next();
  };
  const variants = (kind: string): NonNullable<ReturnType<typeof ENEMIES.get>> => { const table = ENEMIES.get(kind); if (table === undefined) throw new Error(`Driftwood has no ${kind} variants`); return table; };
  const enemyBody = (id: string, kind: string, variant: string, herd: number, at: { x: number; z: number }, yaw: number): IslandBody => {
    const row = variants(kind).find(r => r.id === variant); if (row === undefined) throw new Error(`Driftwood ${kind} has no variant ${variant}`);
    return { id, kind, variant, herd, range: row.scale, actor: null, brain: null, recipe: { id, spec: spec(kind, variant), seed: 0, scale: 1, at: { x: at.x, y: 0, z: at.z }, yaw } };
  };
  const fauna = bake.actors.filter(actor => actor.kind === 'boar' || actor.kind === 'bear');
  const herdBase = new Set(fauna.map(actor => actor.herd)).size;
  const placed = placeEnemies({ seed: ports.seed, crabSites: habitat.crabSites, palms: habitat.perchBases, heightAt, waterLevel: ports.waterLevel });
  // the manager's herds in its order: the fauna's (their centres are not baked: the members' mean), then the enemies'
  bake.herds.slice(0, herdBase).forEach(h => {
    const members = fauna.filter(a => h.members.includes(a.id) && a.at !== null);
    hunt.addHerd(h.kind, members.reduce((s, a) => s + (a.at?.x ?? 0), 0) / Math.max(1, members.length), members.reduce((s, a) => s + (a.at?.z ?? 0), 0) / Math.max(1, members.length));
  });
  placed.centres.forEach((c, i) => { hunt.addHerd(bake.herds[herdBase + i]?.kind ?? 'crab', c.x, c.z); });
  if (hunt.herds.length !== bake.herds.length) throw new Error('Driftwood herds diverge from the bake');

  const practice: { body: IslandBody | null; dead: number; fade: number } = { body: null, dead: 0, fade: -1 };
  const still = (a: HuntBody): boolean => a.alive && a.attackPhase >= 0;
  /** Each body's decision clock (last time seen, elapsed, credit), in roster order: a new subject starts a frame ago. */
  const last = new Float64Array(BODY_COUNT).fill(host.clock.now - FRAME), elapsed = new Float64Array(BODY_COUNT), credit = new Float64Array(BODY_COUNT);
  if (saved === undefined) {
    fauna.forEach(actor => {
      if (actor.at === null) throw new Error(`Baked Driftwood fauna ${actor.id} has no spawn point`);
      const body: IslandBody = { id: actor.id, kind: actor.kind, variant: actor.variant, herd: actor.herd, range: [actor.scale, actor.scale], actor: null, brain: null,
        recipe: { id: actor.id, spec: spec(actor.kind, actor.variant), seed: actor.seed, scale: actor.scale, at: { x: actor.at.x, y: 0, z: actor.at.z }, yaw: 0 } };
      arrive(body); bodies.push(body);
    });
    // the fauna's anchor searches drew these from the creature stream before the first enemy
    for (let i = 0; i < FAUNA_DRAWS; i++) rng.next();
    placed.enemies.forEach((row, i) => {
      const id = `creature:${String(fauna.length + i)}`;
      const variant = row.variant ?? new WeightedTable({ mode: 'weighted', rows: variants(row.kind).map(r => ({ item: r, weight: r.weight })) }).pick(undefined, rng.next())?.item.id;
      if (variant === undefined) throw new Error(`Driftwood ${row.kind} rolled no variant`);
      const body = enemyBody(id, row.kind, variant, row.herd < 0 ? -1 : row.herd + herdBase, row, row.yaw);
      draw(body); arrive(body); bodies.push(body);
      if (row.practice === true) practice.body = body;
    });
    if (bodies.length !== BODY_COUNT || practice.body === null) throw new Error('Driftwood keeps its 34 load-time bodies');
  }

  /** Enemies.placePracticeCrab: a fresh small crab in the practice slot at the pier's foot, facing down the path, a herd of one. */
  const replacePractice = (body: IslandBody): void => {
    host.retire(body.id);
    const old = hunt.herds[body.herd]; if (old !== undefined) old.members.length = 0;
    body.herd = hunt.addHerd('crab', PRACTICE_AT.x, PRACTICE_AT.z);
    draw(body); arrive(body);
    const i = bodies.indexOf(body); last[i] = host.clock.now - FRAME; elapsed[i] = 0; credit[i] = 0;
    practice.dead = 0; practice.fade = -1;
  };
  const keep = (): void => { host.onStep(ISLAND_STEP, dt => {
    hunt.tokens.sweep(still);
    const now = host.clock.now;
    for (let i = 0; i < BODY_COUNT; i++) {
      const body = bodies[i], a = body?.actor;
      if (body === undefined || a === null || a === undefined || body.brain === null) continue;
      // the subject's decision clock (TickScheduler.due, brain side): credit at the band's rate, elapsed time as its dt
      const d = Math.hypot(a.position.x - player.x, a.position.y - player.y, a.position.z - player.z);
      const hz = a.state === 'sidestep' ? Infinity : d < NEAR ? NEAR_HZ : d < FAR ? FAR_HZ : 0, step = now - (last[i] ?? now);
      last[i] = now;
      if (hz === 0) { elapsed[i] = 0; credit[i] = 0; continue; }
      elapsed[i] = (elapsed[i] ?? 0) + step; credit[i] = (credit[i] ?? 0) + step;
      if ((credit[i] ?? 0) + 1e-9 < 1 / hz) continue;
      const brainDt = elapsed[i] ?? 0;
      elapsed[i] = 0; credit[i] = hz === Infinity ? 0 : Math.max(0, (credit[i] ?? 0) - Math.floor(((credit[i] ?? 0) + 1e-9) * hz) / hz);
      if (brainDt <= 0) continue;
      if (!a.alive) { a.lookWeight = 0; continue; }
      // a staggered self-thinking species holds (AnimalManager.think)
      if (a.stunned) { a.setMotion(a.yaw, 0, 1); a.setStrafe(0); a.lookTarget.copy(player); a.lookWeight = 1; continue; }
      body.brain.decide(brainDt);
      const herd = hunt.herds[body.herd]; if (herd !== undefined) hunt.updateHerd(herd);
    }
    for (let i = 0; i < BODY_COUNT; i++) { const body = bodies[i], a = body?.actor; if (a !== null && a !== undefined && a.alive && !a.stunned) body?.brain?.move(dt); }
    const crab = practice.body?.actor ?? null;
    if (crab === null || crab.alive || practice.body === null) return;
    practice.dead += dt;
    if (practice.fade >= 0) practice.fade += dt;
    if (practice.dead < PRACTICE_BACK || Math.hypot(player.x - PRACTICE_AT.x, player.z - PRACTICE_AT.z) < PRACTICE_AWAY) return;
    if (practice.fade < 0) { practice.fade = 0; return; }
    if (practice.fade >= SHELL_FADE) replacePractice(practice.body);
  }, {
    snapshot: () => ({ version: 1, rng: { ...rng.snapshot() }, tokens: bodies.flatMap(b => b.actor !== null && hunt.tokens.enabled && hunt.tokens.holds(b.actor) ? [b.id] : []),
      herds: hunt.herds.map(h => [h.cx, h.cz] as [number, number]), clocks: [...last].map((t, i) => [t, elapsed[i] ?? 0, credit[i] ?? 0] as [number, number, number]), practice: { dead: practice.dead, fade: practice.fade },
      bodies: bodies.map(b => ({ id: b.id, live: b.actor !== null, policy: b.brain === null ? null : JSON.stringify(b.brain.snapshot()) })) }),
    restore: value => {
      const state = v.parse(Saved, value);
      if (state.bodies.length !== bodies.length || state.herds.length !== hunt.herds.length || state.clocks.length !== BODY_COUNT
        || state.bodies.some((b, i) => { const body = bodies.at(i); return body === undefined || b.id !== body.id || b.live !== (body.actor !== null); })) throw new Error('Incompatible Driftwood island continuation');
      const holders = state.tokens.map(id => { const a = bodies.find(b => b.id === id)?.actor ?? null; if (a === null) throw new Error('Unknown Driftwood token holder'); return a; });
      rng.restore(state.rng); practice.dead = state.practice.dead; practice.fade = state.practice.fade;
      hunt.tokens.clear(); holders.forEach(a => { hunt.tokens.take(a); });
      state.clocks.forEach(([t, e, c], i) => { last[i] = t; elapsed[i] = e; credit[i] = c; });
      state.herds.forEach(([cx, cz], i) => { const herd = hunt.herds[i]; if (herd !== undefined) { herd.cx = cx; herd.cz = cz; } });
      state.bodies.forEach((b, i) => { if (b.policy !== null) bodies[i]?.brain?.restore(v.parse(v.string(), JSON.parse(b.policy))); });
    },
  }); };
  if (saved === undefined) { keep(); return { bodies: () => bodies, hunt, settle: () => undefined }; }

  const keeper = v.parse(Saved, saved.adapters.find(adapter => adapter.id === ISLAND_STEP)?.state);
  if (keeper.bodies.length !== BODY_COUNT || keeper.herds.length < bake.herds.length) throw new Error('Incompatible Driftwood island continuation');
  // the practice crab's replacements each made a herd of one, in order
  keeper.herds.slice(bake.herds.length).forEach(([cx, cz]) => { hunt.addHerd('crab', cx, cz); });
  const ids = saved.adapters.map(adapter => adapter.id), at = (id: string): number => ids.indexOf(`runtime.actor.${id}`);
  const reinstall = (body: IslandBody): void => {
    const contract = saved.adapters.find(adapter => adapter.id === `runtime.actor.${body.id}`)?.state;
    if (typeof contract !== 'string') throw new Error(`Missing saved Driftwood body ${body.id}`);
    const recipe = v.parse(Placed, JSON.parse(contract));
    if (recipe.id !== body.id) throw new Error(`Incompatible saved Driftwood body ${body.id}`);
    body.recipe.seed = recipe.seed; body.recipe.scale = recipe.scale; body.recipe.at.x = recipe.at.x; body.recipe.at.y = recipe.at.y; body.recipe.at.z = recipe.at.z;
    floor(recipe.at.x, recipe.at.z, recipe.at.y + 1);
    materialize(body, body.recipe, under.structure);
  };
  // the roster's identities and recipes: the fauna's baked, the enemies' placed (their draws come from the saved bodies)
  fauna.forEach(actor => {
    const body: IslandBody = { id: actor.id, kind: actor.kind, variant: actor.variant, herd: actor.herd, range: [actor.scale, actor.scale], actor: null, brain: null,
      recipe: { id: actor.id, spec: spec(actor.kind, actor.variant), seed: actor.seed, scale: actor.scale, at: { x: actor.at?.x ?? 0, y: 0, z: actor.at?.z ?? 0 }, yaw: 0 } };
    bodies.push(body);
  });
  placed.enemies.forEach((row, i) => {
    const id = `creature:${String(fauna.length + i)}`, baked = bake.actors.find(a => a.id === id);
    if (baked === undefined) throw new Error(`Missing baked Driftwood enemy ${id}`);
    const body = enemyBody(id, row.kind, baked.variant, row.herd < 0 ? -1 : row.herd + herdBase, row, row.yaw);
    bodies.push(body); if (row.practice === true) practice.body = body;
  });
  // the practice slot's herd is the newest herd of one once it has been replaced
  const slot = practice.body;
  if (slot !== null && keeper.herds.length > bake.herds.length) slot.herd = keeper.herds.length - 1;
  // The host snapshots its adapters in registration order: the load-time bodies sit before the keeper's step, a body
  // spawned in play (a new practice crab) after it, and after the runtime's later steps. Reinstall each at its own point.
  const step = ids.indexOf(ISLAND_STEP), first = ids.findIndex((id, i) => i > step && !id.startsWith('runtime.actor.'));
  const live = bodies.filter((_, i) => keeper.bodies[i]?.live === true).sort((a, b) => at(a.id) - at(b.id)), deferred: IslandBody[] = [];
  live.forEach(body => { if (at(body.id) < step) reinstall(body); });
  keep();
  live.forEach(body => { if (at(body.id) > step) { if (first === -1 || at(body.id) < first) reinstall(body); else deferred.push(body); } });
  return { bodies: () => bodies, hunt, settle: () => { deferred.forEach(reinstall); deferred.length = 0; } };
}
