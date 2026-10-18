import { installPopulationEnvironment, populationEnvironment } from '@wildshard/game/population/environment';
import { speciesBrains } from '@wildshard/sdk/speciesBrains';
import type { SpeciesPrograms } from '@wildshard/format/speciesPrograms';
import { createNativeHunt, type SpeciesDecisionAuthority } from '@wildshard/game/plugin/brain';
import { NativeManager } from '@wildshard/game/population/nativeManager';
import { admitNativeRosterServices, createNativeCreatureRoster, orderedNativeReinstall, type NativeCreatureSlot } from '@wildshard/game/shardfile/homeKeeper';
import { createNativeCreaturePoses, stepCreatureLift } from '@wildshard/game/plugin/animation';
import { numericCreaturePose } from '@wildshard/game/plugin/channelPrograms';
import crabClips from '../data/crabClips.generated.json' with { type: 'json' };
import sailorClips from '../data/sailorClips.generated.json' with { type: 'json' };
import captainClips from '../data/captainClips.generated.json' with { type: 'json' };
import type { AnimalRigContext } from '@wildshard/engine/entities/animalRig';
import { MonkeyBinding } from '../species/monkeyBinding';
import { clearBody } from '@wildshard/engine/entities/bodyClear';
import * as v from 'valibot';
import { Vector3 } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import type { AnimalSim, AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { ATTACK_TURN, type HuntBody, type HuntNav, type HuntSpecies } from '@wildshard/engine/ai/hunt';
import { Bodies, RowBodySlots, type BodyLaunchRow } from '@wildshard/engine/physics/bodies';
import type { SimHost } from '@wildshard/engine/sim';
import type { SimSnapshot } from '@wildshard/engine/sim/snapshot';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { enemyBrain, type EnemyBrain } from './enemyBrains';
import type { DriftwoodBake, NativeEnemyPlacements, NativeKeeperRows } from './baked';
import { RespawnQueue } from '@wildshard/sdk/populationRespawn';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import { ReturnGate } from '@wildshard/game/population/respawn';

const poseSailor = numericCreaturePose(sailorClips);

/** The island keeper's fixed-step id; its continuation also names the live roster to reinstall before restore. */
export const ISLAND_STEP = 'driftwood.island';
/** The load-time roster (13 fauna + 21 enemies). */
const BODY_COUNT = 34;
/** The native roster bound, including ecological returns and the captain in his reserved slot. */
const ROSTER = 256; // bounded native ecology roster, captain fixed in slot 34
/** The captain's one variant's scale range (species/captain.ts; the headless test holds them equal). */
export const CAPTAIN_SCALE: readonly [number, number] = [1.35, 1.35];
/** AnimalView.fadeOut: a dead practice crab's shell fades 1.5 s before the new one is placed (Enemies.tickPractice). */
const SHELL_FADE = 1.5;
/** AnimalManager ANIM_LOD: the shipping rig leaves its pose/root transition frozen beyond this range. */
const ANIM_LOD = 140;
/** The island's fauna kinds: the manager's hunting brain decides for them (the enemies run their own policies). */
const FAUNA = new Set(['boar', 'bear']);
/** What a renderer-free body adds for the hunting brain: never hidden (no view), no ground tilt to sample. */
const POSE_CALLBACKS = new Map([['crab', numericCreaturePose(crabClips)], ['sailor', (c: AnimalRigContext) => { stepCreatureLift(c.animal, c.dt, 1.5, 1.5, -2.3, 6); poseSailor(c); }], ['captain', numericCreaturePose(captainClips)]]);

/** One body of the island: its id, kind / variant, label, herd slot (−1: none) and recipe; `actor` is null once retired. */
export interface IslandBody extends NativeCreatureSlot { brain: EnemyBrain | null }
export interface IslandPorts {
  readonly monkey: unknown;
  readonly decisions: SpeciesDecisionAuthority;
  readonly population: SpeciesPrograms;
  readonly launch: BodyLaunchRow;
  readonly placement: NativeEnemyPlacements;
  readonly fauna: ReadonlyMap<string, HuntSpecies>;
  readonly keeper: NativeKeeperRows;
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
const Point = v.tuple([finite, finite, finite]);
/** HuntMemory as plain data (its path corners as points) */
const Memory = v.strictObject({ timer: finite, tx: finite, tz: finite, fleeT: finite, fleeUntil: finite, chargeCd: finite, callT: finite, awareness: finite,
  freeze: finite, spooked: v.boolean(), wary: finite, sensed: v.boolean(), windup: finite, backoff: finite, side: finite, committed: v.boolean(),
  path: v.array(Point), pathI: finite, goalX: finite, goalZ: finite, repathAt: finite });
/** a coconut collider's owner tag (plain data: the host's snapshot encodes collider owners) */
const COCONUT_OWNER = { kind: 'coconut' } as const;
const Respawn = v.strictObject({ kind: v.string(), variant: v.string(), herd: finite, x: finite, z: finite, due: finite, night: v.boolean(), id: v.string() });
const savedSchema = (count: number) => {
  const Slot = v.strictObject({ k: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(count - 1)), state: v.picklist([1, 2]), rest: finite, age: finite,
    thrower: v.pipe(v.number(), v.integer(), v.minValue(-1), v.maxValue(ROSTER - 1)), handle: finite, wet: finite });
  return v.strictObject({ version: v.literal(8), rng: Stream, ecology: v.strictObject({ now: finite, check: finite, pending: v.pipe(v.array(Respawn), v.maxLength(ROSTER)) }),
  coconuts: v.strictObject({ rng: Stream, next: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(count - 1)), slots: v.array(Slot) }),
  fauna: v.strictObject({ clock: finite, speed: finite, prev: v.nullable(Point), memories: v.array(v.nullable(Memory)), sight: v.array(v.nullable(v.boolean())) }), tokens: v.array(v.string()), herds: v.array(v.tuple([finite, finite])),
  bodies: v.array(v.strictObject({ id: v.string(), kind: v.string(), variant: v.string(), herd: finite, live: v.boolean(), pose: v.nullable(v.string()), policy: v.nullable(v.string()) })),
  captain: v.nullable(v.strictObject({ id: v.string(), pose: v.string(), policy: v.union([v.boolean(),v.string()]) })),
  practice: v.strictObject({ dead: finite, fade: finite }), ids: v.strictObject({ next: v.pipe(v.number(), v.integer(), v.minValue(0)), used: v.array(v.string()) }) });
};

/**
 * Driftwood Isle's creatures in a renderer-free host (SF72), as the shipping AnimalManager and creatures/Enemies.ts keep
 * them. The 13 fauna (four sounders and two bears) come from their baked recipes at the spawns, yaws and herd centres
 * their anchor searches drew off the creature stream `Rng(seed + 31)` (sim/keeper.json); each fauna body's memory takes
 * the three draws after its seed (HuntBrain.adopt), and the stream then stands exactly past those 148 draws. The 21
 * enemies are placed by `placeEnemies` (crab groups, the practice crab, three monkey troops, the sailor in the hold), each
 * with the manager's spawn draws from that stream (a monkey's variant roll, then scale, rig seed, body seed, and the three
 * memory draws: timer, fleeUntil, callT). Every body stands on the manager's creature floor: the first WORLD hit under its
 * spawn ray, the terrain when that is the ground's heightfield; a body on a structure keeps the layered floor under its
 * feet; every body's turn is capped while it attacks (a melee shard). The herds are the manager's hunting brain's
 * (`HuntBrain`, src/engine/ai/hunt.ts), in its order: the fauna's, then the enemies' at their `addHerd` points.
 *
 * The host runs on the page's distance bands (`useBodyBands`, engine/sim/bands.ts; set before any spawn, and on a
 * restoring host before the host restores its clocks): each body decides on its 'ai' brain clock (`brainDt`: 20 Hz within
 * 60 m, 10 Hz to 160 m, paused beyond; 'always' while a crab sidesteps), moves on its body clock (`bodyDt`: every frame
 * within 60 m, every other frame with both frames' time to 160 m, paused beyond), and holds the page's creature capsule
 * only within 45 m (released past 55 m). An interrupt decides at once (`brainDt(id, true)`, a zero step when the body
 * already decided this frame): a hunter that loses its line to the player, a fauna body hit without dying. The fauna decide through the hunting brain (the island's boar and bear rows, the manifest's fauna tuning,
 * the browser's baked navmesh for paths and wander targets, the manager's smoothed player speed), charge on the body
 * tick and land a charge as PlayerHurt.creature's blow; a hit turns, bolts or enrages them. The enemies run their
 * shipping policies (species/enemyBrains.ts) and strike every tick, steering and confined through the hunting brain over
 * the island (the baked floor, its normals, the open sea, no trees, no cabins). Every body holds the manager's two E297
 * attack tokens (swept when an attack is over). The practice crab comes back 45 s after it dies once the player is 30 m
 * off, after its 1.5 s shell fade: a fresh body in its slot (the manager's next entity id, six more draws), a new herd of one. A
 * monkey's throw releases a real coconut (combat/coconuts.ts, the browser's own rules) into the host's world through a
 * body service stepped around the host's world step; the continuation keeps each live slot and its native handle, and the
 * restored world's bodies are adopted back by handle. The finale's captain (`spawnCaptain`, combat/captainEncounter.ts) joins the
 * end of the list in the slot after the load-time bodies: the manager's next entity id, his spawn draws, his baked recipe
 * at his pool, his authored fight on the 'legacy' clock. Restore reinstalls exactly the saved roster (the captain
 * included) from its recipes before the host restores, with no stream draw kept.
 *
 * Ecology follows quest/Ecology.ts: ordered deaths queue the same variants at their herd homes on the separate spawn
 * stream; the once-a-second check waits for 60 m clearance and the sailor's night gate. Returns take the manager's next
 * id and creature draws. The queue, clocks, extended roster and allocator restore exactly (bounded to 256 native slots).
 *
 * Contact order is the page's per-body order: act, motion, sailor root transition, charge contact and native body clear.
 * The coconuts float on the swell at the host clock (the browser's ocean clock starts with its view).
 */
export function installIsland(host: SimHost, ports: IslandPorts, saved?: Readonly<SimSnapshot>): {
  bodies: () => readonly IslandBody[];
  hunt: ReturnType<typeof createNativeHunt>['hunt'];
  /** The finale's captain (null until spawned). */
  captain: () => HuntBody | null;
  /** AnimalManager.spawn of the captain at his pool (the finale's spawn): the manager's next entity id and spawn draws, the
   *  creature floor, his authored fight; at the end of the manager's list. Once. */
  spawnCaptain: () => HuntBody;
  /** AnimalManager's 'weapon.fired' wake (interruptTargets 'target.attack'): every live aggressive or sensing body decides
   *  now (the captain, a self-thinking species with no `tick`, is never interrupted). */
  alarm: () => void;
  /** AnimalManager.staggered: a blow's stagger on a fauna body reaches the hunting brain (a self-thinking species holds). */
  staggered: (a: AnimalSim, strength: number, running: boolean) => void;
  /** On restore, reinstall the bodies spawned in play after every other install-time registration (no-op when fresh). */
  settle: () => void;
  /** Publish only after body contacts and equipment, at the page render boundary. */
  publishPoses: () => void;
} {
  const { program, hunt: settings, spawns } = ports.population;
  const monkey = new MonkeyBinding(ports.monkey, host);
  const Saved = savedSchema(ports.keeper.volley.count);
  const practiceRule = spawns?.find(row => row.id === 'spawn.driftwood.practice')?.respawn;
  if (program === undefined || settings === undefined || practiceRule === undefined) throw new Error('Driftwood requires its admitted creature recipes');
  const brains = speciesBrains(program.species, program.strikes, program.modules);
  const contact = program.strikes.find(row => row.id === 'strike.monkey.coconut'), bite = program.strikes.find(row => row.id === 'strike.monkey.bite');
  if (contact === undefined || bite === undefined) throw new Error('Driftwood requires its admitted monkey contacts');
  const biteStrike = strikeFromData(bite);
  // Refusals are cold-created along with the recipe pool; the step itself allocates nothing.
  const FULL_ROSTER = new Error('Driftwood ecology roster exceeds its native bound');
  const { bake, specs, keeper: roster } = ports, rng = new Rng(ports.seed + 31), bodies: IslandBody[] = [], heightAt = bake.floorAt, player = host.player.position;
  // the page's distance bands (AnimalManager.tickRate): 'ai' for every body (crab, sailor and monkey declare `tick: 'ai'`,
  // the fauna's default), 'always' while a crab sidesteps, the creature manager's 'legacy' for the captain (a self-thinking
  // species with no `tick`: 10 Hz decisions, the body every frame at any distance); and the creature body LOD. Before any spawn.
  installPopulationEnvironment(host, { res: Math.sqrt(bake.ground.heights.length), size: bake.ground.scale.x, heights: bake.ground.heights }, roster.environment);
  const ground = populationEnvironment(host, roster.environment.id);
  const { hunt, reach } = createNativeHunt(host, settings, { rng, ground, nav: ports.nav, species: ports.fauna });
  const habitat = bake.habitat;
  if (ports.seed !== ports.placement.seed) throw new Error('Enemy placements require their authored seed');
  const PRACTICE_AT = ports.placement.practice, stream = new Rng(0); stream.restore(ports.placement.native.stream);
  const placed = { ...ports.placement.native, stream };
  // the coconuts (combat/coconuts.ts, as Enemies.ts throws them): bodies in the host's world, spun from the placement
  // stream past placement, floating on the sea's swell at the host's clock; a hit is the thrower's blow on the player
  let service = new Bodies(host.physics, player);
  const volley = new RowBodySlots<HuntBody>(roster.volley, service, COCONUT_OWNER, host.physics, host);
  const world = {
    perches: habitat.perches.map(p => new Vector3(p.x, p.y, p.z)), perchBases: habitat.perchBases.map(p => new Vector3(p.x, p.y, p.z)),
    hold: { x: habitat.hold.x, z: habitat.hold.z, r: habitat.hold.r, guardR: habitat.hold.guardR, floorAt: bake.holdFloorAt },
    // a monkey's lob releases a real coconut from the volley
    throwCoconut: (from: Vector3, to: Vector3, thrower: HuntBody): void => { volley.throw(ports.launch, from, to, thrower, placed.stream); },
  };
  const brainPorts = { host, hunt, rng, world, heightAt, waterLevel: ports.waterLevel };
  const callbacks = new Map(POSE_CALLBACKS); callbacks.set('monkey', monkey.animate);
  const poses = createNativeCreaturePoses([...bake.actors, { kind: 'captain', variant: 'captain', pose: bake.captain.pose }], ROSTER, callbacks);
  // the shared native roster (G454 rows): the island's scale tables, any heightfield as the floor, the melee turn cap, the
  // fauna adopted by the hunting brain, every body on the native pose roster
  const intake = createNativeCreatureRoster<IslandBody>(host, {
    specs: specs.values(), variants: new Map(roster.variants.map(row => [row.kind, row.rows])),
    rng, spawnY: ports.spawnY, attackTurnCap: ATTACK_TURN, heightfield: 'any', services: admitNativeRosterServices(host, ISLAND_STEP, hunt, poses), hunted: [...FAUNA] });
  const entityIds = intake.identities;
  for (let i = 0; i < BODY_COUNT; i++) entityIds.allocate();
  /** a body the roster made: a sailor on a deck keeps the hold's floor under his feet; an enemy takes its shipping policy */
  const holdFloor = (x: number, z: number, fromY: number): number => bake.holdFloorAt(x, z) ?? intake.floor(x, z, fromY);
  const join = (body: IslandBody, actor: HuntBody): void => {
    if (body.kind === 'sailor' && actor.levelGround) actor.groundHeight = holdFloor;
    body.brain = FAUNA.has(body.kind) ? null : enemyBrain(body.kind, body.recipe.spec.label, actor, hunt.herds[body.herd]?.members ?? null, brainPorts, brains, ports.decisions, biteStrike, monkey);
  };
  const { draw } = intake;
  const place = (body: IslandBody): void => { join(body, intake.arrive(body)); };
  const enemyBody = (id: string, kind: string, variant: string, herd: number, at: { x: number; z: number }, yaw: number): IslandBody =>
    ({ ...intake.body(id, kind, variant, herd, at, yaw), brain: null });
  const boot = roster.fauna;
  if (roster.seed !== ports.seed) throw new Error('Keeper rows belong to another seed');
  const bootBody = (row: NativeKeeperRows['bodies'][number]): IslandBody => ({ ...intake.body(row.id, row.kind, row.variant,
    row.herd, row, row.yaw, row.fauna ? [row.scale, row.scale] : undefined, row), brain: null });
  roster.herds.forEach(row => { hunt.addHerd(row.kind, row.x, row.z); });
  const practice: { body: IslandBody | null; dead: number; fade: number } = { body: null, dead: 0, fade: -1 };
  /** the finale's captain, once spawned (never retired: his corpse stays), in the roster slot after the load-time bodies */
  let captain: IslandBody | null = null;
  const captainBody = (id: string): IslandBody => ({ ...intake.body(id, 'captain', 'captain', -1, bake.captain.pool, bake.captain.pool.yaw, CAPTAIN_SCALE), brain: null });
  /** roster slot `i`: a load-time body, or the captain after them */
  const rosterAt = (i: number): IslandBody | null => (i === BODY_COUNT ? captain : bodies[i < BODY_COUNT ? i : i - 1]) ?? null;
  /** AnimalManager.stillAttacking: a charger while it charges, a self-thinking species while its strike runs */
  const still = (a: HuntBody): boolean => a.alive && (FAUNA.has(a.kind) ? a.state === 'charge' : a.attackPhase >= 0);
  /** AnimalManager.visibility: whether each aggressive body last had a clear line to the player (null: never asked) */
  const continuation = new NativeManager(host, hunt, rng, { limit: settings.limit, sightSlots: ROSTER, initialSight: null,
    ...(settings.memoryFields === undefined ? {} : { memoryFields: settings.memoryFields }) });
  const sight = continuation.sight;
  /** the manager's smoothed player ground speed, the player where the last step saw it (once one has), and the hunting
   *  brain's world clock */
  const tracked = continuation.noise;
  if (saved === undefined) {
    for (const [i, row] of roster.bodies.entries()) {
      const body = bootBody(row); if (row.stream !== null) rng.restore(row.stream);
      place(body); bodies.push(body); if (row.practice) practice.body = body;
      if (i + 1 === boot.rows.length) intake.adopt(boot.rows, boot.stream);
    }
    if (practice.body === null) throw new Error('Missing practice body');
  }

  /** Enemies.placePracticeCrab: a fresh small crab in the practice slot at the pier's foot, facing down the path, a herd of
   *  one, under the manager's next entity id. */
  const replacePractice = (body: IslandBody): void => {
    join(body, intake.refill(body, PRACTICE_AT));
    // its band clocks start fresh under the new id (host.retire forgot the old one's)
    const i = bodies.indexOf(body); sight[i] = null;
    practice.dead = 0; practice.fade = -1;
  };
  const cadence = hunt.bindRoster({ limit: ROSTER, order: 'interrupt', at: rosterAt, actor: body => body.actor,
    id: body => body.id, player, noise: tracked, sight, reach, brainDt: (id, urgent) => host.brainDt(id, urgent),
    policy: body => body.brain, herd: body => body.herd, beforeDecisions: () => { hunt.tokens.sweep(still); } });
  const wake = cadence.wake;
  host.events.on('damage.dealt', ({ req, killed }) => { cadence.damaged(req.target, killed); }, host.scope);
  // Reusable native recipe slots are cold-allocated; only host.spawn materializes an entity on a due event.
  const extra = Array.from({ length: ROSTER - BODY_COUNT - 1 }, () => enemyBody('', 'crab', 'small', -1, { x: 0, z: 0 }, 0));
  const queue = new RespawnQueue(roster.ecology.rules, roster.ecology.outOfSight, undefined, ReturnProgram.native(host, roster.ecology.program)), ecology = { now: 0, check: 0 };
  const pendingIds = new Map<(typeof queue.pending)[number], string>();
  host.events.on('actor.died', ({ actor }) => {
    const body = bodies.find(b => b.actor?.combatActor() === actor), a = body?.actor;
    if (body === undefined || a === null || a === undefined) return;
    if (queue.pending.length >= ROSTER) throw new Error('Driftwood ecology queue exceeds its native bound');
    const h = hunt.herds[body.herd];
    const entry = queue.accepts(body.kind) ? queue.add(body.kind, body.variant, body.herd, h?.cx ?? a.position.x, h?.cz ?? a.position.z, ecology.now, host.rng.stream('spawn').next()) : null;
    if (entry !== null) pendingIds.set(entry, body.id);
  }, host.scope);
  const respawns = (dt: number): void => {
    ecology.now += dt;
    if (ecology.now - ecology.check < 1) return;
    ecology.check = ecology.now;
    const due = queue.take(ecology.now, player.x, player.z, host.dayClock?.night ?? 0);
    for (let n = 0; n < ROSTER; n++) {
      const entry = due[n]; if (entry === undefined) break;
      const at = queue.place(entry, ecology.now, ports.waterLevel, entry.kind === 'sailor', host.rng.stream('spawn'));
      if (at === null) continue;
      const { x, z } = at;
      if (bodies.length + 1 >= ROSTER) throw FULL_ROSTER;
      const body = intake.retarget(extra[bodies.length - BODY_COUNT], entry.kind, entry.variant, entry.herd, x, z, 'spawn');
      draw(body, !FAUNA.has(body.kind));
      if (body.kind === 'sailor') { body.recipe.at.y = bake.holdFloorAt(x, z) ?? heightAt(x, z); join(body, intake.materialize(body, body.recipe, true)); } else place(body);
      if (FAUNA.has(body.kind)) intake.remember(body);
      const fallen = intake.retireDead(pendingIds.get(entry)); if (fallen !== null) fallen.brain = null;
      pendingIds.delete(entry); bodies.push(body);
    }
  };
  let poseNear = false; // recomputed before each body; never continuation state
  const owned = (id: string, actor: AnimalSim): IslandBody | null => { const body = intake.byId.get(id); return body?.actor === actor ? body : null; };
  host.useBodyStep({
    before: (id, actor, dt) => {
      const body = owned(id, actor), a = body?.actor; if (body === null || a === null || a === undefined) return;
      poseNear = a.position.distanceToSquared(player) < ANIM_LOD * ANIM_LOD;
      if (!a.alive || a.stunned) return;
      if (body.brain === null) { if (a.state === 'charge') hunt.advanceCharge(a, dt, player); }
      else body.brain.move(dt);
    },
    after: (id, actor, dt) => {
      const body = owned(id, actor), a = body?.actor; if (body === null || a === null || a === undefined) return;
      // AnimalView.update moves first, then animateSailor advances its root offset, including dead/stunned bodies within the page animation range.
      poses.get(body.id)?.advance(dt, host.clock.now, poseNear);
      if (a.state === 'charge' && a.alive && !a.stunned) hunt.chargeContact(a, player);
      if (body.brain === null && a.alive && a.position.distanceToSquared(player) < 36) clearBody(a, player);
    },
  });
  const keep = (): void => { host.onStep(ISLAND_STEP, dt => {
    // the coconuts' bodies after the host's world step (Bodies' fixed 'post' phase)
    service.post(dt);
    continuation.advance(dt);
    cadence.observe(dt); cadence.decide();
    // the coconuts strike, land and rest (Enemies.update), then their bodies ready the next world step ('pre')
    volley.update(dt, 1, player);
    for (const effect of volley.takeEvents()) if (effect.kind === 'contact' && effect.source !== null) {
      const th = effect.source;
      host.combat.hit({ source: 'env', sourceTags: ['creature.monkey', 'feel.blow', 'cover.checked'], target: host.player.health,
        amount: contact.damage, moveId: contact.id, point: th.position.clone(), dir: new Vector3(), cause: { kind: th.kind, label: th.label } });
    }
    service.pre(dt);
    respawns(dt);
    const crab = practice.body?.actor ?? null;
    if (crab === null || crab.alive || practice.body === null) return;
    if (ReturnGate.step(practice, { ...practiceRule, fade: SHELL_FADE }, dt, crab.alive,
      Math.hypot(player.x - PRACTICE_AT.x, player.z - PRACTICE_AT.z)) === 'replace') replacePractice(practice.body);
  }, {
    snapshot: () => { const common = continuation.snapshot(bodies.map(body => body.actor === null ? null : body.id),
      bodies.flatMap(body => body.actor !== null && body.brain === null ? [body.id] : [])); return ({ version: 8, rng: common.rng, ecology: { ...ecology, pending: queue.pending.map(entry => ({ ...entry, variant: entry.variant ?? '', id: pendingIds.get(entry) ?? '' })) },
      coconuts: { rng: { ...placed.stream.snapshot() }, ...volley.snapshot(bodies.map(b => b.actor?.entityId ?? '')) },
      tokens: [...bodies, ...(captain === null ? [] : [captain])].flatMap(b => b.actor !== null && hunt.tokens.enabled && hunt.tokens.holds(b.actor) ? [b.id] : []),
      fauna: { clock: common.clock, speed: common.noise.speed, prev: common.noise.seen ? common.noise.prev : null,
        memories: common.memories, sight: common.sight },
      herds: common.herds, practice: { dead: practice.dead, fade: practice.fade }, ids: entityIds.allocatorState(),
      bodies: bodies.map(b => ({ id: b.id, kind: b.kind, variant: b.variant, herd: b.herd, live: b.actor !== null, pose: b.actor === null ? null : poses.get(b.id)?.snapshot() ?? null, policy: b.brain === null ? null : JSON.stringify(b.brain.snapshot()) })),
      captain: captain === null ? null : { id: captain.id, pose: poses.get(captain.id)?.snapshot() ?? '', policy: v.parse(v.union([v.boolean(),v.string()]), captain.brain?.snapshot()) } }); },
    restore: value => {
      const state = v.parse(Saved, value);
      if (state.bodies.length !== bodies.length || state.herds.length !== hunt.herds.length
        || state.fauna.memories.length !== bodies.length || state.fauna.sight.length !== ROSTER || state.captain?.id !== captain?.id
        || state.bodies.some((b, i) => { const body = bodies.at(i); return body === undefined || b.id !== body.id || b.live !== (body.actor !== null); })) throw new Error('Incompatible Driftwood island continuation');
      const holders = state.tokens.map(id => { const a = (captain?.id === id ? captain : bodies.find(b => b.id === id))?.actor ?? null; if (a === null) throw new Error('Unknown Driftwood token holder'); return a; });
      placed.stream.restore(state.coconuts.rng);
      volley.restore(state.coconuts, bodies.map(b => b.actor));
      ecology.now = state.ecology.now; ecology.check = state.ecology.check; queue.pending.length = 0; pendingIds.clear();
      state.ecology.pending.forEach(({ id, ...entry }) => { queue.pending.push(entry); pendingIds.set(entry, id); });
      practice.dead = state.practice.dead; practice.fade = state.practice.fade; entityIds.restoreAllocator(state.ids);
      hunt.tokens.clear(); holders.forEach(a => { hunt.tokens.take(a); });
      state.bodies.forEach(b => { if ((b.pose !== null) !== b.live) throw new Error('Missing Driftwood pose continuation'); if (b.pose !== null) poses.get(b.id)?.restore(b.pose); });
      if (state.captain !== null) poses.get(state.captain.id)?.restore(state.captain.pose);
      state.bodies.forEach((b, i) => { if (b.policy !== null) bodies[i]?.brain?.restore(v.parse(v.string(), JSON.parse(b.policy))); });
      if (state.captain !== null) captain?.brain?.restore(state.captain.policy);
      continuation.restore({ clock: state.fauna.clock, rng: state.rng, noise: { speed: state.fauna.speed, seen: state.fauna.prev !== null,
        prev: state.fauna.prev ?? [0, 0, 0] }, sight: state.fauna.sight, memories: state.fauna.memories, herds: state.herds },
        bodies.map(body => body.actor === null ? null : body.id), bodies.flatMap(body => body.actor !== null && body.brain === null ? [body.id] : []));
    },
    // the restored world holds the coconuts' native bodies: a body service over it adopts them by handle
    physicsRestored: () => { service = new Bodies(host.physics, player); volley.bind(service); },
  }); };
  const spawnCaptain = (): HuntBody => {
    if (captain !== null) throw new Error('The Driftwood captain is spawned once');
    const body = captainBody(entityIds.allocate());
    draw(body); place(body); captain = body;
    if (body.actor === null) throw new Error('The Driftwood captain did not spawn');
    return body.actor;
  };
  const alarm = (): void => {
    for (let i = 0; i < Math.min(ROSTER, bodies.length); i++) { const body = bodies[i], a = body?.actor ?? null; if (a !== null && a.alive && (a.aggressive || hunt.sensed(a))) wake(body); }
  };
  // AnimalManager.interruptTargets('target.dodge'), on the real host dodge press (not every held input tick).
  host.events.on('player.dodge', alarm, host.scope);
  const staggered = (a: AnimalSim, strength: number, running: boolean): void => {
    const body = bodies.find(b => b.actor === a && b.brain === null)?.actor ?? null;
    if (body !== null) hunt.staggered(body, strength, running);
  };
  const publishPoses = (): void => { poses.publish(i => rosterAt(i)?.actor?.entityId); };
  const island = { publishPoses, bodies: () => bodies, hunt, captain: () => captain?.actor ?? null, spawnCaptain, alarm, staggered };
  if (saved === undefined) { keep(); return { ...island, settle: () => undefined }; }

  const keeper = v.parse(Saved, saved.adapters.find(adapter => adapter.id === ISLAND_STEP)?.state);
  if (keeper.bodies.length < BODY_COUNT || keeper.bodies.length >= ROSTER || keeper.herds.length < bake.herds.length) throw new Error('Incompatible Driftwood island continuation');
  // the practice crab's replacements each made a herd of one, in order
  keeper.herds.slice(bake.herds.length).forEach(([cx, cz]) => { hunt.addHerd('crab', cx, cz); });
  const reinstall = (body: IslandBody): void => {
    join(body, intake.reinstall(body, saved));
    // a fauna body's memory: the keeper's restore overwrites it and the stream it drew from
    if (body.actor !== null && FAUNA.has(body.kind)) hunt.adopt(body.actor, body.recipe.at.x, body.recipe.at.z);
  };
  // the roster's identities and recipes: the fauna's baked, the enemies' placed (their draws come from the saved bodies)
  roster.bodies.forEach(row => { const body = bootBody(row); bodies.push(body); if (row.practice) practice.body = body; });
  keeper.bodies.slice(BODY_COUNT).forEach(b => { bodies.push(enemyBody(b.id, b.kind, b.variant, b.herd, { x: 0, z: 0 }, 0)); });
  // the practice slot's herd is the newest herd of one once it has been replaced
  const slot = practice.body;
  if (slot !== null) slot.herd = keeper.bodies[bodies.indexOf(slot)]?.herd ?? slot.herd;
  // ... under the entity id it was given
  const slotId = slot === null ? undefined : keeper.bodies[bodies.indexOf(slot)]?.id;
  if (slot !== null && slotId !== undefined) { slot.id = slotId; slot.recipe.id = slotId; }
  // The host snapshots its adapters in registration order: the load-time bodies sit before the keeper's step, a body
  // spawned in play (a new practice crab) after it, and after the runtime's later steps. Reinstall each at its own point.

  // the captain, if the finale spawned him, under the id he was given
  if (keeper.captain !== null) captain = captainBody(keeper.captain.id);
  const live = [...bodies.filter((_, i) => keeper.bodies[i]?.live === true), ...(captain === null ? [] : [captain])];
  return { ...island, settle: orderedNativeReinstall(saved, ISLAND_STEP, live, reinstall, keep) };
}
