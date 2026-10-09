import * as v from 'valibot';
import { Vector3 } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { WeightedTable } from '@wildshard/engine/ai/weighted';
import { ATTACK_TURN, HuntBrain, type HuntBody, type HuntGround, type HuntMemory, type HuntNav } from '@wildshard/engine/ai/hunt';
import { canReach } from '@wildshard/engine/ai/reach';
import { castRay } from '@wildshard/engine/physics/query';
import { EntityIds } from '@wildshard/engine/entities/ids';
import { Bodies } from '@wildshard/engine/physics/bodies';
import { waveHeight } from '@wildshard/engine/world/waves';
import type { SimHost, SimSpawn } from '@wildshard/engine/sim';
import type { SimSnapshot } from '@wildshard/engine/sim/snapshot';
import { CRAB } from '../species/crab';
import { SAILOR } from '../species/sailor';
import { MONKEY_VARIANTS } from '../species/monkeyVariants';
import { DRIFTWOOD_PRACTICE } from '../creatures/tables';
import { COCONUTS, Coconuts } from '../combat/coconuts';
import { placeEnemies, PRACTICE_AT } from './placement';
import { enemyBrain, type EnemyBrain } from './enemyBrains';
import type { DriftwoodBake } from './baked';
import { DRIFTWOOD_FAUNA_TUNING, faunaPlacement, faunaSpecies } from './fauna';

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
/** The island's fauna kinds: the manager's hunting brain decides for them (the enemies run their own policies). */
const FAUNA = new Set(['boar', 'bear']);
/** What a renderer-free body adds for the hunting brain: never hidden (no view), no ground tilt to sample. */
const HUNT_BODY = { hidden: false, sampleTerrain: (): void => undefined };

/** One body of the island: its id, kind / variant, label, herd slot (−1: none) and recipe; `actor` is null once retired. */
export interface IslandBody {
  id: string; readonly kind: string; readonly variant: string; herd: number; readonly recipe: SimSpawn;
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
  /** the island's baked navmesh (public/assets/baked/driftwood-isle/navmesh.bin, the browser's file), or null */
  readonly nav: HuntNav | null;
}
const finite = v.pipe(v.number(), v.finite());
const Stream = v.strictObject({ version: v.literal(1), state: finite, initial: finite, scrambledFork: v.boolean() });
const Placed = v.object({ id: v.string(), seed: finite, scale: finite, at: v.strictObject({ x: finite, y: finite, z: finite }), yaw: finite });
const Point = v.tuple([finite, finite, finite]);
/** HuntMemory as plain data (its path corners as points) */
const Memory = v.strictObject({ timer: finite, tx: finite, tz: finite, fleeT: finite, fleeUntil: finite, chargeCd: finite, callT: finite, awareness: finite,
  freeze: finite, spooked: v.boolean(), wary: finite, sensed: v.boolean(), windup: finite, backoff: finite, side: finite, committed: v.boolean(),
  path: v.array(Point), pathI: finite, goalX: finite, goalZ: finite, repathAt: finite });
const Slot = v.strictObject({ k: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(COCONUTS - 1)), state: v.picklist([1, 2]), rest: finite, age: finite,
  thrower: v.pipe(v.number(), v.integer(), v.minValue(-1), v.maxValue(BODY_COUNT - 1)), handle: finite, wet: finite });
/** a coconut collider's owner tag (plain data: the host's snapshot encodes collider owners) */
const COCONUT_OWNER = { kind: 'coconut' } as const;
const Saved = v.strictObject({ version: v.literal(3), rng: Stream,
  coconuts: v.strictObject({ rng: Stream, next: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(COCONUTS - 1)), slots: v.array(Slot) }),
  fauna: v.strictObject({ clock: finite, speed: finite, prev: v.nullable(Point), memories: v.array(v.nullable(Memory)), sight: v.array(v.nullable(v.boolean())) }), tokens: v.array(v.string()), herds: v.array(v.tuple([finite, finite])), clocks: v.array(v.tuple([finite, finite, finite])),
  bodies: v.array(v.strictObject({ id: v.string(), live: v.boolean(), policy: v.nullable(v.string()) })),
  practice: v.strictObject({ dead: finite, fade: finite }), ids: v.strictObject({ next: v.pipe(v.number(), v.integer(), v.minValue(0)), used: v.array(v.string()) }) });

/** HuntMemory as plain data: every field, the path's corners as points. */
function memoryData(m: HuntMemory): v.InferOutput<typeof Memory> {
  return { timer: m.timer, tx: m.tx, tz: m.tz, fleeT: m.fleeT, fleeUntil: m.fleeUntil, chargeCd: m.chargeCd, callT: m.callT, awareness: m.awareness,
    freeze: m.freeze, spooked: m.spooked, wary: m.wary, sensed: m.sensed, windup: m.windup, backoff: m.backoff, side: m.side, committed: m.committed,
    path: m.path.map(p => [p.x, p.y, p.z] as [number, number, number]), pathI: m.pathI, goalX: m.goalX, goalZ: m.goalZ, repathAt: m.repathAt };
}

/**
 * Driftwood Isle's creatures in a renderer-free host (SF72), as the shipping AnimalManager and creatures/Enemies.ts keep
 * them. The 13 fauna (four sounders and two bears) come from their baked recipes at the spawns, yaws and herd centres
 * their anchor searches drew off the creature stream `Rng(seed + 31)` (runtime/fauna.ts); each fauna body's memory takes
 * the three draws after its seed (HuntBrain.adopt), and the stream then stands exactly past those 148 draws. The 21
 * enemies are placed by `placeEnemies` (crab groups, the practice crab, three monkey troops, the sailor in the hold), each
 * with the manager's spawn draws from that stream (a monkey's variant roll, then scale, rig seed, body seed, and the three
 * memory draws: timer, fleeUntil, callT). Every body stands on the manager's creature floor: the first WORLD hit under its
 * spawn ray, the terrain when that is the ground's heightfield; a body on a structure keeps the layered floor under its
 * feet; every body's turn is capped while it attacks (a melee shard). The herds are the manager's hunting brain's
 * (`HuntBrain`, src/engine/ai/hunt.ts), in its order: the fauna's, then the enemies' at their `addHerd` points.
 *
 * Decisions run on the scheduler's 'ai' clock per body (20 Hz within 60 m, 10 Hz to 160 m, paused beyond; every frame
 * while a crab sidesteps), and an interrupt decides at once: a hunter that loses its line to the player, a fauna body hit
 * without dying. The fauna decide through the hunting brain (the island's boar and bear rows, the manifest's fauna tuning,
 * the browser's baked navmesh for paths and wander targets, the manager's smoothed player speed), charge on the body
 * tick and land a charge as PlayerHurt.creature's blow; a hit turns, bolts or enrages them. The enemies run their
 * shipping policies (runtime/enemyBrains.ts) and strike every tick, steering and confined through the hunting brain over
 * the island (the baked floor, its normals, the open sea, no trees, no cabins). Every body holds the manager's two E297
 * attack tokens (swept when an attack is over). The practice crab comes back 45 s after it dies once the player is 30 m
 * off, after its 1.5 s shell fade: a fresh body in its slot (the manager's next entity id, six more draws), a new herd of one. A
 * monkey's throw releases a real coconut (combat/coconuts.ts, the browser's own rules) into the host's world through a
 * body service stepped around the host's world step; the continuation keeps each live slot and its native handle, and the
 * restored world's bodies are adopted back by handle. Restore reinstalls exactly the saved roster from its recipes before
 * the host restores, with no stream draw kept.
 *
 * Known differences from the browser (the SF72 handoff): every body's physics steps every tick (the host owns the bodies;
 * the browser halves them 60–160 m out and pauses them beyond); a charge's contact is tested at the start of the next
 * tick, against the player where the charging tick saw it (the host steps bodies after its systems), so its knockback
 * starts one tick later; no 'target.attack' / 'target.dodge' wakes (no weapon or dodge is owned yet); no player
 * push-out (`clearBody`); the coconuts float on the swell at the host clock (the browser's ocean clock starts with its view).
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
  const reach = (a: HuntBody, at: Vector3): boolean => canReach(a, at, host.physics);
  // a charge that lands files PlayerHurt.creature's hit: a creature blow (feel.blow knocks the player back, as the browser's)
  const charge = (a: HuntBody, damage: number): void => {
    host.combat.hit({ source: 'env', sourceTags: [`creature.${a.kind}`, 'feel.blow', 'cover.checked'], target: host.player.health, amount: damage,
      point: a.position.clone(), dir: new Vector3(), cause: { kind: a.kind, label: a.label } });
  };
  // the manager's ports (AnimalManager's constructor): no wander goal or calm on Driftwood, the voices are presentation and
  // the idle glances' millisecond clock is cosmetic (look weight only)
  const hunt = new HuntBrain<HuntBody>({ rng, fight: DRIFTWOOD_FIGHT, faunaTuning: () => DRIFTWOOD_FAUNA_TUNING, species: faunaSpecies }, {
    ground, nav: () => ports.nav, reach, wanderGoal: () => null, unaware: () => false,
    now: () => host.clock.now * 1000, sound: () => undefined, charge,
  }, player);
  const habitat = bake.habitat;
  const placed = placeEnemies({ seed: ports.seed, crabSites: habitat.crabSites, palms: habitat.perchBases, heightAt, waterLevel: ports.waterLevel });
  // the coconuts (combat/coconuts.ts, as Enemies.ts throws them): bodies in the host's world, spun from the placement
  // stream past placement, floating on the sea's swell at the host's clock; a hit is the thrower's blow on the player
  let service = new Bodies(host.physics, player);
  const volley = new Coconuts<HuntBody>({
    bodies: () => service, rng: placed.stream, owner: COCONUT_OWNER,
    surface: (x, z) => heightAt(x, z) >= ports.waterLevel ? undefined : ports.waterLevel + waveHeight(x, z, host.clock.now),
    hit: (th, amount, moveId) => {
      host.combat.hit({ source: 'env', sourceTags: ['creature.monkey', 'feel.blow', 'cover.checked'], target: host.player.health, amount, moveId,
        point: th.position.clone(), dir: new Vector3(), cause: { kind: th.kind, label: th.label } });
    },
    // the hit / landing voices and the splash are presentation
    sound: () => undefined, splash: () => undefined,
  });
  let reattach: (() => void) | null = null;
  const world = {
    perches: habitat.perches.map(p => new Vector3(p.x, p.y, p.z)), perchBases: habitat.perchBases.map(p => new Vector3(p.x, p.y, p.z)),
    hold: { x: habitat.hold.x, z: habitat.hold.z, r: habitat.hold.r, guardR: habitat.hold.guardR, floorAt: bake.holdFloorAt },
    // a monkey's lob releases a real coconut from the volley
    throwCoconut: (from: Vector3, to: Vector3, thrower: HuntBody): void => { volley.throw(from, to, thrower); },
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
    // a melee shard caps every creature's turn while it attacks (AnimalManager.spawnAnimal)
    a.attackTurnCap = ATTACK_TURN;
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
  // the fauna's spawns, yaws and herd centres as the anchor searches drew them off the creature stream (runtime/fauna.ts)
  const stream = faunaPlacement(ports.seed, fauna);
  if (stream.draws !== FAUNA_DRAWS || stream.centres.length !== herdBase) throw new Error('Driftwood fauna placement diverges from the stream');
  const spawnOf = (id: string): { x: number; z: number; yaw: number; at: number } => {
    const at = stream.spawns.get(id); if (at === undefined) throw new Error(`Driftwood fauna ${id} has no stream placement`); return at;
  };
  const faunaBody = (actor: (typeof fauna)[number]): IslandBody => {
    const at = spawnOf(actor.id);
    return { id: actor.id, kind: actor.kind, variant: actor.variant, herd: actor.herd, range: [actor.scale, actor.scale], actor: null, brain: null,
      recipe: { id: actor.id, spec: spec(actor.kind, actor.variant), seed: actor.seed, scale: actor.scale, at: { x: at.x, y: 0, z: at.z }, yaw: at.yaw } };
  };
  // the manager's herds in its order: the fauna's at their drawn centres, then the enemies'
  bake.herds.slice(0, herdBase).forEach((h, i) => { const c = stream.centres[i]; if (c !== undefined) hunt.addHerd(h.kind, c[0], c[1]); });
  placed.centres.forEach((c, i) => { hunt.addHerd(bake.herds[herdBase + i]?.kind ?? 'crab', c.x, c.z); });
  if (hunt.herds.length !== bake.herds.length) throw new Error('Driftwood herds diverge from the bake');

  const practice: { body: IslandBody | null; dead: number; fade: number } = { body: null, dead: 0, fade: -1 };
  /** AnimalManager.stillAttacking: a charger while it charges, a self-thinking species while its strike runs */
  const still = (a: HuntBody): boolean => a.alive && (FAUNA.has(a.kind) ? a.state === 'charge' : a.attackPhase >= 0);
  /** Each body's decision clock (last time seen, elapsed, credit), in roster order: a new subject starts a frame ago. */
  const last = new Float64Array(BODY_COUNT).fill(host.clock.now - FRAME), elapsed = new Float64Array(BODY_COUNT), credit = new Float64Array(BODY_COUNT);
  /** the tick each decision clock last ran (TickScheduler's per-frame fence: a second ask in one frame gets nothing) */
  const ran = new Float64Array(BODY_COUNT).fill(-1);
  /** AnimalManager.visibility: whether each aggressive body last had a clear line to the player (null: never asked) */
  const sight = Array.from({ length: BODY_COUNT }, (): boolean | null => null);
  /** the manager's smoothed player ground speed, the player where the last step saw it (once one has), and the hunting
   *  brain's world clock */
  const tracked = { speed: 0, prev: new Vector3(), seen: false, clock: 0 };
  if (saved === undefined) {
    fauna.forEach(actor => { const body = faunaBody(actor); arrive(body); bodies.push(body); });
    // the fauna's anchor searches drew these from the creature stream before the first enemy; each body's memory took the
    // three draws after its seed (HuntBrain.adopt at its spawn point)
    const adoptAt = new Map(bodies.map(b => [spawnOf(b.id).at, b] as const));
    let drawn = 0;
    for (let i = 0; i < FAUNA_DRAWS; i++) {
      if (i < drawn) continue;
      rng.next(); drawn = i + 1;
      const body = adoptAt.get(i), a = body?.actor ?? null;
      if (body !== undefined && a !== null) { hunt.adopt(a, body.recipe.at.x, body.recipe.at.z); drawn += 3; }
    }
    if (drawn !== FAUNA_DRAWS || bodies.some(b => b.actor === null || hunt.memory(b.actor) === undefined)) throw new Error('Driftwood fauna memories diverge from the stream');
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

  /** the manager's own entity ids (EntityIds('creature')): the load-time roster took creature:0–33, each later spawn the next */
  const entityIds = new EntityIds('creature');
  for (let i = 0; i < BODY_COUNT; i++) entityIds.allocate();
  /** Enemies.placePracticeCrab: a fresh small crab in the practice slot at the pier's foot, facing down the path, a herd of
   *  one, under the manager's next entity id. */
  const replacePractice = (body: IslandBody): void => {
    host.retire(body.id);
    body.id = entityIds.allocate(); body.recipe.id = body.id;
    const old = hunt.herds[body.herd]; if (old !== undefined) old.members.length = 0;
    body.herd = hunt.addHerd('crab', PRACTICE_AT.x, PRACTICE_AT.z);
    draw(body); arrive(body);
    const i = bodies.indexOf(body); last[i] = host.clock.now - FRAME; elapsed[i] = 0; credit[i] = 0; ran[i] = -1; sight[i] = null;
    practice.dead = 0; practice.fade = -1;
  };
  /** The body's decision rate (AnimalManager.tickRate on the 'ai' bands): every frame while a crab sidesteps. */
  const rateOf = (a: HuntBody): number => {
    const d = Math.hypot(a.position.x - player.x, a.position.y - player.y, a.position.z - player.z);
    return a.state === 'sidestep' ? Infinity : d < NEAR ? NEAR_HZ : d < FAR ? FAR_HZ : 0;
  };
  /** TickScheduler.due (brain side) for body `i`: its decision dt this frame (0: not due); `urgent` is an interrupt's wake. */
  const due = (i: number, a: HuntBody, urgent: boolean): number => {
    const tick = host.state.tick;
    if (ran[i] === tick && !urgent) return 0;
    const now = host.clock.now, hz = rateOf(a), step = now - (last[i] ?? now);
    last[i] = now; ran[i] = tick;
    if (hz === 0) { elapsed[i] = 0; credit[i] = 0; } else { elapsed[i] = (elapsed[i] ?? 0) + step; credit[i] = (credit[i] ?? 0) + step; }
    if (!urgent && (hz === 0 || (credit[i] ?? 0) + 1e-9 < 1 / hz)) return 0;
    const dt = elapsed[i] ?? 0;
    elapsed[i] = 0; credit[i] = urgent || hz === Infinity ? 0 : Math.max(0, (credit[i] ?? 0) - Math.floor(((credit[i] ?? 0) + 1e-9) * hz) / hz);
    return dt;
  };
  /** AnimalManager.think for body `i`: a fauna body's hunting brain, or an enemy's own policy. */
  const runBrain = (body: IslandBody, a: HuntBody, dt: number): void => {
    if (body.brain === null) { hunt.think(a, dt, player, false, tracked.speed); return; }
    if (!a.alive) { a.lookWeight = 0; return; }
    // a staggered self-thinking species holds (AnimalManager.think)
    if (a.stunned) { a.setMotion(a.yaw, 0, 1); a.setStrafe(0); a.lookTarget.copy(player); a.lookWeight = 1; return; }
    body.brain.decide(dt);
    const herd = hunt.herds[body.herd]; if (herd !== undefined) hunt.updateHerd(herd);
  };
  /** TickScheduler.interrupt's wake (AnimalManager.spawnAnimal's onInterrupt): decide now, whatever the clock. */
  const wake = (i: number): void => {
    const body = bodies[i], a = body?.actor ?? null;
    if (body === undefined || a === null || !a.alive) return;
    runBrain(body, a, due(i, a, true));
  };
  // AnimalManager.damaged: a fauna body's hit reaction (a kill clears its timer); a hit that doesn't kill wakes its brain
  host.events.on('damage.dealt', ({ req, killed }) => {
    const i = bodies.findIndex(b => b.actor !== null && b.brain === null && b.actor.combatActor() === req.target), a = bodies[i]?.actor ?? null;
    if (a === null) return;
    if (killed) { hunt.died(a); return; }
    hunt.hurt(a); wake(i);
  }, host.scope);
  const keep = (): void => { host.onStep(ISLAND_STEP, dt => {
    // the coconuts' bodies after the host's world step (Bodies' fixed 'post' phase)
    service.post(dt);
    // the last frame's charge contacts, after its bodies moved (the host steps its bodies after every system), against the
    // player where that frame saw it
    if (tracked.seen) for (let i = 0; i < BODY_COUNT; i++) {
      const body = bodies[i], a = body?.actor ?? null;
      if (a !== null && body?.brain === null && a.state === 'charge' && a.alive && !a.stunned) hunt.chargeContact(a, tracked.prev);
    }
    hunt.beginTick(dt); tracked.clock += dt;
    // the player's ground speed is the noise they make (AnimalManager.update)
    if (!tracked.seen) { tracked.prev.copy(player); tracked.seen = true; }
    const moved = Math.hypot(player.x - tracked.prev.x, player.z - tracked.prev.z);
    tracked.prev.copy(player);
    tracked.speed += (Math.min(moved / dt, 9) - tracked.speed) * (1 - 0.5 ** (dt * 10));
    hunt.resetRepaths();
    hunt.tokens.sweep(still);
    for (let i = 0; i < BODY_COUNT; i++) {
      const body = bodies[i], a = body?.actor;
      if (body === undefined || a === null || a === undefined) continue;
      // a hunter that loses its line to the player decides at once
      if (a.alive && a.aggressive && (a.state === 'charge' || a.state === 'stalk' || a.state === 'alert')) {
        const clear = reach(a, player);
        if (sight[i] === true && !clear) wake(i);
        sight[i] = clear;
      }
      const brainDt = due(i, a, false);
      if (brainDt > 0) runBrain(body, a, brainDt);
    }
    for (let i = 0; i < BODY_COUNT; i++) {
      const body = bodies[i], a = body?.actor ?? null;
      if (body === undefined || a === null || !a.alive || a.stunned) continue;
      if (body.brain === null) { if (a.state === 'charge') hunt.advanceCharge(a, dt, player); } else body.brain.move(dt);
    }
    // the coconuts strike, land and rest (Enemies.update), then their bodies ready the next world step ('pre')
    volley.step(dt, 1, player);
    service.pre(dt);
    const crab = practice.body?.actor ?? null;
    if (crab === null || crab.alive || practice.body === null) return;
    practice.dead += dt;
    if (practice.fade >= 0) practice.fade += dt;
    if (practice.dead < PRACTICE_BACK || Math.hypot(player.x - PRACTICE_AT.x, player.z - PRACTICE_AT.z) < PRACTICE_AWAY) return;
    if (practice.fade < 0) { practice.fade = 0; return; }
    if (practice.fade >= SHELL_FADE) replacePractice(practice.body);
  }, {
    snapshot: () => ({ version: 3, rng: { ...rng.snapshot() },
      coconuts: { rng: { ...placed.stream.snapshot() }, ...volley.snapshot(th => bodies.findIndex(b => b.actor === th)) }, tokens: bodies.flatMap(b => b.actor !== null && hunt.tokens.enabled && hunt.tokens.holds(b.actor) ? [b.id] : []),
      fauna: { clock: tracked.clock, speed: tracked.speed, prev: tracked.seen ? [tracked.prev.x, tracked.prev.y, tracked.prev.z] as [number, number, number] : null,
        memories: bodies.map(b => { const m = b.actor === null || b.brain !== null ? undefined : hunt.memory(b.actor); return m === undefined ? null : memoryData(m); }), sight: [...sight] },
      herds: hunt.herds.map(h => [h.cx, h.cz] as [number, number]), clocks: [...last].map((t, i) => [t, elapsed[i] ?? 0, credit[i] ?? 0] as [number, number, number]), practice: { dead: practice.dead, fade: practice.fade }, ids: entityIds.snapshot(),
      bodies: bodies.map(b => ({ id: b.id, live: b.actor !== null, policy: b.brain === null ? null : JSON.stringify(b.brain.snapshot()) })) }),
    restore: value => {
      const state = v.parse(Saved, value);
      if (state.bodies.length !== bodies.length || state.herds.length !== hunt.herds.length || state.clocks.length !== BODY_COUNT
        || state.fauna.memories.length !== BODY_COUNT || state.fauna.sight.length !== BODY_COUNT
        || state.bodies.some((b, i) => { const body = bodies.at(i); return body === undefined || b.id !== body.id || b.live !== (body.actor !== null); })) throw new Error('Incompatible Driftwood island continuation');
      const holders = state.tokens.map(id => { const a = bodies.find(b => b.id === id)?.actor ?? null; if (a === null) throw new Error('Unknown Driftwood token holder'); return a; });
      placed.stream.restore(state.coconuts.rng);
      reattach = volley.restore(state.coconuts, i => bodies[i]?.actor ?? null);
      rng.restore(state.rng); practice.dead = state.practice.dead; practice.fade = state.practice.fade; entityIds.restore(state.ids);
      hunt.tokens.clear(); holders.forEach(a => { hunt.tokens.take(a); });
      state.clocks.forEach(([t, e, c], i) => { last[i] = t; elapsed[i] = e; credit[i] = c; });
      state.herds.forEach(([cx, cz], i) => { const herd = hunt.herds[i]; if (herd !== undefined) { herd.cx = cx; herd.cz = cz; } });
      state.bodies.forEach((b, i) => { if (b.policy !== null) bodies[i]?.brain?.restore(v.parse(v.string(), JSON.parse(b.policy))); });
      // the hunting brain's world clock from 0 (its path re-plan timers run on it), the speed meter, sight and memories
      hunt.beginTick(state.fauna.clock); tracked.clock = state.fauna.clock; tracked.speed = state.fauna.speed;
      tracked.seen = state.fauna.prev !== null; if (state.fauna.prev !== null) tracked.prev.set(...state.fauna.prev);
      state.fauna.sight.forEach((seen, i) => { sight[i] = seen; });
      state.fauna.memories.forEach((m, i) => {
        const a = bodies[i]?.actor ?? null, memory = a === null ? undefined : hunt.memory(a);
        if ((m === null) !== (memory === undefined || bodies[i]?.brain !== null)) throw new Error('Incompatible Driftwood fauna memory');
        if (m !== null && memory !== undefined) Object.assign(memory, { ...m, path: m.path.map(p => new Vector3(...p)) });
      });
    },
    // the restored world holds the coconuts' native bodies: a body service over it adopts them by handle
    physicsRestored: () => { service = new Bodies(host.physics, player); reattach?.(); reattach = null; },
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
    // a fauna body's memory: the keeper's restore overwrites it and the stream it drew from
    if (body.actor !== null && FAUNA.has(body.kind)) hunt.adopt(body.actor, recipe.at.x, recipe.at.z);
  };
  // the roster's identities and recipes: the fauna's baked, the enemies' placed (their draws come from the saved bodies)
  fauna.forEach(actor => { bodies.push(faunaBody(actor)); });
  placed.enemies.forEach((row, i) => {
    const id = `creature:${String(fauna.length + i)}`, baked = bake.actors.find(a => a.id === id);
    if (baked === undefined) throw new Error(`Missing baked Driftwood enemy ${id}`);
    const body = enemyBody(id, row.kind, baked.variant, row.herd < 0 ? -1 : row.herd + herdBase, row, row.yaw);
    bodies.push(body); if (row.practice === true) practice.body = body;
  });
  // the practice slot's herd is the newest herd of one once it has been replaced
  const slot = practice.body;
  if (slot !== null && keeper.herds.length > bake.herds.length) slot.herd = keeper.herds.length - 1;
  // ... under the entity id it was given
  const slotId = slot === null ? undefined : keeper.bodies[bodies.indexOf(slot)]?.id;
  if (slot !== null && slotId !== undefined) { slot.id = slotId; slot.recipe.id = slotId; }
  // The host snapshots its adapters in registration order: the load-time bodies sit before the keeper's step, a body
  // spawned in play (a new practice crab) after it, and after the runtime's later steps. Reinstall each at its own point.
  const step = ids.indexOf(ISLAND_STEP), first = ids.findIndex((id, i) => i > step && !id.startsWith('runtime.actor.'));
  const live = bodies.filter((_, i) => keeper.bodies[i]?.live === true).sort((a, b) => at(a.id) - at(b.id)), deferred: IslandBody[] = [];
  live.forEach(body => { if (at(body.id) < step) reinstall(body); });
  keep();
  live.forEach(body => { if (at(body.id) > step) { if (first === -1 || at(body.id) < first) reinstall(body); else deferred.push(body); } });
  return { bodies: () => bodies, hunt, settle: () => { deferred.forEach(reinstall); deferred.length = 0; } };
}
