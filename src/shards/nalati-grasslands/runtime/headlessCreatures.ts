import ecology from '../data/ecology.generated.json' with { type: 'json' };
import { createNativeHunt, createNativeSpeciesContext } from '@wildshard/game/plugin/brain';
import type { DirectorLane } from '@wildshard/game/plugin/director';
import { NativeManager } from '@wildshard/game/population/nativeManager';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import { admitNativeRosterServices, createNativeCreatureRoster, type NativeCreatureSlot } from '@wildshard/game/shardfile/homeKeeper';
import * as v from 'valibot';
import { ForagerContinuation as MarmotContinuation } from '@wildshard/format/ambientLife';
import { marmotColonies } from '../creatures/marmotBrain';
import { Vector3 } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import type { SimHost } from '@wildshard/engine/sim';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { ATTACK_TURN, type HuntBody, type HuntGround, type HuntNav, type HuntSpecies, type HuntTree } from '@wildshard/engine/ai/hunt';
import type { StalkerBrain } from '@wildshard/engine/ai/stalker';
import { canReach } from '@wildshard/engine/ai/reach';
import { bakedSamplers, type BakedGrid } from '@wildshard/engine/world/BakedTerrain';
import type { PackBrain } from '@wildshard/engine/ai/pack';
import type { HerdBrain } from '@wildshard/engine/ai/herd';
import { WOLF_SPECIES } from '../species/wolf';
import { KOKBORI, KOKBORI_SPECIES } from '../species/kokbori';
import { nativeBodySpecSchema } from '@wildshard/sdk/headlessRuntime';
import { SpeciesSchema } from '@wildshard/format/speciesPrograms';
import { HORSE_SPECIES } from '../species/horse';
import { LEOPARD_SPECIES } from '../species/leopard';
import { FlockBrain, type FlockPorts } from '@wildshard/engine/ai/flock';
import { parseFlock } from '@wildshard/format/crowds';
import { SHEEPDOG_SPECIES, setDogFlock, thinkSheepdog } from '../species/sheepdog';
import { argymaqDefinition } from '../combat/eliteRoster';
import { SEED, TERRAIN } from '../world/terrain';
import { nalatiWetAt } from '../wet';
import { pushWildMovers } from '../look/trampleMovers';
import { KNOCKDOWN_TIME, knockdownDash } from '../creatures/knockdown';
import { actHorseBody, actWolfBody, decideHorse, decideWolf, horseHeld } from './groupDispatch';
import type { SimSnapshot } from '@wildshard/engine/sim/snapshot';
import type { NalatiBake, NalatiBootHerd, NalatiBootRows } from './baked';
import { withOwner } from '@wildshard/engine/app/ownership';
import { CharacterMotor } from '@wildshard/engine/physics/CharacterMotor';
import { creatureBodyDistance, keepsCreatureBody } from '@wildshard/engine/sim/bands';
import { HeadlessSheepRaid } from './headlessRaid';
import type { NalatiGroups } from './groups';
import type { NalatiBody } from './headless';
import type { EliteBindings } from '@wildshard/game/shardfile/eliteEncounters';

/** The creatures' fixed-step id (its continuation's adapter). */
export const NALATI_CREATURES_STEP = 'nalati.creatures';
/** The level's chunk half (m): the hunting brain's hard clamp (core/config.ts CHUNK_HALF). */
const CHUNK_HALF = 250;
/** Bounds for the frame loops: the manager's load-time list (35 bodies), the declared groups (a pack, two herds), the flocks. */
const BODY_MAX = 64, GROUP_MAX = 8, FLOCK_MAX = 4;

/** A renderer-free manager body: Wildlife may hide it on retirement; no view or ground tilt is sampled. */
export type NalatiHuntBody = AnimalSim & HuntBody & { hidden: boolean };

/**
 * Nalati's creature rows as the manager's hunting brain reads them (HuntConfig.species), renderer-free: the shipping wolf,
 * horse, leopard and sheepdog rows and Argymaq's (combat/eliteRoster.ts, from the horse's stallion, as the elites register it).
 */
export function nalatiHuntSpecies(): ReadonlyMap<string, HuntSpecies> {
  const stallion = HORSE_SPECIES.variants.find(variant => variant.id === 'stallion');
  if (stallion === undefined) throw new Error('Nalati horse has no stallion');
  const rows = new Map<string, HuntSpecies>([['wolf', WOLF_SPECIES], [KOKBORI, KOKBORI_SPECIES], ['horse', HORSE_SPECIES], ['leopard', LEOPARD_SPECIES], ['sheepdog', SHEEPDOG_SPECIES], [ecology.argymaq, argymaqDefinition(HORSE_SPECIES, stallion)]]);
  return rows;
}

/** The hunting brain's ground as the page's manager builds it over Nalati's level (AnimalManager's HuntGround): the baked grid
 *  the page installs, Nalati's terrain field's trails, cabins, water and stream, its walkers' water (wet.ts) and the forest. */
export function nalatiHuntGround(grid: BakedGrid, trees: (x: number, z: number, r: number) => readonly HuntTree[]): HuntGround {
  const s = bakedSamplers(grid), stream = TERRAIN.streamAt;
  return {
    heightAt: s.heightAt, normalY: (x, z) => s.normalAt(x, z)[1], trailDistance: TERRAIN.trailDistance, cabinMask: TERRAIN.cabinMask,
    inChunk: (x, z, margin) => Math.abs(x) <= CHUNK_HALF - margin && Math.abs(z) <= CHUNK_HALF - margin,
    streamAt: (x, z) => stream === undefined ? null : stream(x, z), waterLevel: () => TERRAIN.waterLevel(), pond: () => TERRAIN.pond,
    // the river is a basin body (manifest.ts ground.water), not an open sea
    sea: () => false, wetAt: nalatiWetAt, trees, treeless: () => false, terrain: () => true, chunkHalf: CHUNK_HALF,
  };
}

const finite = v.pipe(v.number(), v.finite());
const SpawnTable = v.pick(SpeciesSchema, ['kind', 'variants', 'spawnOnly']);
const Stream = v.strictObject({ version: v.literal(1), state: finite, initial: finite, scrambledFork: v.boolean() });
const Memory = v.record(v.string(), v.union([finite, v.boolean(), v.array(v.tuple([finite, finite, finite]))]));
const RaidBody = v.strictObject({ id: v.string(), variant: v.string(), seed: finite, scale: finite,
  at: v.tuple([finite, finite, finite]), yaw: finite, adopted: Stream });
const EliteSpawn = v.strictObject({ body: RaidBody, kind: v.picklist(['leopard', 'kokbori']) });
const BondedSpawn = v.strictObject({ body: RaidBody, argymaq: v.boolean() });
const RaidPack = v.strictObject({ x: finite, z: finite, herd: v.pipe(finite, v.integer()), bodies: v.array(RaidBody) });
const Saved = v.strictObject({ rng: Stream, clock: finite, speed: v.strictObject({ init: v.boolean(), x: finite, z: finite, v: finite }),
  seen: v.array(v.boolean()), memories: v.array(v.tuple([v.string(), Memory])), herds: v.array(v.tuple([finite, finite])),
  // the declared groups' continuations (PackBrain / HerdBrain `snapshot()`), packs then herds: they decide on this step
  groups: v.array(v.string()),
  // Wildlife's own smoothed player speed (the flocks read it) and the flocks' continuations (FlockBrain `snapshot()`)
  wild: v.strictObject({ init: v.boolean(), x: finite, z: finite, v: finite }), flocks: v.array(v.string()),
  marmots: MarmotContinuation, placement: Stream, raids: v.array(RaidPack), elitePacks: v.array(RaidPack), dormant: v.array(v.string()), elites: v.array(EliteSpawn),
  bonded: v.exactOptional(v.pipe(v.array(BondedSpawn), v.maxLength(1))), hiddenStallions: v.exactOptional(v.pipe(v.array(v.string()), v.maxLength(2))),
  retired: v.array(v.string()), nextId: v.pipe(finite, v.integer(), v.minValue(0)), dodgeCd: v.pipe(finite, v.minValue(0)) });
type SavedMemory = v.InferOutput<typeof Memory>;

/** The host's creatures, for its tests: the hunting brain over the manager's stream and the bodies it decides for, the
 *  flocks, and Wildlife's `scare` (a lightning strike's: the packs break, the herds stampede, the flocks bolt). */
export interface NalatiHostCreatures {
  readonly hunt: StalkerBrain<NalatiHuntBody>; readonly rng: Rng; readonly bodies: readonly NalatiHuntBody[]; readonly flocks: readonly FlockBrain[];
  readonly scare: (x: number, z: number, r?: number) => void;
  readonly raid: HeadlessSheepRaid; readonly marmots: ReturnType<typeof marmotColonies>;
  readonly spawnElite: (kind: 'leopard' | 'kokbori', x: number, z: number, yaw: number, variant: string) => NalatiHuntBody;
  /** Adoption uses the existing manager stream and identity allocator, followed by the shipping place/scale order. */
  readonly spawnBondedHorse: (x: number, z: number, yaw: number, argymaq: boolean) => NalatiHuntBody;
  readonly retireBondedHorse: (a: AnimalSim) => void;
  readonly hideTamedStallion: (a: AnimalSim) => void;
  readonly bondedHorseIds: () => readonly string[];
  readonly retireElite: (a: AnimalSim) => void;
  /** The dusk keeper uses the actual five-member placement/pack policy, including the deferred dark canid recipe. */
  readonly spawnElitePack: (x: number, z: number, variants: readonly string[]) => PackBrain<AnimalSim>;
  readonly retirePack: (pack: PackBrain<AnimalSim>) => void;
}
const installed = new WeakMap<SimHost, NalatiHostCreatures>();
/** The creatures installed into `host`, or undefined. */
export function nalatiCreaturesOf(host: SimHost): NalatiHostCreatures | undefined { return installed.get(host); }

/**
 * The creature manager's and Wildlife's frame on the host's fixed step (SF72), after the grass and the weather (the page's
 * worldUpdate order, then `engine.creatures.update`):
 *
 * - Wildlife's frame (creatures/wildlife.ts `update`): the player's heading and health into the wild view (the host's player
 *   stands, on foot), Wildlife's own smoothed player speed and living wolves, the moving wolves, horses and dog part the grass
 *   (look/trampleMovers.ts `pushWildMovers`, the page's one law), the flocks step (engine/ai/flock.ts FlockBrain: their own
 *   seeds, 'ai' band clock and continuation), and a stampeding herd scares every pack within 20 m of its centre.
 * - The manager's think loop (AnimalManager.update): its smoothed player speed, the hunting brain's clock (engine/ai/hunt.ts
 *   over the manager's own stream, `Rng(SEED + 31)` continuing from the boot roster, every body's memory adopted where the page
 *   adopted it), then in list order a 'lost.sight' wake for a hunter that loses its line to the player and each body's decision
 *   on its band's brain clock (`brainDt`): a wolf by its pack, the flock's dog by the one sheepdog rule (species/sheepdog.ts)
 *   and a free horse (Argymaq too) by its herd (runtime/groupDispatch.ts, the page's rules), on a ThinkCtx with the brain's navmesh steering (`navSteer`), its paths and confine, the herd's centre
 *   easing after.
 * - Each body's step (`useBodyStep`): its `act` before it moves (a committed lunge or charge), and after it, on this melee
 *   shard, a running charge's contact (`chargeContact`); a creature's blow is the page's PlayerHurt.creature (`feel.blow`).
 *
 * A stampede runs through the player on foot on the bodies' own capsules (`passThroughPlayer`), and a knock-down (the stallion's
 * charge, a stampede) dashes the host's player along the blow (creatures/knockdown.ts, `SimHost.dashPlayer`, the page's
 * `Player.dash`); the creatures' signals are the page's `creature.signal` event; `scare` is Wildlife's (a lightning strike's).
 * The raid's shipping clock and shepherd ring run between Wildlife and thinking, including deferred native valley packs.
 * The Aqbars binding comes from the native EliteCore; a dodge wakes targets before the ordinary decision loop.
 * A weapon's 'target.attack' wake still waits for the real weapon host (the probe is not a weapon).
 */
export function installNalatiCreatures(host: SimHost, ports: { boot: NalatiBootRows; bodies: readonly NalatiBody[]; herds: readonly NalatiBootHerd[]; groups: NalatiGroups; grid: BakedGrid; nav: HuntNav;
  trees: (x: number, z: number, r: number) => readonly HuntTree[]; stream: ReturnType<Rng['snapshot']>;
  raidDirector: DirectorLane; wildStream: ReturnType<Rng['snapshot']>; bake: NalatiBake; spawnY: number; elites: EliteBindings; rideUpdate?: (dt: number) => void; mounted?: () => boolean; crouching?: () => boolean; snapshot?: Readonly<SimSnapshot> }): NalatiHostCreatures {
  const { groups } = ports, player = host.player.position, env = groups.env;
  const author = ReturnProgram.native(host, ports.boot.admission);
  const rng = new Rng(ports.boot.streamSeed);
  const { hunt } = createNativeHunt(host, { limit: BODY_MAX, fight: { telegraphed: true }, player: 'origin', bands: null,
    hit: { namespace: 'creature', tags: ['feel.blow', 'cover.checked'] } }, {
    rng, ground: nalatiHuntGround(ports.grid, ports.trees), nav: ports.nav, species: nalatiHuntSpecies(),
    wanderGoal: () => { throw new Error('Nalati native wander goal is not modelled'); },
  });
  // the page's index.ts: the packs, the herds and the dog steer round what the navmesh walls off
  hunt.navSteer = true;
  if (ports.bodies.length > BODY_MAX) throw new Error(`Nalati headless hosts at most ${String(BODY_MAX)} manager bodies`);
  // the manager's herds (its hunting brain's), as the boot roster added them
  ports.herds.forEach(h => { hunt.addHerd(h.kind, h.cx, h.cz); });
  const spawnTables = new Map(Object.entries(ports.boot.species).map(([kind, row]) => [kind, v.parse(SpawnTable, row)]));
  const scaleVariants = new Map<string, readonly { readonly id: string; readonly scale: readonly [number, number] }[]>(
    [...spawnTables].map(([kind, row]) => [kind, [...row.variants, ...row.spawnOnly ?? []]]));
  scaleVariants.set(KOKBORI, KOKBORI_SPECIES.variants.map(({ id, scale }) => ({ id, scale })));
  const intake = createNativeCreatureRoster<NativeCreatureSlot>(host, { specs: [...ports.bake.actors.map(row => row.spec), ...ports.boot.recipes],
    variants: scaleVariants,
    rng, spawnY: ports.spawnY, floorOffset: 1, attackTurnCap: ATTACK_TURN, services: admitNativeRosterServices(host, NALATI_CREATURES_STEP, hunt), hunted: 'every' });
  const bodies: NalatiHuntBody[] = ports.bodies.map(({ actor }) => {
    const slot = intake.body(actor.entityId, actor.kind, actor.variant, actor.herd, actor.position, actor.yaw, [actor.scale, actor.scale], actor);
    slot.recipe.at.y = actor.position.y; return intake.attach(slot, actor);
  });
  // every body's memory where the page adopted it (the stream at its three draws)
  intake.adopt(ports.bodies.map(({ boot }) => ({ id: boot.id, seed: boot.seed,
    x: boot.adopted.x, z: boot.adopted.z, stream: boot.adopted.stream })), ports.stream);
  const packOf = new Map<AnimalSim, PackBrain<AnimalSim>>(), herdOf = new Map<AnimalSim, HerdBrain<AnimalSim>>();
  // the groups this step decides for, whose continuations its adapter carries
  const decided = (): readonly (PackBrain<AnimalSim> | HerdBrain<AnimalSim>)[] => [...groups.packs, ...groups.herds];
  groups.packs.forEach(p => { p.members.forEach(m => { packOf.set(m, p); }); });
  groups.herds.forEach(h => { h.members.forEach(m => { herdOf.set(m, h); }); if (h.stallion !== null) herdOf.set(h.stallion, h); });
  // Wildlife's flocks (creatures/wildlife.ts spawnFlock), on the engine's FlockBrain: the shipping flock's own rules (the
  // page's default creatures/flock.ts runs the same spans, test/fixtures/flock-oracle; its declared crowds run FlockBrain), each
  // set up on its own seed as Wildlife builds it, over the page's ground, water and wild view; its dog (the roster's sheepdogs in
  // order, one a flock that has one) thinks on the one sheepdog rule (species/sheepdog.ts) over the host's 'ai' stream
  const floor = bakedSamplers(ports.grid), layout = ecology.wildlife.flocks, rows = ecology.flocks.world.map(row => parseFlock({ ...row, seed: SEED + row.seed }));
  if (rows.length > FLOCK_MAX) throw new Error(`Nalati headless hosts at most ${String(FLOCK_MAX)} flocks`);
  const pushTrample = (x: number, z: number, r: number, st: number, vx: number, vz: number): void => { env.trample(x, z, r, st, vx, vz); };
  const flockPorts: FlockPorts = { heightAt: floor.heightAt, normalY: (x, z) => floor.normalAt(x, z)[1], inBounds: (x, z, margin) => Math.abs(x) <= CHUNK_HALF - margin && Math.abs(z) <= CHUNK_HALF - margin,
    wetAt: nalatiWetAt, playerCrouched: () => env.playerCrouched, grassHeightAt: (x, z) => env.grassHeightAt(x, z), trample: pushTrample, centre: () => undefined };
  // Wildlife's living wolves (its `wolves`: the pack's, in placement order), refreshed every frame (the page's `dogWolves`)
  const wildWolves = bodies.filter(a => a.kind === 'wolf' && packOf.has(a)), wolves: NalatiHuntBody[] = [];
  const dogs = bodies.filter(a => a.kind === 'sheepdog');
  let dogIndex = 0;
  const flocks = rows.map((row, i) => {
    const brain = new FlockBrain(flockPorts, row);
    brain.initialize();
    if (layout[i]?.dog === true) {
      const dog = dogs[dogIndex++];
      if (dog === undefined) throw new Error(`Nalati flock ${String(i)} has no dog in the roster`);
      brain.dog = dog;
      setDogFlock(dog, { flock: brain, wolves, rng: host.rng.stream('ai'), bark: () => undefined }, author);
    }
    return brain;
  });
  const marmots = marmotColonies(SEED);
  marmots.restore(ports.bake.marmots);
  const whistle = (x: number, z: number): void => {
    for (let i = 0; i < GROUP_MAX; i++) {
      const h = groups.herds[i]; if (h === undefined) break;
      for (let j = 0; j < BODY_MAX; j++) { const a = h.members[j]; if (a === undefined) break;
        if (Math.hypot(a.position.x - x, a.position.z - z) < 30) a.mem['aw'] = Math.min(1, (a.mem['aw'] ?? 0) + 0.3);
      }
    }
    for (let i = 0; i < GROUP_MAX; i++) {
      const p = groups.packs[i]; if (p === undefined) break;
      for (let j = 0; j < BODY_MAX; j++) { const w = p.members[j]; if (w === undefined) break;
        if (w.alive && Math.hypot(w.position.x - x, w.position.z - z) < 30) { p.awareness = Math.min(1, p.awareness + 0.3); break; }
      }
    }
  };
  const preyRows = flocks.map((f, index) => Array.from({ length: f.n }, (_, i) => {
    const position = new Vector3();
    const prey = { get position() { return f.positions(i, position); }, get yaw() { return f.headingOf(i); },
      get alive() { return f.isAlive(i); }, applyDamage: (): boolean => { f.kill(i); return true; } };
    groups.bindPrey(`sheep:${String(index)}:${String(i)}`, prey); return prey;
  }));
  if (dogIndex !== dogs.length) throw new Error('Nalati roster has a sheepdog with no flock');
  /** Wildlife.scare: packs within 20 m break, herds within r stampede, a flock within r bolts, then the 'scare' signal (the
   *  rider's horse panics on the page; the host has no rider) */
  const wildScare = (x: number, z: number, r = 60): void => {
    for (let i = 0; i < GROUP_MAX; i++) { const p = groups.packs[i]; if (p === undefined) break; p.scare(x, z, 20); }
    for (let i = 0; i < GROUP_MAX; i++) { const h = groups.herds[i]; if (h === undefined) break; if (Math.hypot(h.cx - x, h.cz - z) < r) h.stampede(x, z); }
    for (let i = 0; i < FLOCK_MAX; i++) { const f = flocks[i]; if (f === undefined) break; if (Math.hypot(f.cx - x, f.cz - z) < r) f.scare(x, z, 6); }
    env.onEvent?.('scare', x, z);
  };
  // the creatures' signals (runtime/state.ts onSignal: the event; its toasts are the HUD's)
  env.onEvent = (name, x, z) => { host.events.emit('creature.signal', { name, x, z }); };
  // bowled over (runtime/state.ts onKnockdown: its flash and toast are the HUD's): the one dash rule on the host's player
  const knocked = { x: 0, z: 0 };
  env.onKnockdown = (x, z, strength) => { knockdownDash(x, z, strength, knocked); host.dashPlayer(knocked.x, knocked.z, KNOCKDOWN_TIME); };

  const manager = new NativeManager(host, hunt, rng, { limit: BODY_MAX, sightSlots: bodies.length, initialSight: false });
  const speed = manager.noise, seen = manager.sight, wild = { init: false, x: 0, z: 0, v: 0 };
  const ownedBody = (a: AnimalSim): NalatiHuntBody | undefined => { const body = intake.byId.get(a.entityId); return body?.actor === a ? body.actor : undefined; };
  function asHunt(a: AnimalSim): NalatiHuntBody { const b = ownedBody(a); if (b === undefined) throw new Error(`Nalati headless body ${a.entityId} is not the manager's`); return b; }
  const speciesContext = (actor: NalatiHuntBody) => {
    const { observation } = createNativeSpeciesContext({ host, hunt, rng, world: env, heightAt: floor.heightAt, waterLevel: TERRAIN.waterLevel() }, actor,
      actor.herd >= 0 ? hunt.herds[actor.herd]?.members ?? null : null);
    return { ...observation, claim: groups.claim, mayAttack: groups.mayAttack,
      steer: (a: AnimalSim, yaw: number, velocity: number, turn: number): void => { hunt.steerAny(asHunt(a), yaw, velocity, turn); },
      pathYaw: (a: AnimalSim, x: number, z: number, every = 1): number => hunt.pathYawFor(asHunt(a), x, z, every),
      confine: (a: AnimalSim): void => { hunt.confine(asHunt(a)); } };
  };
  const contexts = new WeakMap<AnimalSim, ReturnType<typeof speciesContext>>(), missingContext = new Error('Missing native species observation');
  for (let i = 0; i < BODY_MAX; i++) { const actor = bodies[i]; if (actor === undefined) break; contexts.set(actor, speciesContext(actor)); }
  const context = (actor: NalatiHuntBody, dt: number) => {
    const c = contexts.get(actor); if (c === undefined) throw missingContext;
    c.dt = dt; c.t = host.clock.now; c.playerSpeed = speed.speed;
    c.herd = actor.herd >= 0 ? hunt.herds[actor.herd]?.members ?? null : null; return c;
  };
  const placement = new Rng(0); placement.restore(ports.wildStream);
  const raids: v.InferOutput<typeof RaidPack>[] = [], elitePacks: v.InferOutput<typeof RaidPack>[] = [];
  const deferredSpec = (kind: string, variant: string) => v.parse(nativeBodySpecSchema('axis'), ports.boot.recipes.find(row => row.kind === kind && row.variant === variant));
  const nextId = (): number => intake.identities.allocatorState().next;
  const continueIds = (next: number): void => { intake.identities.restoreAllocator({ next, used: intake.identities.allocatorState().used }); };
  continueIds(Math.max(...bodies.map(a => Number(a.entityId.slice('creature:'.length)))) + 1);
  const eliteSpawns: v.InferOutput<typeof EliteSpawn>[] = [], retired = new Set<string>();
  const bonded: v.InferOutput<typeof BondedSpawn>[] = [], hiddenStallions = new Set<string>();
  let dodgeCd = 0, reinstalling = ports.snapshot !== undefined;
  const makeBody = (saved: v.InferOutput<typeof RaidBody>, kind: 'wolf' | 'leopard' | 'kokbori' | 'horse', herd: number): NalatiHuntBody => {
    if (host.entities.size >= BODY_MAX || !/^creature:\d+$/u.test(saved.id) || Number(saved.id.slice(9)) < nextId() || saved.scale <= 0) throw new Error('Invalid Nalati raid roster');
    continueIds(Number(saved.id.slice(9)));
    if (intake.identities.allocate() !== saved.id) throw new Error('Invalid Nalati allocated identity');
    const template = ports.bake.actors.find(a => a.kind === kind && a.variant === saved.variant);
    const spec = kind === 'horse' && saved.variant === 'tulpar' ? deferredSpec('horse', 'tulpar') : kind === 'wolf' || kind === KOKBORI ? deferredSpec(kind, saved.variant) : template?.spec;
    if (spec === undefined) throw new Error('Missing baked Nalati elite model');
    const [x, y, z] = saved.at;
    const slot = intake.body(saved.id, kind, saved.variant, herd, { x, z }, saved.yaw, [saved.scale, saved.scale], saved);
    slot.recipe.spec = spec; slot.recipe.at.y = y;
    const a = intake.materialize(slot, slot.recipe, y !== floor.heightAt(x, z));
    a.herd = herd; contexts.set(a, speciesContext(a));
    bodies.push(a); seen.push(false); if (kind === 'wolf') wildWolves.push(a);
    rng.restore(saved.adopted); hunt.adopt(a, x, z);
    // Ride can spawn before AnimalManager.sync in this frame. Give nearby new raiders the same native capsule now.
    // Restoring actors reconnect the saved motors after native world replacement; never allocate a replacement there.
    if (kind !== 'horse' && !reinstalling && host.bodyBands?.physics === true && keepsCreatureBody(false, a.alive, a.driven, creatureBodyDistance(a.position, player))) {
      const motor = withOwner(null, () => new CharacterMotor(host.physics, host.creatureMotorOptions(a)));
      motor.resetAt(a.position); a.motor = motor;
    }
    return a;
  };
  const finishPack = (record: v.InferOutput<typeof RaidPack>, members: AnimalSim[], elite = false): PackBrain<AnimalSim> => {
    const pack = groups.addPack(members, record.x, record.z);
    members.forEach(a => { packOf.set(a, pack); }); (elite ? elitePacks : raids).push(record); return pack;
  };
  const rollBody = (kind: 'wolf' | 'leopard' | 'kokbori' | 'horse', variant: string, x: number, z: number, yaw: number): v.InferOutput<typeof RaidBody> => {
    const slot = intake.body(`creature:${String(nextId())}`, kind, variant, -1, { x, z }, yaw); intake.draw(slot, false);
    const adopted = v.parse(Stream, rng.snapshot()), terrain = floor.heightAt(x, z);
    const y = intake.floor(x, z, Math.max(ports.spawnY, terrain) + 1);
    return { id: slot.id, variant, seed: slot.recipe.seed, scale: slot.recipe.scale, at: [x, y, z], yaw, adopted };
  };
  const freeSpot = (x: number, z: number, radius: number): { x: number; z: number } => {
    const attempts = v.parse(finite, author.project('begin', {})['attempts']);
    for (let i = 0; i < Math.min(attempts, 1024); i++) {
      const at = v.parse(v.object({ x: finite, z: finite }), author.project('spot', { x, z, radius }, placement));
      const clash = bodies.some(a => Math.abs(a.position.x - at.x) < 2 && Math.abs(a.position.z - at.z) < 2);
      if (author.project('accept', { ...at, normal: floor.normalAt(at.x, at.z)[1], height: floor.heightAt(at.x, at.z), water: TERRAIN.waterLevel(),
        wet: Number(nalatiWetAt(at.x, at.z)), clash: Number(clash) })['accept'] === 1) return at;
    }
    return { x, z };
  };
  const spawnPack = (x: number, z: number, variants: readonly string[], elite = false): PackBrain<AnimalSim> => {
    if (author.project('pack', { elite: Number(elite), packs: raids.length, groups: decided().length, variants: variants.length, bodies: host.entities.size })['accept'] !== 1) throw new Error('Nalati raid pack bound exceeded');
    for (let i = 0; i < 5; i++) { const variant = variants[i]; if (variant === undefined) break; deferredSpec('wolf', variant); }
    const herd = hunt.herds.length; hunt.addHerd('wolf', x, z);
    const record: v.InferOutput<typeof RaidPack> = { x, z, herd, bodies: [] };
    const radius = v.parse(finite, author.project('packPlan', {})['radius']);
    const members = variants.map(variant => {
      const at = freeSpot(x, z, radius), yaw = v.parse(finite, author.project('yaw', {}, placement)['yaw']);
      const saved = rollBody('wolf', variant, at.x, at.z, yaw); record.bodies.push(saved); return makeBody(saved, 'wolf', herd);
    });
    return finishPack(record, members, elite);
  };
  const spawnElite = (kind: 'leopard' | 'kokbori', x: number, z: number, yaw: number, variant: string): NalatiHuntBody => {
    const body = rollBody(kind, variant, x, z, yaw);
    const a = makeBody(body, kind, -1); eliteSpawns.push({ kind, body }); return a;
  };
  const spawnBondedHorse = (x: number, z: number, yaw: number, argymaq: boolean): NalatiHuntBody => {
    const plan = author.project('bond', { x, z, bonds: bonded.length, elite: Number(argymaq) });
    if (!Number.isFinite(yaw) || plan['accept'] !== 1) throw new Error('Invalid Nalati bonded adoption');
    // The page rolls and adopts at the manager's structure-aware floor BEFORE Taming places on heightAt.
    deferredSpec('horse', 'tulpar');
    const body = rollBody('horse', 'tulpar', x, z, yaw), terrain = floor.heightAt(x, z);
    const a = makeBody(body, 'horse', -1);
    a.place(x, z, yaw); a.position.y = terrain; a.mem['whistle'] = 1;
    const scale = v.parse(finite, plan['scale']); if (scale > 0) a.scale = scale;
    bonded.push({ body, argymaq }); return a;
  };
  const hideTamedStallion = (a: AnimalSim): void => {
    const owned = asHunt(a);
    if (!a.alive || hiddenStallions.has(a.entityId) || !herdOf.has(a) || (a.kind !== 'horse' && a.kind !== ecology.argymaq)) throw new Error('Foreign Nalati tamed stallion');
    // The wild stallion remains a living identity in the manager; only its simulation/view presence ends.
    owned.hidden = true; a.position.y = -1e4; a.motor?.dispose(); a.motor = null;
    const owner = intake.identities.identity(a.entityId); if (owner !== null) intake.identities.own(a.entityId, { ...owner, listed: false });
    host.bodyDt(a.entityId); host.brainDt(a.entityId); hiddenStallions.add(a.entityId);
  };
  const retireBondedHorse = (a: AnimalSim): void => {
    const extra = bonded.findIndex(row => row.body.id === a.entityId), owned = asHunt(a), at = bodies.indexOf(owned);
    const slot = intake.byId.get(a.entityId);
    if (extra === -1 || at === -1 || slot?.actor !== a) throw new Error('Foreign Nalati bonded retirement');
    intake.retire(slot, { membership: 'retain', native: 'before', final: { hidden: true, alive: false, y: -1e4 } });
    bodies.splice(at, 1); seen.splice(at, 1); bonded.splice(extra, 1); retired.add(a.entityId);
  };
  const retireElite = (a: AnimalSim): void => {
    const at = bodies.indexOf(asHunt(a));
    const slot = intake.byId.get(a.entityId);
    if ((a.kind !== 'leopard' && a.kind !== KOKBORI) || at === -1 || slot?.actor !== a) throw new Error('Invalid Nalati elite retirement');
    intake.retire(slot, { membership: 'retain', native: 'before', final: { alive: false, y: -9999 } });
    bodies.splice(at, 1); seen.splice(at, 1); retired.add(a.entityId);
    const extra = eliteSpawns.findIndex(row => row.body.id === a.entityId); if (extra !== -1) eliteSpawns.splice(extra, 1);
  };
  const spawnElitePack = (x: number, z: number, variants: readonly string[]): PackBrain<AnimalSim> => spawnPack(x, z, variants, true);
  const parkWolf = (a: AnimalSim): void => {
    const at = bodies.indexOf(asHunt(a));
    if (a.kind !== 'wolf' || at === -1 || ports.elites.absent.has(a)) throw new Error('Invalid Nalati pack retirement');
    // AnimalManager.retire removes the manager/native entry but Wildlife retains this exact object in its old pack.
    asHunt(a).hidden = true; a.alive = false; a.position.y = -9999;
    a.motor?.dispose(); a.motor = null; ports.elites.absent.add(a);
    const owner = intake.identities.identity(a.entityId); if (owner !== null) intake.identities.own(a.entityId, { ...owner, listed: false });
    host.bodyDt(a.entityId); host.brainDt(a.entityId); // Forget the old cadence immediately, just as the page scheduler.
    hunt.forget(asHunt(a)); intake.byId.delete(a.entityId); bodies.splice(at, 1); seen.splice(at, 1);
  };
  const retirePack = (pack: PackBrain<AnimalSim>): void => {
    if (!elitePacks.some(record => record.bodies.length === pack.members.length && record.bodies.every((row, i) => row.id === pack.members[i]?.entityId))) throw new Error('Foreign Nalati elite pack');
    // A killed member stays in the manager as its real corpse. Only living members leave, in their shipping order.
    for (let i = 0; i < 5; i++) { const a = pack.members[i]; if (a === undefined) break; if (a.alive) parkWolf(a); }
  };
  // Strict state supplies only the roster at reinstall, in GLOBAL allocation order even when raids and elite respawns interleave.
  const restoreRoster = (): void => {
    if (ports.snapshot === undefined) return;
    const value = ports.snapshot.adapters.find(a => a.id === NALATI_CREATURES_STEP)?.state;
    const saved = v.parse(Saved, value);
    if (author.project('restoreBounds', { packs: saved.raids.length, groups: saved.elitePacks.length + saved.raids.length + decided().length,
      elites: saved.elites.length, retired: saved.retired.length, dormant: saved.dormant.length,
      unique: Number(new Set(saved.dormant).size === saved.dormant.length && new Set(saved.retired).size === saved.retired.length) })['accept'] !== 1) throw new Error('Invalid Nalati saved roster bounds');
    const initial = nextId();
    saved.retired.forEach(id => {
      if (!/^creature:\d+$/u.test(id) || Number(id.slice(9)) >= saved.nextId) throw new Error('Invalid Nalati retired id');
      const a = host.entities.get(id); if (a !== undefined) retireElite(a); else if (Number(id.slice(9)) < initial) throw new Error('Missing Nalati retired boot actor');
      retired.add(id);
    });
    const packs = [...saved.raids.map(record => ({ record, elite: false })), ...saved.elitePacks.map(record => ({ record, elite: true }))].sort((a, b) => a.record.herd - b.record.herd);
    const ids = new Set(packs.flatMap(({ record }) => record.bodies.map(body => body.id)));
    if (saved.dormant.some(id => !saved.elitePacks.some(pack => pack.bodies.some(body => body.id === id)) || saved.retired.includes(id))
      || ids.size !== packs.reduce((n, { record }) => n + record.bodies.length, 0)) throw new Error('Invalid Nalati dormant pack identities');
    for (let i = 0; i < BODY_MAX; i++) {
      const id = saved.dormant[i]; if (id === undefined) break;
      const row = ports.snapshot.entities.find(actor => actor.id === id);
      if (row?.state.kind !== 'wolf' || row.state.flags.alive || row.state.position[1] !== -9999 || row.motor !== null) throw new Error('Invalid Nalati dormant body');
    }
    packs.forEach(({ record, elite }) => {
      if (author.project('restorePack', { herd: record.herd, expected: hunt.herds.length, variants: record.bodies.length, elite: Number(elite) })['accept'] !== 1) throw new Error('Invalid Nalati saved raid herd');
      hunt.addHerd('wolf', record.x, record.z);
    });
    const spawnRows: { body: v.InferOutput<typeof RaidBody>; kind: 'wolf' | 'leopard' | 'kokbori' | 'horse'; herd: number }[] = [];
    for (let i = 0; i < GROUP_MAX; i++) {
      const pack = packs[i]; if (pack === undefined) break;
      for (let j = 0; j < 5; j++) { const body = pack.record.bodies[j]; if (body === undefined) break; spawnRows.push({ body, kind: 'wolf', herd: pack.record.herd }); }
    }
    for (let i = 0; i < BODY_MAX; i++) { const row = saved.elites[i]; if (row === undefined) break; spawnRows.push({ body: row.body, kind: row.kind, herd: -1 }); }
    const savedBond = saved.bonded?.[0];
    if (savedBond !== undefined && author.project('restoreBond', { variant: Number(savedBond.body.variant === 'tulpar') })['accept'] !== 1) throw new Error('Foreign Nalati bonded body recipe');
    if (savedBond !== undefined) spawnRows.push({ body: savedBond.body, kind: 'horse', herd: -1 });
    if (host.entities.size + spawnRows.length > BODY_MAX || new Set(spawnRows.map(row => row.body.id)).size !== spawnRows.length) throw new Error('Invalid Nalati saved spawn bounds');
    spawnRows.sort((a, b) => Number(a.body.id.slice(9)) - Number(b.body.id.slice(9)));
    for (let i = 0; i < BODY_MAX; i++) {
      const row = spawnRows[i]; if (row === undefined) break;
      if (author.project('restoreBody', { id: Number(row.body.id.slice(9)), initial: nextId(), nextId: saved.nextId, retired: Number(retired.has(row.body.id)) })['accept'] !== 1) throw new Error('Invalid Nalati active spawn id');
      const actor = makeBody(row.body, row.kind, row.herd);
      const bond = saved.bonded?.find(b => b.body.id === row.body.id);
      if (bond?.argymaq === true) actor.scale = v.parse(finite, author.project('bond', { x: row.body.at[0], z: row.body.at[2], bonds: 0, elite: 1 })['scale']);
    }
    if (saved.nextId < nextId()) throw new Error('Invalid Nalati next spawn identity');
    continueIds(saved.nextId);
    packs.forEach(({ record, elite }) => { finishPack(record, record.bodies.map(b => {
      const a = host.entities.get(b.id); if (a === undefined) throw new Error('Missing restored Nalati raid actor'); return a;
    }), elite); });
    saved.dormant.forEach(id => { const a = host.entities.get(id); if (a === undefined) throw new Error('Missing dormant Nalati pack member'); parkWolf(a); });
    eliteSpawns.push(...saved.elites); bonded.push(...saved.bonded ?? []);
    const hidden = saved.hiddenStallions ?? [];
    if (new Set(hidden).size !== hidden.length) throw new Error('Duplicate Nalati tamed stallion');
    for (let i = 0; i < 2; i++) { const id = hidden[i]; if (id === undefined) break; const actor = host.entities.get(id); if (actor === undefined) throw new Error('Missing tamed Nalati stallion'); hideTamedStallion(actor); }
  };
  const firstFlock = flocks[0] ?? null;
  const horse = bodies.find(a => a.kind === 'horse' && a.herd === -1 && firstFlock !== null
    && a.position.x === firstFlock.cx + 12 && a.position.z === firstFlock.cz + 16) ?? null;
  const raid = new HeadlessSheepRaid(host, groups, firstFlock, horse, i => {
    const prey = preyRows[0]?.[i]; if (prey === undefined) throw new Error('Unknown Nalati sheep'); return prey;
  }, spawnPack, ports.raidDirector);
  /** AnimalManager.think for a self-thinking species: the dead and the stunned hold, else its own decision, the herd's centre after */
  const missingElite = new Error('Nalati leopard has no hosted elite brain');
  const decide = (a: NalatiHuntBody, dt: number): void => {
    const elite = ports.elites.brains.get(a);
    if (!a.alive) { a.lookWeight = 0; return; }
    if ((a.kind === 'leopard' || a.kind === KOKBORI) && elite === undefined) throw missingElite;
    if (a.stunned) { a.setMotion(a.yaw, 0, 1); a.setStrafe(0); a.lookTarget.copy(player); a.lookWeight = 1; return; }
    const ctx = context(a, dt);
    if (elite !== undefined) elite.think(a, ctx);
    else if (a.kind === 'wolf') decideWolf(a, ctx, packOf.get(a) ?? null);
    else if (a.kind === 'sheepdog') thinkSheepdog(a, ctx);
    else if (!horseHeld(a)) decideHorse(a, ctx, herdOf.get(a) ?? null);
    const herd = a.herd >= 0 ? hunt.herds[a.herd] : undefined;
    if (herd !== undefined) hunt.updateHerd(herd);
  };
  host.useBodyStep({
    before: (_id, body, dt) => {
      const a = ownedBody(body);
      // the sheepdog has no body act (its species has none)
      if (a === undefined || a.hidden || !a.alive || a.stunned || a.kind === 'sheepdog') return;
      const elite = ports.elites.brains.get(a);
      if (elite !== undefined) elite.act(a);
      else if (a.kind === 'wolf') actWolfBody(a, context(a, dt), packOf.get(a) ?? null);
      else actHorseBody(a, context(a, dt), herdOf.get(a) ?? null);
    },
    after: (_id, body) => {
      const a = ownedBody(body);
      if (a?.alive === true && !a.hidden && !a.stunned && a.state === 'charge') hunt.chargeContact(a, player);
    },
  });
  const savePacks = (list: readonly v.InferOutput<typeof RaidPack>[]): v.InferOutput<typeof RaidPack>[] => list.map(r => ({ x: r.x, z: r.z, herd: r.herd, bodies: r.bodies.map(b => ({ id: b.id, variant: b.variant, seed: b.seed, scale: b.scale, at: [...b.at], yaw: b.yaw, adopted: { ...b.adopted } })) }));
  host.onStep(NALATI_CREATURES_STEP, dt => {
    // Wildlife's frame: the player into the wild view, the grass movers, a stampede scaring the packs
    const yaw = host.player.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), fl = Math.hypot(fx, fz);
    if (fl > 1e-4) { env.playerFwdX = fx / fl; env.playerFwdZ = fz / fl; }
    env.playerCrouched = ports.crouching?.() === true; env.playerMounted = ports.mounted?.() === true;
    const vital = host.player.health.attributes; env.playerHealth01 = vital.health / vital.maxHealth;
    // Wildlife's smoothed player speed (its own: 14 m/s cap, a 6 /s ease), the living wolves, the grass movers, the flocks
    if (!wild.init) { wild.x = player.x; wild.z = player.z; wild.init = true; }
    const walked = Math.hypot(player.x - wild.x, player.z - wild.z);
    wild.x = player.x; wild.z = player.z;
    if (dt > 0) wild.v += (Math.min(walked / dt, 14) - wild.v) * Math.min(1, dt * 6);
    wolves.length = 0;
    for (let i = 0; i < BODY_MAX; i++) { const w = wildWolves[i]; if (w === undefined) break; if (w.alive) wolves.push(w); }
    pushWildMovers(bodies, player.x, player.z, pushTrample);
    for (let i = 0; i < FLOCK_MAX; i++) { const f = flocks[i]; if (f === undefined) break; f.update(dt, host.clock.now, player, wild.v, wolves); }
    const alarm = marmots.update(dt, player, wild.v > 5, env.playerCrouched); if (alarm !== null) whistle(alarm.x, alarm.z);
    for (let i = 0; i < GROUP_MAX; i++) {
      const h = groups.herds[i]; if (h === undefined) break;
      if (h.stampeding) for (let j = 0; j < GROUP_MAX; j++) { const p = groups.packs[j]; if (p === undefined) break; p.scare(h.cx, h.cz, 20); }
    }
    // Ride.update follows Wildlife and precedes the manager's think loop on the page.
    ports.rideUpdate?.(dt); raid.update(dt, wolves);
    // the manager's think loop
    if (!speed.seen) { speed.prev.set(player.x, 0, player.z); speed.seen = true; }
    const moved = Math.hypot(player.x - speed.prev.x, player.z - speed.prev.z);
    speed.prev.set(player.x, 0, player.z);
    speed.speed += (Math.min(moved / dt, 9) - speed.speed) * (1 - 0.5 ** (dt * 10));
    manager.advance(dt); hunt.resetRepaths();
    // player.dodge is queued until fixed.post. Its public cooldown rises ONLY on an accepted input in the player step;
    // observe that edge now, where the page notices dodgeFx.id, before the ordinary per-body decision loop.
    const dodged = host.playerDodge.cd > dodgeCd; dodgeCd = host.playerDodge.cd;
    if (dodged) for (let i = 0; i < BODY_MAX; i++) {
      const a = bodies[i]; if (a === undefined) break;
      if (!a.alive || a.harnessHold || a.hidden || (!a.aggressive && !hunt.sensed(a))) continue;
      decide(a, host.brainDt(a.entityId, true));
    }
    for (let i = 0; i < BODY_MAX; i++) {
      const a = bodies[i];
      if (a === undefined) break;
      if (a.harnessHold || a.hidden) continue;
      let urgent = false;
      if (a.alive && a.aggressive && (a.state === 'charge' || a.state === 'stalk' || a.state === 'alert')) {
        const line = canReach(a, player, host.physics);
        urgent = seen[i] === true && !line; seen[i] = line;
      }
      const brain = host.brainDt(a.entityId, urgent);
      if (brain > 0) { a.sampleTerrain(); decide(a, brain); }
    }
  }, {
    snapshot: () => {
      const ids = bodies.map(a => a.entityId), common = manager.snapshot(ids, ids);
      return ({ ...(bonded.length === 0 ? {} : { bonded: bonded.map(row => ({ argymaq: row.argymaq, body: { ...row.body, at: [...row.body.at], adopted: { ...row.body.adopted } } })) }),
      ...(hiddenStallions.size === 0 ? {} : { hiddenStallions: [...hiddenStallions] }), elitePacks: savePacks(elitePacks), dormant: [...ports.elites.absent].map(a => a.entityId), dodgeCd, nextId: nextId(), retired: [...retired], elites: eliteSpawns.map(row => ({ kind: row.kind, body: { ...row.body, at: [...row.body.at], adopted: { ...row.body.adopted } } })), rng: common.rng, clock: common.clock, speed: { init: speed.seen, x: speed.prev.x, z: speed.prev.z, v: speed.speed }, seen: common.sight.map(value => value === true),
      memories: bodies.flatMap((a, i) => { const memory = common.memories[i]; return memory === null || memory === undefined ? [] : [[a.entityId, memory] as [string, SavedMemory]]; }),
      herds: common.herds, groups: decided().map(g => g.snapshot()), wild: { ...wild }, flocks: flocks.map(f => f.snapshot()), marmots: marmots.snapshot(), placement: { ...placement.snapshot() }, raids: savePacks(raids) });
    },
    restore: value => {
      const saved = v.parse(Saved, value);
      if (saved.seen.length !== bodies.length || saved.herds.length !== hunt.herds.length || saved.groups.length !== decided().length || saved.flocks.length !== flocks.length) throw new Error('Incompatible Nalati creatures continuation');
      dodgeCd = saved.dodgeCd;
      marmots.restore(saved.marmots); placement.restore(saved.placement);
      const memories = new Map(saved.memories), ids = bodies.map(a => a.entityId);
      manager.restore({ rng: saved.rng, clock: saved.clock, noise: { seen: saved.speed.init, speed: saved.speed.v,
        prev: [saved.speed.x, 0, saved.speed.z] }, sight: saved.seen,
        memories: ids.map(id => memories.get(id) ?? null), herds: saved.herds }, ids, ids);
      saved.groups.forEach((state, i) => { decided()[i]?.restore(state); });
      Object.assign(wild, saved.wild); saved.flocks.forEach((state, i) => { flocks[i]?.restore(state); });
    },
  });
  // Match the original adapter insertion order: fixed controllers first, actors materialized later.
  restoreRoster(); reinstalling = false;
  const out = { hunt, rng, bodies, flocks, raid, marmots, spawnElite, retireElite, spawnElitePack, retirePack, spawnBondedHorse, retireBondedHorse, hideTamedStallion, bondedHorseIds: (): readonly string[] => bonded.map(row => row.body.id), scare: wildScare };
  installed.set(host, out);
  return out;
}
