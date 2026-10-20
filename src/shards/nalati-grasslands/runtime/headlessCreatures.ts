import { Vector3 } from 'three';
import { admitMountRoster, BondedMountRoster } from '@wildshard/game/riding/roster';
import ecology from '../data/ecology.generated.json' with { type: 'json' };
import { createNativeHunt } from '@wildshard/game/plugin/brain';
import { NativeManager, NativePopulationDriver, NativeWildlifeFrame } from '@wildshard/game/population/nativeManager';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import { admitNativeRosterServices, createNativeCreatureRoster, NativeDeferredRoster, type NativeCreatureSlot } from '@wildshard/game/shardfile/homeKeeper';
import * as v from 'valibot';
import { ForagerContinuation as MarmotContinuation } from '@wildshard/format/ambientLife';
import { marmotColonies } from '../creatures/marmotBrain';
import { Rng } from '@wildshard/engine/core/rng';
import type { SimHost } from '@wildshard/engine/sim';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { ATTACK_TURN, type HuntBody, type HuntGround, type HuntNav, type HuntTree } from '@wildshard/engine/ai/hunt';
import type { StalkerBrain } from '@wildshard/engine/ai/stalker';
import { bakedSamplers, type BakedGrid } from '@wildshard/engine/world/BakedTerrain';
import type { PackBrain } from '@wildshard/engine/ai/pack';
import type { HerdBrain } from '@wildshard/engine/ai/herd';
import { nativeBodySpecSchema } from '@wildshard/sdk/headlessRuntime';
import { SpeciesSchema } from '@wildshard/format/speciesPrograms';
import { FlockBrain, type FlockPorts } from '@wildshard/engine/ai/flock';
import { parseFlock } from '@wildshard/format/crowds';
import { SEED, TERRAIN } from '../world/geography';
import { nalatiWetAt } from '../wet';
import type { SimSnapshot } from '@wildshard/engine/sim/snapshot';
import type { NalatiBake, NalatiBootHerd, NalatiBootRows } from './baked';
import { PastureRaid } from '../creatures/pasture';
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
const BondedSpawn = v.strictObject({ body: RaidBody, upgraded: v.boolean() });
const RaidPack = v.strictObject({ x: finite, z: finite, herd: v.pipe(finite, v.integer()), bodies: v.array(RaidBody) });
const Saved = v.strictObject({ rng: Stream, clock: finite, speed: v.strictObject({ init: v.boolean(), x: finite, z: finite, v: finite }),
  seen: v.array(v.boolean()), memories: v.array(v.tuple([v.string(), Memory])), herds: v.array(v.tuple([finite, finite])),
  // the declared groups' continuations (PackBrain / HerdBrain `snapshot()`), packs then herds: they decide on this step
  groups: v.array(v.string()),
  // Wildlife's own smoothed player speed (the flocks read it) and the flocks' continuations (FlockBrain `snapshot()`)
  wild: v.strictObject({ init: v.boolean(), x: finite, z: finite, v: finite, at: v.exactOptional(finite) }), flocks: v.array(v.string()),
  marmots: MarmotContinuation, placement: Stream, raids: v.array(RaidPack), elitePacks: v.array(RaidPack), dormant: v.array(v.string()), elites: v.array(EliteSpawn),
  bonded: v.exactOptional(v.pipe(v.array(BondedSpawn), v.maxLength(1))), hiddenStallions: v.exactOptional(v.pipe(v.array(v.string()), v.maxLength(2))),
  retired: v.array(v.string()), nextId: v.pipe(finite, v.integer(), v.minValue(0)), dodgeCd: v.pipe(finite, v.minValue(0)) });
type SavedMemory = v.InferOutput<typeof Memory>;

/** The host's creatures, for its tests: the hunting brain over the manager's stream and the bodies it decides for, the
 *  flocks, and Wildlife's `scare` (a lightning strike's: the packs break, the herds stampede, the flocks bolt). */
export interface NalatiHostCreatures {
  readonly hunt: StalkerBrain<NalatiHuntBody>; readonly rng: Rng; readonly bodies: readonly NalatiHuntBody[]; readonly flocks: readonly FlockBrain[];
  readonly scare: (x: number, z: number, r?: number) => void;
  readonly raid: PastureRaid<AnimalSim, PackBrain<AnimalSim>>; readonly marmots: ReturnType<typeof marmotColonies>;
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
  wildStream: ReturnType<Rng['snapshot']>; bake: NalatiBake; spawnY: number; elites: EliteBindings; rideUpdate?: (dt: number) => void; mounted?: () => boolean; crouching?: () => boolean; snapshot?: Readonly<SimSnapshot> }): NalatiHostCreatures {
  const { groups } = ports, env = groups.env;
  const author = ReturnProgram.native(host, ports.boot.admission);
  const rng = new Rng(ports.boot.streamSeed);
  const { hunt } = createNativeHunt(host, { limit: BODY_MAX, fight: { telegraphed: true }, player: 'origin', bands: null,
    hit: { namespace: 'creature', tags: ['feel.blow', 'cover.checked'] } }, {
    rng, ground: nalatiHuntGround(ports.grid, ports.trees), nav: ports.nav, species: new Map(Object.entries(ports.boot.hunt).map(([kind, row]) => [kind, v.parse(v.object(v.pick(SpeciesSchema, ['aggressive', 'tuning', 'sounds', 'walkSpeed', 'chargeSpeed', 'chargeWindup', 'ringRadius']).entries), row)])),
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
  scaleVariants.set(ecology.species.kokbori.kind, ecology.species.kokbori.variants);
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
    }
    return brain;
  });
  const marmots = marmotColonies(SEED);
  marmots.restore(ports.bake.marmots);
  const preyRows = flocks.map((f, index) => Array.from({ length: f.n }, (_, i) => {
    const position = new Vector3();
    const prey = { get position() { return f.positions(i, position); }, get yaw() { return f.headingOf(i); },
      get alive() { return f.isAlive(i); }, applyDamage: (): boolean => { f.kill(i); return true; } };
    groups.bindPrey(`sheep:${String(index)}:${String(i)}`, prey); return prey;
  }));
  if (dogIndex !== dogs.length) throw new Error('Nalati roster has a sheepdog with no flock');
  const frame = new NativeWildlifeFrame(host, author, bodies, wildWolves, wolves, groups.packs, groups.herds, flocks, marmots, groups.grass.trample,
    { speed: 'speed', alert: 'whistle', range: 'scare', packRadius: 20, scareSeconds: 6, scareRadius: 60, foragerRunSpeed: 5,
      trample: { kinds: { wolf: .5, horse: .8, sheepdog: .4 }, minSpeed: .6, range: 80, fullSpeed: 6 }, knockdown: { speed: 7, min: .4, max: 1.5, seconds: .28 } });
  const wildScare = frame.scare.bind(frame);
  env.onEvent = (name, x, z) => { host.events.emit('creature.signal', { name, x, z }); };
  env.onKnockdown = (x, z, strength) => { frame.knockdown(x, z, strength); };

  const manager = new NativeManager(host, hunt, rng, { limit: BODY_MAX, sightSlots: bodies.length, initialSight: false });
  const speed = manager.noise, seen = manager.sight;
  const driver = new NativePopulationDriver(host, manager, hunt, rng, bodies, packOf, herdOf, ports.elites, flocks, wolves,
    { tokens: 'nalati.tokens', program: ports.boot.admission, packKind: 'wolf', dogKind: 'sheepdog', eliteKinds: ['leopard', ecology.species.kokbori.kind], dispatch: 'dispatch', dogDecision: 'dog', stragglerDistance: 12 });
  const placement = new Rng(0); placement.restore(ports.wildStream);
  const raids: v.InferOutput<typeof RaidPack>[] = [], elitePacks: v.InferOutput<typeof RaidPack>[] = [];
  const deferredSpec = (kind: string, variant: string) => v.parse(nativeBodySpecSchema('axis'), ports.boot.recipes.find(row => row.kind === kind && row.variant === variant));
  const nextId = (): number => intake.identities.allocatorState().next;
  const continueIds = (next: number): void => { intake.identities.restoreAllocator({ next, used: intake.identities.allocatorState().used }); };
  continueIds(Math.max(...bodies.map(a => Number(a.entityId.slice('creature:'.length)))) + 1);
  const eliteSpawns: v.InferOutput<typeof EliteSpawn>[] = [], retired = new Set<string>();
  admitMountRoster(host, NALATI_CREATURES_STEP, intake.identities, rng, hunt, bodies, seen, retired, flocks);
  const mountRoster = new BondedMountRoster(host, { id: 'nalati.mounts', services: NALATI_CREATURES_STEP, herds: 'nalati.herds',
    kind: 'horse', variant: 'tulpar', wildKinds: ['horse', ecology.argymaq], specs: ports.boot.recipes,
    scale: scaleVariants.get('horse')?.find(row => row.id === 'tulpar')?.scale ?? [1, 1], spawnY: ports.spawnY, program: ports.boot.admission });
  const bonded = mountRoster.records, hiddenStallions = mountRoster.hidden;
  const deferred = new NativeDeferredRoster(host, intake, hunt, rng, bodies, seen, retired, ports.elites.absent,
    { limit: BODY_MAX, spawnY: ports.spawnY, motorKinds: ['wolf', 'leopard', ecology.species.kokbori.kind], retiredY: -9999 });
  let reinstalling = ports.snapshot !== undefined;
  const makeBody = (saved: v.InferOutput<typeof RaidBody>, kind: 'wolf' | 'leopard' | 'kokbori' | 'horse', herd: number): NalatiHuntBody => {
    const actor = deferred.materialize(saved, kind, herd, reinstalling); driver.admit(actor); if (kind === 'wolf') wildWolves.push(actor); return actor;
  };
  const finishPack = (record: v.InferOutput<typeof RaidPack>, members: AnimalSim[], elite = false): PackBrain<AnimalSim> => {
    const pack = groups.addPack(members, record.x, record.z);
    members.forEach(a => { packOf.set(a, pack); }); (elite ? elitePacks : raids).push(record); return pack;
  };
  const rollBody = deferred.roll.bind(deferred);
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
  const spawnBondedHorse = (x: number, z: number, yaw: number, upgraded: boolean): NalatiHuntBody => mountRoster.spawn(x, z, yaw, upgraded);
  const hideTamedStallion = (actor: AnimalSim): void => { mountRoster.hide(actor.entityId); };
  const retireBondedHorse = (actor: AnimalSim): void => { mountRoster.retire(actor.entityId); };
  const retireElite = (a: AnimalSim): void => {
    if (a.kind !== 'leopard' && a.kind !== ecology.species.kokbori.kind) throw new Error('Invalid Nalati elite retirement');
    deferred.retire(a.entityId);
    const extra = eliteSpawns.findIndex(row => row.body.id === a.entityId); if (extra !== -1) eliteSpawns.splice(extra, 1);
  };
  const spawnElitePack = (x: number, z: number, variants: readonly string[]): PackBrain<AnimalSim> => spawnPack(x, z, variants, true);
  const parkWolf = (actor: AnimalSim): void => { if (actor.kind !== 'wolf') throw new Error('Foreign Nalati pack member'); deferred.park(actor.entityId); };
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
      const actor = row.kind === 'horse' ? mountRoster.materialize(row.body) : makeBody(row.body, row.kind, row.herd);
      const bond = saved.bonded?.find(b => b.body.id === row.body.id);
      if (bond?.upgraded === true) actor.scale = v.parse(finite, author.project('bond', { x: row.body.at[0], z: row.body.at[2], bonds: 0, elite: 1 })['scale']);
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
  const raid = new PastureRaid<AnimalSim, PackBrain<AnimalSim>>(ReturnProgram.native(host, ports.boot.pasture), host.rng.stream('ai'), horse, firstFlock, groups.packs, i => {
    const prey = preyRows[0]?.[i]; if (prey === undefined) throw new Error('Unknown Nalati sheep'); return prey;
  }, spawnPack, groups.firstRaid);
  host.onStep('nalati.raid', () => undefined, { snapshot: () => raid.snapshot(), restore: value => { raid.restore(value); } });
  const savePacks = (list: readonly v.InferOutput<typeof RaidPack>[]): v.InferOutput<typeof RaidPack>[] => list.map(r => ({ x: r.x, z: r.z, herd: r.herd, bodies: r.bodies.map(b => ({ id: b.id, variant: b.variant, seed: b.seed, scale: b.scale, at: [...b.at], yaw: b.yaw, adopted: { ...b.adopted } })) }));
  host.onStep(NALATI_CREATURES_STEP, dt => {
    // Wildlife's frame: the player into the wild view, the grass movers, a stampede scaring the packs
    const yaw = host.player.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), fl = Math.hypot(fx, fz);
    if (fl > 1e-4) { env.playerFwdX = fx / fl; env.playerFwdZ = fz / fl; }
    env.playerCrouched = ports.crouching?.() === true; env.playerMounted = ports.mounted?.() === true;
    const vital = host.player.health.attributes; env.playerHealth01 = vital.health / vital.maxHealth;
    frame.update(dt, env.playerCrouched);
    // Ride.update follows Wildlife and precedes the manager's think loop on the page.
    ports.rideUpdate?.(dt); raid.update(dt, host.player.position, wolves, host.clock.now);
    driver.update(dt);
  }, {
    snapshot: () => {
      const ids = bodies.map(a => a.entityId), common = manager.snapshot(ids, ids);
      return ({ ...(bonded.length === 0 ? {} : { bonded: bonded.map(row => ({ upgraded: row.upgraded, body: { ...row.body, at: [...row.body.at], adopted: { ...row.body.adopted } } })) }),
      ...(hiddenStallions.size === 0 ? {} : { hiddenStallions: [...hiddenStallions] }), elitePacks: savePacks(elitePacks), dormant: [...ports.elites.absent].map(a => a.entityId), dodgeCd: driver.snapshot(), nextId: nextId(), retired: [...retired], elites: eliteSpawns.map(row => ({ kind: row.kind, body: { ...row.body, at: [...row.body.at], adopted: { ...row.body.adopted } } })), rng: common.rng, clock: common.clock, speed: { init: speed.seen, x: speed.prev.x, z: speed.prev.z, v: speed.speed }, seen: common.sight.map(value => value === true),
      memories: bodies.flatMap((a, i) => { const memory = common.memories[i]; return memory === null || memory === undefined ? [] : [[a.entityId, memory] as [string, SavedMemory]]; }),
      herds: common.herds, groups: decided().map(g => g.snapshot()), ...frame.snapshot(), placement: { ...placement.snapshot() }, raids: savePacks(raids) });
    },
    restore: value => {
      const saved = v.parse(Saved, value);
      if (saved.seen.length !== bodies.length || saved.herds.length !== hunt.herds.length || saved.groups.length !== decided().length || saved.flocks.length !== flocks.length) throw new Error('Incompatible Nalati creatures continuation');
      driver.restore(saved.dodgeCd);
      frame.restore(saved); placement.restore(saved.placement);
      const memories = new Map(saved.memories), ids = bodies.map(a => a.entityId);
      manager.restore({ rng: saved.rng, clock: saved.clock, noise: { seen: saved.speed.init, speed: saved.speed.v,
        prev: [saved.speed.x, 0, saved.speed.z] }, sight: saved.seen,
        memories: ids.map(id => memories.get(id) ?? null), herds: saved.herds }, ids, ids);
      saved.groups.forEach((state, i) => { decided()[i]?.restore(state); });
    },
  });
  // Match the original adapter insertion order: fixed controllers first, actors materialized later.
  restoreRoster(); reinstalling = false;
  const out = { hunt, rng, bodies, flocks, raid, marmots, spawnElite, retireElite, spawnElitePack, retirePack, spawnBondedHorse, retireBondedHorse, hideTamedStallion, bondedHorseIds: (): readonly string[] => bonded.map(row => row.body.id), scare: wildScare };
  installed.set(host, out);
  return out;
}
