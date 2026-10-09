import * as v from 'valibot';
import { MarmotBrain, MarmotContinuation } from '../creatures/marmotBrain';
import { Vector3 } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import type { SimHost } from '@wildshard/engine/sim';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { HuntBrain, HURT_ARC, ATTACK_TURN, spawnRolls, type HuntBody, type HuntGround, type HuntMemory, type HuntNav, type HuntSpecies, type HuntTree } from '@wildshard/engine/ai/hunt';
import { canReach } from '@wildshard/engine/ai/reach';
import { bakedSamplers, type BakedGrid } from '@wildshard/engine/world/BakedTerrain';
import type { PackBrain } from '@wildshard/engine/ai/pack';
import type { HerdBrain } from '@wildshard/engine/ai/herd';
import { WOLF_SPECIES } from '../species/wolf';
import { HORSE_SPECIES } from '../species/horse';
import { LEOPARD_SPECIES } from '../species/leopard';
import { SHEEPDOG_SPECIES } from '../species/sheepdog';
import { FlockBrain, type FlockPorts } from '@wildshard/engine/ai/flock';
import { nalatiFlockRows } from '../creatures/flockRows';
import { NALATI_WILDLIFE, placePack, type WildPlacer } from '../creatures/wildPlacement';
import { setDogFlock, thinkSheepdog } from '../creatures/sheepdogBrain';
import { ARGYMAQ, argymaqDefinition } from '../combat/eliteRoster';
import { SEED, TERRAIN } from '../world/terrain';
import { nalatiWetAt } from '../wet';
import { pushWildMovers } from '../look/trampleMovers';
import { KNOCKDOWN_TIME, knockdownDash } from '../creatures/knockdown';
import { actHorseBody, actWolfBody, decideHorse, decideWolf, horseHeld } from './groupDispatch';
import { NALATI_CREATURE_STREAM, nalatiSpawnSpecies, type NalatiBootHerd } from './bootRoster';
import type { SimSnapshot } from '@wildshard/engine/sim/snapshot';
import type { NalatiBake } from './baked';
import { withOwner } from '@wildshard/engine/app/ownership';
import { CharacterMotor } from '@wildshard/engine/physics/CharacterMotor';
import { creatureBodyDistance, keepsCreatureBody } from '@wildshard/engine/sim/bands';
import { castRay } from '@wildshard/engine/physics/query';
import { HeadlessSheepRaid } from './headlessRaid';
import type { NalatiGroups } from './groups';
import type { NalatiBody } from './headless';
import type { NalatiEliteBindings } from './headlessElites';

/** The creatures' fixed-step id (its continuation's adapter). */
export const NALATI_CREATURES_STEP = 'nalati.creatures';
/** The level's chunk half (m): the hunting brain's hard clamp (core/config.ts CHUNK_HALF). */
const CHUNK_HALF = 250;
/** Bounds for the frame loops: the manager's load-time list (35 bodies), the declared groups (a pack, two herds), the flocks. */
const BODY_MAX = 64, GROUP_MAX = 8, FLOCK_MAX = 4;

/** A renderer-free body as the hunting brain reads it: never hidden here (no view), no ground tilt to sample. */
export type NalatiHuntBody = AnimalSim & HuntBody;

/**
 * Nalati's creature rows as the manager's hunting brain reads them (HuntConfig.species), renderer-free: the shipping wolf,
 * horse, leopard and sheepdog rows and Argymaq's (combat/eliteRoster.ts, from the horse's stallion, as the elites register it).
 */
export function nalatiHuntSpecies(): (kind: string) => HuntSpecies {
  const stallion = HORSE_SPECIES.variants.find(variant => variant.id === 'stallion');
  if (stallion === undefined) throw new Error('Nalati horse has no stallion');
  const rows = new Map<string, HuntSpecies>([['wolf', WOLF_SPECIES], ['horse', HORSE_SPECIES], ['leopard', LEOPARD_SPECIES], ['sheepdog', SHEEPDOG_SPECIES], [ARGYMAQ, argymaqDefinition(HORSE_SPECIES, stallion)]]);
  return kind => { const row = rows.get(kind); if (row === undefined) throw new Error(`Nalati hunting brain has no row '${kind}'`); return row; };
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
const Stream = v.strictObject({ version: v.literal(1), state: finite, initial: finite, scrambledFork: v.boolean() });
const Memory = v.record(v.string(), v.union([finite, v.boolean(), v.array(v.tuple([finite, finite, finite]))]));
const RaidBody = v.strictObject({ id: v.string(), variant: v.string(), seed: finite, scale: finite,
  at: v.tuple([finite, finite, finite]), yaw: finite, adopted: Stream });
const EliteSpawn = v.strictObject({ body: RaidBody, kind: v.literal('leopard') });
const RaidPack = v.strictObject({ x: finite, z: finite, herd: v.pipe(finite, v.integer()), bodies: v.array(RaidBody) });
const Saved = v.strictObject({ rng: Stream, clock: finite, speed: v.strictObject({ init: v.boolean(), x: finite, z: finite, v: finite }),
  seen: v.array(v.boolean()), memories: v.array(v.tuple([v.string(), Memory])), herds: v.array(v.tuple([finite, finite])),
  // the declared groups' continuations (PackBrain / HerdBrain `snapshot()`), packs then herds: they decide on this step
  groups: v.array(v.string()),
  // Wildlife's own smoothed player speed (the flocks read it) and the flocks' continuations (FlockBrain `snapshot()`)
  wild: v.strictObject({ init: v.boolean(), x: finite, z: finite, v: finite }), flocks: v.array(v.string()),
  marmots: MarmotContinuation, placement: Stream, raids: v.array(RaidPack), elites: v.array(EliteSpawn),
  retired: v.array(v.string()), nextId: v.pipe(finite, v.integer(), v.minValue(0)), dodgeCd: v.pipe(finite, v.minValue(0)) });
type SavedMemory = v.InferOutput<typeof Memory>;
const point = (p: unknown): [number, number, number] => { if (!(p instanceof Vector3)) throw new Error('Unsaveable Nalati hunting path'); return [p.x, p.y, p.z]; };
function saveMemory(memory: HuntMemory): SavedMemory {
  const out: SavedMemory = {};
  Object.keys(memory).forEach(key => {
    const value: unknown = Reflect.get(memory, key);
    out[key] = Array.isArray(value) ? value.map(point) : typeof value === 'boolean' ? value : Number(value);
  });
  return out;
}
function loadMemory(memory: HuntMemory, saved: SavedMemory): void {
  const keys = Object.keys(memory);
  if (keys.length !== Object.keys(saved).length) throw new Error('Incompatible Nalati hunting memory');
  keys.forEach(key => {
    const value = saved[key], known: unknown = Reflect.get(memory, key);
    if (value === undefined || Array.isArray(value) !== Array.isArray(known) || (!Array.isArray(value) && typeof value !== typeof known)) throw new Error(`Incompatible Nalati hunting memory ${key}`);
    Reflect.set(memory, key, Array.isArray(value) ? value.map(([x, y, z]) => new Vector3(x, y, z)) : value);
  });
}

/** The host's creatures, for its tests: the hunting brain over the manager's stream and the bodies it decides for, the
 *  flocks, and Wildlife's `scare` (a lightning strike's: the packs break, the herds stampede, the flocks bolt). */
export interface NalatiHostCreatures {
  readonly hunt: HuntBrain<NalatiHuntBody>; readonly rng: Rng; readonly bodies: readonly NalatiHuntBody[]; readonly flocks: readonly FlockBrain[];
  readonly scare: (x: number, z: number, r?: number) => void;
  readonly raid: HeadlessSheepRaid; readonly marmots: MarmotBrain;
  readonly spawnElite: (kind: 'leopard', x: number, z: number, yaw: number, variant: string) => NalatiHuntBody;
  readonly retireElite: (a: AnimalSim) => void;
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
 *   on its band's brain clock (`brainDt`): a wolf by its pack, the flock's dog by the one sheepdog rule (creatures/sheepdogBrain.ts)
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
export function installNalatiCreatures(host: SimHost, ports: { bodies: readonly NalatiBody[]; herds: readonly NalatiBootHerd[]; groups: NalatiGroups; grid: BakedGrid; nav: HuntNav;
  trees: (x: number, z: number, r: number) => readonly HuntTree[]; stream: ReturnType<Rng['snapshot']>;
  wildStream: ReturnType<Rng['snapshot']>; bake: NalatiBake; spawnY: number; elites: NalatiEliteBindings; mounted?: () => boolean; crouching?: () => boolean; snapshot?: Readonly<SimSnapshot> }): NalatiHostCreatures {
  const { groups } = ports, player = host.player.position, env = groups.env;
  const rng = new Rng(NALATI_CREATURE_STREAM);
  // PlayerHurt.creature: an environmental blow at the creature, the host's knockback away from it (its tags per kind, made once)
  const tags = new Map<string, `${string}.${string}`[]>(), hitPoint = new Vector3(), hitDir = new Vector3();
  const tagsOf = (kind: string): `${string}.${string}`[] => {
    let row = tags.get(kind);
    if (row === undefined) { row = [`creature.${kind}`, 'feel.blow', 'cover.checked']; tags.set(kind, row); }
    return row;
  };
  const charge = (a: AnimalSim, damage: number): void => {
    hitPoint.copy(a.position); hitDir.set(0, 0, 0);
    host.combat.hit({ source: 'env', sourceTags: tagsOf(a.kind), target: host.player.health, amount: damage, point: hitPoint, dir: hitDir, cause: { kind: a.kind, label: a.label } });
  };
  const hunt = new HuntBrain<NalatiHuntBody>({ rng, fight: { telegraphed: true }, faunaTuning: () => undefined, species: nalatiHuntSpecies() }, {
    ground: nalatiHuntGround(ports.grid, ports.trees), nav: () => ports.nav, reach: (a, p) => canReach(a, p, host.physics),
    wanderGoal: () => { throw new Error('Nalati headless wander goal is not modelled (every hosted body thinks for itself)'); },
    unaware: () => false, now: () => host.clock.now * 1000, sound: () => undefined, charge,
  }, new Vector3());
  // the page's index.ts: the packs, the herds and the dog steer round what the navmesh walls off
  hunt.navSteer = true;
  if (ports.bodies.length > BODY_MAX) throw new Error(`Nalati headless hosts at most ${String(BODY_MAX)} manager bodies`);
  const bodies = ports.bodies.map(b => Object.assign(b.actor, { hidden: false, sampleTerrain: (): void => undefined }));
  // the manager's herds (its hunting brain's), as the boot roster added them
  ports.herds.forEach(h => { hunt.addHerd(h.kind, h.cx, h.cz); });
  bodies.forEach(a => { if (a.herd >= 0) hunt.herds[a.herd]?.members.push(a); });
  // every body's memory where the page adopted it (the stream at its three draws)
  ports.bodies.forEach((b, i) => {
    const a = bodies[i];
    if (a === undefined) return;
    rng.restore(b.boot.adopted.stream); hunt.adopt(a, b.boot.adopted.x, b.boot.adopted.z);
  });
  rng.restore(ports.stream);
  const packOf = new Map<AnimalSim, PackBrain<AnimalSim>>(), herdOf = new Map<AnimalSim, HerdBrain<AnimalSim>>();
  // the groups this step decides for, whose continuations its adapter carries
  const decided = (): readonly (PackBrain<AnimalSim> | HerdBrain<AnimalSim>)[] => [...groups.packs, ...groups.herds];
  groups.packs.forEach(p => { p.members.forEach(m => { packOf.set(m, p); }); });
  groups.herds.forEach(h => { h.members.forEach(m => { herdOf.set(m, h); }); if (h.stallion !== null) herdOf.set(h.stallion, h); });
  // Wildlife's flocks (creatures/wildlife.ts spawnFlock), on the engine's FlockBrain: the shipping flock's own rules (the
  // page's default creatures/flock.ts runs the same spans, test/fixtures/flock-oracle; its declared crowds run FlockBrain), each
  // set up on its own seed as Wildlife builds it, over the page's ground, water and wild view; its dog (the roster's sheepdogs in
  // order, one a flock that has one) thinks on the one sheepdog rule (creatures/sheepdogBrain.ts) over the host's 'ai' stream
  const floor = bakedSamplers(ports.grid), layout = NALATI_WILDLIFE.flocks, rows = nalatiFlockRows(SEED, layout);
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
      setDogFlock(dog, { flock: brain, wolves, ai: () => host.rng.stream('ai').next(), bark: () => undefined });
    }
    return brain;
  });
  const marmots = new MarmotBrain(SEED, { heightAt: floor.heightAt, normalY: (x, z) => floor.normalAt(x, z)[1] });
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

  const speed = { init: false, x: 0, z: 0, v: 0 }, wild = { init: false, x: 0, z: 0, v: 0 };
  const seen = bodies.map(() => false);
  let clock = 0;
  // AnimalManager.thinkCtx / customContext: one context, its per-body fields set before each call
  const c = {
    dt: 0, t: 0, player, playerSpeed: 0, rng, calm: false, herd: null as NalatiHuntBody[] | null,
    hurt: (_damage: number): void => undefined, sound: (_name: string): void => undefined,
    steer: (a: AnimalSim, yaw: number, s: number, turn: number): void => { hunt.steerAny(asHunt(a), yaw, s, turn); },
    pathYaw: (a: AnimalSim, x: number, z: number, every = 1): number => hunt.pathYawFor(asHunt(a), x, z, every),
    confine: (a: AnimalSim): void => { hunt.confine(asHunt(a)); },
    reach: (a: AnimalSim): boolean => canReach(a, player, host.physics),
    claim: groups.claim, mayAttack: groups.mayAttack,
  };
  const byActor = new Map<AnimalSim, NalatiHuntBody>(bodies.map(a => [a, a] as const));
  function asHunt(a: AnimalSim): NalatiHuntBody { const b = byActor.get(a); if (b === undefined) throw new Error(`Nalati headless body ${a.entityId} is not the manager's`); return b; }
  // the body the context speaks for (customContext's `hurt` closes over it on the page)
  let current: NalatiHuntBody | null = null;
  c.hurt = damage => { const a = current; if (a !== null && hunt.facing(a, player, HURT_ARC) && canReach(a, player, host.physics)) charge(a, damage); };
  const context = (a: NalatiHuntBody, dt: number): typeof c => {
    c.dt = dt; c.t = host.clock.now; c.playerSpeed = speed.v; current = a;
    c.herd = a.herd >= 0 ? hunt.herds[a.herd]?.members ?? null : null;
    return c;
  };
  const placement = new Rng(0); placement.restore(ports.wildStream);
  const raids: v.InferOutput<typeof RaidPack>[] = [];
  const spawnSpecies = nalatiSpawnSpecies(), ray = new Vector3(), down = new Vector3(0, -1, 0);
  let nextId = Math.max(...bodies.map(a => Number(a.entityId.slice('creature:'.length)))) + 1;
  const eliteSpawns: v.InferOutput<typeof EliteSpawn>[] = [], retired = new Set<string>();
  let dodgeCd = 0, reinstalling = ports.snapshot !== undefined;
  const makeBody = (saved: v.InferOutput<typeof RaidBody>, kind: 'wolf' | 'leopard', herd: number): NalatiHuntBody => {
    if (bodies.length >= BODY_MAX || !/^creature:\d+$/u.test(saved.id) || Number(saved.id.slice(9)) < nextId || saved.scale <= 0) throw new Error('Invalid Nalati raid roster');
    nextId = Number(saved.id.slice(9)) + 1;
    const template = ports.bake.actors.find(a => a.kind === kind && a.variant === saved.variant);
    if (template === undefined) throw new Error('Missing baked Nalati raid wolf model');
    const [x, y, z] = saved.at;
    const actor = host.spawn({ id: saved.id, spec: template.spec, seed: saved.seed, scale: saved.scale, at: { x, y, z }, yaw: saved.yaw });
    actor.herd = herd; actor.attackTurnCap = ATTACK_TURN;
    const a = Object.assign(actor, { hidden: false, sampleTerrain: (): void => undefined });
    bodies.push(a); seen.push(false); byActor.set(a, a); hunt.herds[herd]?.members.push(a); if (kind === 'wolf') wildWolves.push(a);
    a.levelGround = y !== floor.heightAt(x, z);
    if (a.levelGround) a.groundHeight = (px, pz, py) => {
      ray.set(px, py + 1, pz); const terrain = floor.heightAt(px, pz);
      const hit = castRay(host.physics, ray, down, Math.max(201, py + 2 - terrain), ['WORLD']);
      return hit === null || (hit.material === 'ground' && hit.collider.shape.type === host.physics.R.ShapeType.HeightField) ? terrain : hit.point.y;
    };
    rng.restore(saved.adopted); hunt.adopt(a, x, z);
    // Ride can spawn before AnimalManager.sync in this frame. Give nearby new raiders the same native capsule now.
    // Restoring actors reconnect the saved motors after native world replacement; never allocate a replacement there.
    if (!reinstalling && host.bodyBands?.physics === true && keepsCreatureBody(false, a.alive, a.driven, creatureBodyDistance(a.position, player))) {
      const motor = withOwner(null, () => new CharacterMotor(host.physics, host.creatureMotorOptions(a)));
      motor.resetAt(a.position); a.motor = motor;
    }
    return a;
  };
  const finishPack = (record: v.InferOutput<typeof RaidPack>, members: AnimalSim[]): PackBrain<AnimalSim> => {
    const pack = groups.addPack(members, record.x, record.z);
    members.forEach(a => { packOf.set(a, pack); }); raids.push(record); return pack;
  };
  const spawnPack = (x: number, z: number, variants: readonly string[]): PackBrain<AnimalSim> => {
    if (raids.length >= 2) throw new Error('Nalati raid pack bound exceeded');
    const herd = hunt.herds.length; hunt.addHerd('wolf', x, z);
    const record: v.InferOutput<typeof RaidPack> = { x, z, herd, bodies: [] };
    const place: WildPlacer<NalatiHuntBody> = { rng: placement, bodies: () => bodies,
      ground: { normalY: (px, pz) => floor.normalAt(px, pz)[1], heightAt: floor.heightAt, waterLevel: () => TERRAIN.waterLevel(), wetAt: nalatiWetAt },
      spawn: (_kind, px, pz, yaw, variant) => {
        const rolled = spawnRolls(rng, 'wolf', variant, bodies.some(a => a.kind === 'wolf' && a.rarity === 'legendary'), spawnSpecies);
        const adopted = v.parse(Stream, rng.snapshot()), terrain = floor.heightAt(px, pz), fromY = Math.max(ports.spawnY, terrain) + 1;
        ray.set(px, fromY, pz);
        const hit = castRay(host.physics, ray, down, Math.max(201, fromY - terrain + 1), ['WORLD']);
        const y = hit === null || (hit.material === 'ground' && hit.collider.shape.type === host.physics.R.ShapeType.HeightField) ? terrain : hit.point.y;
        const saved = { id: `creature:${String(nextId)}`, variant: rolled.variant.id, seed: rolled.seed, scale: rolled.scale, at: [px, y, pz] as [number, number, number], yaw, adopted };
        record.bodies.push(saved); return makeBody(saved, 'wolf', herd);
      }, place: (a, px, pz, yaw) => { a.place(px, pz, yaw); } };
    const members = placePack(place, x, z, variants, () => undefined);
    return finishPack(record, members);
  };
  const spawnElite = (kind: 'leopard', x: number, z: number, yaw: number, variant: string): NalatiHuntBody => {
    const rolled = spawnRolls(rng, kind, variant, bodies.some(a => a.kind === kind && a.rarity === 'legendary'), spawnSpecies);
    const adopted = v.parse(Stream, rng.snapshot()), terrain = floor.heightAt(x, z), fromY = Math.max(ports.spawnY, terrain) + 1;
    ray.set(x, fromY, z);
    const hit = castRay(host.physics, ray, down, Math.max(201, fromY - terrain + 1), ['WORLD']);
    const y = hit === null || (hit.material === 'ground' && hit.collider.shape.type === host.physics.R.ShapeType.HeightField) ? terrain : hit.point.y;
    const body: v.InferOutput<typeof RaidBody> = { id: `creature:${String(nextId)}`, variant: rolled.variant.id, seed: rolled.seed,
      scale: rolled.scale, at: [x, y, z], yaw, adopted };
    const a = makeBody(body, kind, -1); eliteSpawns.push({ kind, body }); return a;
  };
  const retireElite = (a: AnimalSim): void => {
    const at = bodies.indexOf(asHunt(a));
    if (a.kind !== 'leopard' || at === -1 || !host.retire(a.entityId)) throw new Error('Invalid Nalati elite retirement');
    a.alive = false; a.position.y = -9999; hunt.forget(asHunt(a)); byActor.delete(a);
    bodies.splice(at, 1); seen.splice(at, 1); retired.add(a.entityId);
    const extra = eliteSpawns.findIndex(row => row.body.id === a.entityId); if (extra !== -1) eliteSpawns.splice(extra, 1);
  };
  // Strict state supplies only the roster at reinstall, in GLOBAL allocation order even when raids and elite respawns interleave.
  const restoreRoster = (): void => {
    if (ports.snapshot === undefined) return;
    const value = ports.snapshot.adapters.find(a => a.id === NALATI_CREATURES_STEP)?.state;
    const saved = v.parse(Saved, value);
    if (saved.raids.length > 2 || saved.elites.length > BODY_MAX || saved.retired.length > BODY_MAX
      || new Set(saved.retired).size !== saved.retired.length) throw new Error('Invalid Nalati saved roster bounds');
    const initial = nextId;
    saved.retired.forEach(id => {
      if (!/^creature:\d+$/u.test(id) || Number(id.slice(9)) >= saved.nextId) throw new Error('Invalid Nalati retired id');
      const a = host.entities.get(id); if (a !== undefined) retireElite(a); else if (Number(id.slice(9)) < initial) throw new Error('Missing Nalati retired boot actor');
      retired.add(id);
    });
    saved.raids.forEach(record => {
      if (record.herd !== hunt.herds.length || record.bodies.length !== 3) throw new Error('Invalid Nalati saved raid herd');
      hunt.addHerd('wolf', record.x, record.z);
    });
    const spawnRows: { body: v.InferOutput<typeof RaidBody>; kind: 'wolf' | 'leopard'; herd: number }[] = [];
    for (let i = 0; i < 2; i++) {
      const record = saved.raids[i]; if (record === undefined) break;
      for (let j = 0; j < 3; j++) { const body = record.bodies[j]; if (body !== undefined) spawnRows.push({ body, kind: 'wolf', herd: record.herd }); }
    }
    for (let i = 0; i < BODY_MAX; i++) { const row = saved.elites[i]; if (row === undefined) break; spawnRows.push({ body: row.body, kind: row.kind, herd: -1 }); }
    spawnRows.sort((a, b) => Number(a.body.id.slice(9)) - Number(b.body.id.slice(9)));
    for (let i = 0; i < BODY_MAX; i++) {
      const row = spawnRows[i]; if (row === undefined) break;
      if (retired.has(row.body.id) || Number(row.body.id.slice(9)) >= saved.nextId) throw new Error('Invalid Nalati active spawn id');
      makeBody(row.body, row.kind, row.herd);
    }
    if (saved.nextId < nextId) throw new Error('Invalid Nalati next spawn identity');
    nextId = saved.nextId;
    saved.raids.forEach(record => { finishPack(record, record.bodies.map(b => {
      const a = host.entities.get(b.id); if (a === undefined) throw new Error('Missing restored Nalati raid actor'); return a;
    })); });
    eliteSpawns.push(...saved.elites);
  };
  const firstFlock = flocks[0] ?? null;
  const horse = bodies.find(a => a.kind === 'horse' && a.herd === -1 && firstFlock !== null
    && a.position.x === firstFlock.cx + 12 && a.position.z === firstFlock.cz + 16) ?? null;
  const raid = new HeadlessSheepRaid(host, groups, firstFlock, horse, i => {
    const prey = preyRows[0]?.[i]; if (prey === undefined) throw new Error('Unknown Nalati sheep'); return prey;
  }, spawnPack);
  /** AnimalManager.think for a self-thinking species: the dead and the stunned hold, else its own decision, the herd's centre after */
  const missingElite = new Error('Nalati leopard has no hosted elite brain');
  const decide = (a: NalatiHuntBody, dt: number): void => {
    const elite = ports.elites.brains.get(a);
    if (!a.alive) { a.lookWeight = 0; return; }
    if (a.kind === 'leopard' && elite === undefined) throw missingElite;
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
      const a = byActor.get(body);
      // the sheepdog has no body act (its species has none)
      if (a === undefined || !a.alive || a.stunned || a.kind === 'sheepdog') return;
      const elite = ports.elites.brains.get(a);
      if (elite !== undefined) elite.act(a);
      else if (a.kind === 'wolf') actWolfBody(a, context(a, dt), packOf.get(a) ?? null);
      else actHorseBody(a, context(a, dt), herdOf.get(a) ?? null);
    },
    after: (_id, body) => {
      const a = byActor.get(body);
      if (a?.alive === true && !a.stunned && a.state === 'charge') hunt.chargeContact(a, player);
    },
  });
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
    marmots.update(dt, player, wild.v, env.playerCrouched, whistle);
    for (let i = 0; i < GROUP_MAX; i++) {
      const h = groups.herds[i]; if (h === undefined) break;
      if (h.stampeding) for (let j = 0; j < GROUP_MAX; j++) { const p = groups.packs[j]; if (p === undefined) break; p.scare(h.cx, h.cz, 20); }
    }
    // Ride.update follows Wildlife and precedes the manager's think loop on the page.
    raid.update(dt, wolves);
    // the manager's think loop
    if (!speed.init) { speed.x = player.x; speed.z = player.z; speed.init = true; }
    const moved = Math.hypot(player.x - speed.x, player.z - speed.z);
    speed.x = player.x; speed.z = player.z;
    speed.v += (Math.min(moved / dt, 9) - speed.v) * (1 - 0.5 ** (dt * 10));
    hunt.beginTick(dt); clock += dt; hunt.resetRepaths();
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
      if (a.harnessHold) continue;
      let urgent = false;
      if (a.alive && a.aggressive && (a.state === 'charge' || a.state === 'stalk' || a.state === 'alert')) {
        const line = canReach(a, player, host.physics);
        urgent = seen[i] === true && !line; seen[i] = line;
      }
      const brain = host.brainDt(a.entityId, urgent);
      if (brain > 0) decide(a, brain);
    }
  }, {
    snapshot: () => ({ dodgeCd, nextId, retired: [...retired], elites: eliteSpawns.map(row => ({ kind: row.kind, body: { ...row.body, at: [...row.body.at], adopted: { ...row.body.adopted } } })), rng: { ...rng.snapshot() }, clock, speed: { ...speed }, seen: [...seen],
      memories: bodies.flatMap(a => { const m = hunt.memory(a); return m === undefined ? [] : [[a.entityId, saveMemory(m)] as [string, SavedMemory]]; }),
      herds: hunt.herds.map(h => [h.cx, h.cz] as [number, number]), groups: decided().map(g => g.snapshot()), wild: { ...wild }, flocks: flocks.map(f => f.snapshot()), marmots: marmots.snapshot(), placement: { ...placement.snapshot() }, raids: raids.map(r => ({ x: r.x, z: r.z, herd: r.herd, bodies: r.bodies.map(b => ({ id: b.id, variant: b.variant, seed: b.seed, scale: b.scale, at: [...b.at], yaw: b.yaw, adopted: { ...b.adopted } })) })) }),
    restore: value => {
      const saved = v.parse(Saved, value);
      if (saved.seen.length !== bodies.length || saved.herds.length !== hunt.herds.length || saved.groups.length !== decided().length || saved.flocks.length !== flocks.length) throw new Error('Incompatible Nalati creatures continuation');
      dodgeCd = saved.dodgeCd;
      marmots.restore(saved.marmots); placement.restore(saved.placement); rng.restore(saved.rng); Object.assign(speed, saved.speed); saved.seen.forEach((s, i) => { seen[i] = s; });
      // the brain's clock is a sum of the same steps: a fresh brain takes the saved sum exactly
      hunt.beginTick(saved.clock - clock); clock = saved.clock;
      const memories = new Map(saved.memories);
      bodies.forEach(a => {
        const m = hunt.memory(a), s = memories.get(a.entityId);
        if ((m === undefined) !== (s === undefined)) throw new Error(`Incompatible Nalati hunting memory for ${a.entityId}`);
        if (m !== undefined && s !== undefined) loadMemory(m, s);
      });
      saved.herds.forEach(([cx, cz], i) => { const h = hunt.herds[i]; if (h !== undefined) { h.cx = cx; h.cz = cz; } });
      saved.groups.forEach((state, i) => { decided()[i]?.restore(state); });
      Object.assign(wild, saved.wild); saved.flocks.forEach((state, i) => { flocks[i]?.restore(state); });
    },
  });
  // Match the original adapter insertion order: fixed controllers first, actors materialized later.
  restoreRoster(); reinstalling = false;
  const out = { hunt, rng, bodies, flocks, raid, marmots, spawnElite, retireElite, scare: wildScare };
  installed.set(host, out);
  return out;
}
