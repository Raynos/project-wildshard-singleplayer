import * as v from 'valibot';
import { Vector3 } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import type { AnimalSim, AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { spawnRolls, type HuntBody, type HuntNav } from '@wildshard/engine/ai/hunt';
import { createNativeHunt, huntRosterContinuation } from '@wildshard/game/plugin/brain';
import { PINE_NATIVE_HUNT } from '../data/nativeHunt';
import { createNativeCreatureRoster, type NativeCreatureSlot } from '@wildshard/game/shardfile/homeKeeper';
import type { BakedGrid } from '@wildshard/engine/world/BakedTerrain';
import type { SimHost } from '@wildshard/engine/sim';
import { isEliteVariant, PINE_ELITE_ANIMALS, PINE_ELITE_DEFS, swapRolledElites } from '../combat/eliteRoster';
import { pineEliteStreams } from '../combat/eliteStreams';
import { SPAWN } from '../data/layout';
import { PINE_FAUNA } from '../data/fauna.generated';
import { PINE_HERD_STREAM, PINE_KING_KIND, pineHuntGround, pineSpawnSpecies } from './herds';
import type { PineBake } from './baked';
import { installKingPoseKeeper } from './kingPoseKeeper';

/** The roster keeper's fixed-step id. */
export const ROSTER_STEP = 'pine.roster';
/** The manager's list at load (160 herd bodies and the 4 lair elites); a live spawn (a rival, an elite's respawn) joins after. */
const BODY_COUNT = 164;
/** The most bodies a play may add to the list: two rivals a bugle, a respawn per lair every 20 minutes. Every keeper loop is
 *  bounded by the list, the list by this. */
const LIVE_MAX = 512;
/** combat/ctx.ts SCRIPTED: the state a fight's own animal holds (the manager's loop leaves it alone). */
const SCRIPTED = 'sidestep';

/** A renderer-free body as the hunting brain and the elites' scripts drive it: the host's body, never drawn (`hidden` is a fight's
 *  own flag: the Ghost Stag's fade, Blackpaw in his cave). */
export type PineHuntBody = AnimalSim & { hidden: boolean; sampleTerrain: () => void; foreCapsule?: (a: Vector3, b: Vector3) => boolean; ribsWorld?: (out: Vector3) => Vector3;
  /** A view-only lantern read forces this consumer chain before the ordinary render publication. */
  publishKingHead?: () => void };
/** One manager body: its id and kind, the live host actor, and whether a fight scripts it (an elite). */
export interface PineBody { readonly id: string; readonly kind: string; readonly actor: PineHuntBody; readonly scripted: boolean }
/** A parked prewarm body (runtime/antlerKing.ts `prewarm`): its id and rolled recipe, no host body until the King's script calls it. */
export interface PineParked { readonly id: string; readonly kind: string; readonly variant: string; readonly spec: AnimalSimSpec; readonly seed: number; readonly scale: number }
export interface PineRosterPorts {
  readonly bake: PineBake;
  /** The rain keeper's goal from the same weather reading, lent before the roster starts thinking. */
  readonly wanderGoal?: (herd: number) => { x: number; z: number; r: number } | null;
  /** the terrain grid the page installs before the herds (public/assets/baked/pine-hollow/terrain.bin) */
  readonly grid: BakedGrid;
  /** the shard's baked navmesh (public/assets/baked/pine-hollow/navmesh.bin), as the page's hunting brain asks it */
  readonly nav: HuntNav | null;
  /** the level's authored spawn height (shard.config.ts `spawn.y`): the manager's spawn ray starts a metre over it or the ground */
  readonly spawnY: number;
  /** a restoring host's decoded continuation (SimSnapshot's adapters and entities): its live spawns are reinstalled, in the host's order, after the roster's step */
  readonly saved?: { readonly adapters: readonly { readonly id: string; readonly state: unknown }[]; readonly entities: readonly { readonly id: string; readonly state: { readonly flags: { readonly levelGround: boolean } } }[] } | undefined;
}

const finite = v.pipe(v.number(), v.finite());
const Stream = v.strictObject({ version: v.literal(1), state: finite, initial: finite, scrambledFork: v.boolean() });
const Memory = v.record(v.string(), v.union([finite, v.boolean(), v.array(v.tuple([finite, finite, finite]))]));
const Saved = v.strictObject({ version: v.literal(3), rng: Stream, clock: finite, speed: v.strictObject({ init: v.boolean(), x: finite, z: finite, v: finite }),
  next: v.pipe(v.number(), v.integer(), v.minValue(BODY_COUNT)),
  bodies: v.pipe(v.array(v.strictObject({ id: v.string(), kind: v.string(), seen: v.boolean(), memory: Memory })), v.maxLength(LIVE_MAX)),
  herds: v.array(v.tuple([finite, finite])) });
/**
 * Pine Hollow's creature manager in a renderer-free host (SF72), as the shipping AnimalManager builds and thinks it. The boot
 * roster comes from the one creature stream `Rng(1337 + 31)` in the page's exact order, every id, kind, variant, seed and scale
 * checked against the trusted bake: the herds (`HuntBrain.placeHerds` over the baked ground and the shard's fauna plan), the
 * boot swap of a rolled elite variant (combat/eliteRoster.ts), the Antler King's prewarm (his body and two thralls: their
 * draws and ids only, parked out of the manager's list with no body, as the page parks them hidden and bodiless), then the
 * four lair elites at their lairs (each spawn yaw from the level seed's `pine.elite.spawn.<id>`, taken under a fight's
 * control: out of its herd, scripted). Every body stands on the manager's creature floor (the first WORLD hit under its
 * spawn ray; the terrain when that is the ground's heightfield) and is adopted by the hunting brain (three more draws).
 *
 * The host runs on the page's distance bands (`useBodyBands`: the bodies' 'ai' update rate and the creature body LOD), and
 * every tick, in the manager's list order: the herds' decisions on the band's brain clock (`brainDt`: 20 Hz within 60 m,
 * 10 Hz to 160 m, paused beyond) and a pinned elite's every frame (its state is the fight's: the brain's ambient calls and confine
 * still run, as the page's do), a 'lost.sight' wake when a stalking / charging / alert hunter loses its line to the player,
 * the hit reaction and its wake on a non-lethal blow, and a running charge on the body clock (`advanceCharge`), its contact
 * filed as the page's PlayerHurt.creature files it (`feel.blow`: the host knocks the player back). The player's noise is the
 * manager's smoothed ground speed (the headless player never sprints).
 *
 * A live spawn in play (`spawn`: the Imperial Bull's rivals, an elite's respawn) is the manager's spawnAnimal: the stream's
 * rolls under the manager's next entity id (EntityIds('creature'): the load-time list and the prewarm took creature:0–163),
 * the recipe the bake read for that kind and variant, the creature floor a metre over the spawn height or the ground, its
 * memory (three more draws); it joins the end of the list and the host's dynamic roster. A restoring install reinstalls
 * every saved live spawn from the host's own recipe, in the saved order, after this step (the host snapshots in registration
 * order). The four elites' fights run beside it (runtime/elites.ts), on these bodies, and the Antler King's (runtime/king.ts:
 * his parked prewarm body made real out of the list, `adoptParked`; a fallen King's next body, `spawnLoose`: a live
 * spawn kept out of the list; his thralls are live spawns). A restoring install
 * reinstalls every saved body the boot did not make in the host's own order, listed or not. Rain goals are lent by the
 * single native weather/shelter owner before this roster's tick.
 */
export function installPineRoster(host: SimHost, ports: PineRosterPorts): {
  bodies: () => readonly PineBody[]; parked: () => readonly PineParked[]; hunt: ReturnType<typeof createNativeHunt>['hunt'];
  /** AnimalManager.spawn in play: a live creature (the stream's draws, the next entity id), at the end of the list */
  spawn: (kind: string, x: number, z: number, yaw: number, variant: string) => PineHuntBody;
  /** the same live spawn kept out of the list (a fight's own body that thinks nothing: a fallen Antler King's next night) */
  spawnLoose: (kind: string, x: number, z: number, yaw: number, variant: string) => PineHuntBody;
  /** AnimalManager.retire: out of the list, the brain and the host */
  retire: (a: HuntBody) => void;
  /** a parked prewarm body (the Antler King's) as a host body at (x, z), kept out of the list */
  adoptParked: (id: string, x: number, z: number, yaw: number) => PineHuntBody;
  /** a body this roster made (listed or not) by entity id */
  actor: (id: string) => PineHuntBody | null;
} {
  const { bake, grid } = ports, rng = new Rng(PINE_HERD_STREAM), player = host.player.position;
  const kingPose = installKingPoseKeeper(host);
  // the page's distance bands (engine/sim/bands.ts, Pine overrides no tier ticks): the scheduler's 'ai' rate for the herds
  // (every frame within 60 m, every other frame to 160 m, paused beyond; decisions at 20 / 10 Hz), 'always' for a scripted
  // elite (pinned: it thinks every frame), and the creature body LOD (a capsule within 45 m, released past 55). Before any
  // spawn, and on a restoring host before the host restores its clocks.
  const kingRow = bake.parked[0];
  if (kingRow?.kind !== PINE_KING_KIND) throw new Error('Pine bake has no Antler King prewarm');
  const species = pineSpawnSpecies({ id: kingRow.variant, label: kingRow.spec.label, weight: 1, rarity: kingRow.spec.rarity, scale: [kingRow.scale, kingRow.scale] });
  const { hunt, reach } = createNativeHunt(host, PINE_NATIVE_HUNT, { rng, ground: pineHuntGround(grid), nav: ports.nav, species,
    ...(ports.wanderGoal === undefined ? {} : { wanderGoal: ports.wanderGoal }), present: body => !('hidden' in body) || body.hidden !== true });
  // the shared native roster (G454 rows): the bake's first spec per kind.variant, the manager's spawn ray and creature floor
  // over the page's terrain grid (the host's ground), every kind adopted by the hunting brain, no turn cap, a restoring
  // host's saved floor flags
  const intake = createNativeCreatureRoster<NativeCreatureSlot>(host, { specs: [...bake.actors, ...bake.parked].map(row => row.spec), duplicates: 'first',
    variants: new Map(), rng, spawnY: ports.spawnY, hunt, hunted: 'every', ...(ports.saved === undefined ? {} : { saved: ports.saved }) });
  /** Every body this roster made, listed or kept out of the list by a fight, by entity id. */
  const made = (id: string): PineHuntBody | null => intake.byId.get(id)?.actor ?? null;
  const list: PineBody[] = [], parked: PineParked[] = [];
  const baked = new Map(bake.actors.map(a => [a.id, a] as const)), bakedParked = new Map(bake.parked.map(a => [a.id, a] as const));
  let next = 0, booted = false;
  const rolls = (kind: string, variant: string | string[] | undefined): { id: string; spec: AnimalSimSpec; seed: number; scale: number; variant: string } => {
    const r = spawnRolls(rng, kind, variant, list.some(b => b.actor.kind === kind && b.actor.rarity === 'legendary' && b.actor.alive), known => {
      const row = species.get(known); if (row === undefined) throw new Error(`Pine has no creature row '${known}'`); return row; });
    const id = `creature:${String(next++)}`;
    // a live spawn takes the next id past the load-time list, with the recipe the bake read for its kind and variant
    if (booted) return { id, spec: intake.spec(kind, r.variant.id), seed: r.seed, scale: r.scale, variant: r.variant.id };
    const row = baked.get(id) ?? bakedParked.get(id);
    if (row === undefined) {
      // only a herd body that rolled an elite's identity is missing from the load-time list (the boot swap retired it): its
      // recipe is that identity's, which the elite at its lair carries
      if (!isEliteVariant(kind, r.variant.id)) throw new Error(`Pine roster diverges from the page at ${id}`);
      return { id, spec: intake.spec(kind, r.variant.id), seed: r.seed, scale: r.scale, variant: r.variant.id };
    }
    // the bake is the page's own roll: a divergent draw anywhere refuses the roster rather than simulating another world
    if (row.kind !== kind || row.variant !== r.variant.id || row.seed !== r.seed || row.scale !== r.scale) throw new Error(`Pine roster diverges from the page at ${id}`);
    return { id, spec: row.spec, seed: r.seed, scale: r.scale, variant: r.variant.id };
  };
  const seen: boolean[] = [];
  const slot = (id: string, kind: string, variant: string, spec: AnimalSimSpec, seed: number, scale: number, at: { x: number; y: number; z: number }, yaw: number): NativeCreatureSlot =>
    ({ id, kind, variant, herd: -1, range: [scale, scale], actor: null, recipe: { id, spec, seed, scale, at, yaw } });
  /** a body the shared roster made, out of any herd; the King's pose joins his; a listed body joins the manager's list */
  const join = (a: PineHuntBody, kind: string, listed: boolean): PineHuntBody => {
    if (kind === PINE_KING_KIND) kingPose.attach(a);
    a.herd = -1;
    if (!listed) return a;
    if (list.length >= LIVE_MAX) throw new Error('Pine roster is full');
    list.push({ id: a.entityId, kind, actor: a, scripted: false }); seen.push(false);
    return a;
  };
  /** AnimalManager.spawnAnimal: the shared stream's rolls, the creature floor from a metre over the ground, the brain's memory. */
  const spawn = (kind: string, x: number, z: number, yaw: number, variant: string | string[] | undefined, listed = true): PineHuntBody => {
    const r = rolls(kind, variant), body = slot(r.id, kind, r.variant, r.spec, r.seed, r.scale, { x, y: 0, z }, yaw);
    const a = join(intake.arrive(body), kind, listed);
    intake.remember(body);
    return a;
  };
  /** AnimalManager.retire: out of the list, the King's pose, the brain and the host */
  const retire = (a: HuntBody): void => {
    const i = list.findIndex(b => b.actor === a); if (i !== -1) { list.splice(i, 1); seen.splice(i, 1); }
    kingPose.retire(a.entityId);
    const body = intake.byId.get(a.entityId);
    if (body === undefined) { hunt.forget(a); host.retire(a.entityId); } else intake.retire(body);
  };
  Array.from(hunt.placeHerds(PINE_FAUNA, SPAWN, spawn)); // every herd in one go
  swapRolledElites({ bodies: list.map(b => b.actor), herds: hunt.herds, retire, spawn });
  // the King's prewarm: his body, an elk thrall and a boar thrall at his clearing, parked out of the list (no body here)
  ([[PINE_KING_KIND, kingRow.variant], ['elk', 'thrall'], ['boar', 'thrall']] as const).forEach(([kind, variant]) => {
    const r = rolls(kind, variant);
    for (let i = 0; i < 3; i++) rng.next(); // its memory's three draws (HuntBrain.adopt: timer, fleeUntil, callT)
    parked.push({ id: r.id, kind, variant: r.variant, spec: r.spec, seed: r.seed, scale: r.scale });
  });
  Object.keys(PINE_ELITE_DEFS).forEach(id => {
    const def = PINE_ELITE_DEFS[id], who = PINE_ELITE_ANIMALS[id];
    if (def === undefined || who === undefined) throw new Error(`Pine elite ${id} has no animal`);
    const yaw = pineEliteStreams(id, host.level.seed).spawn.next() * Math.PI * 2;
    const a = spawn(who.kind, def.lair.x, def.lair.z, yaw, who.variant);
    a.herd = -1; a.state = SCRIPTED; a.scripted = true;
    const i = list.findIndex(b => b.actor === a), body = list[i];
    if (body !== undefined) list[i] = { ...body, scripted: true };
  });
  if (list.length !== BODY_COUNT || bake.actors.length !== BODY_COUNT || list.some((b, i) => { const row = bake.actors[i]; return row === undefined || b.id !== row.id || b.scripted !== row.scripted; })
    || hunt.herds.length !== bake.herds.length || hunt.herds.some((h, i) => JSON.stringify(h.members.map(m => m.entityId)) !== JSON.stringify(bake.herds[i]?.members))) throw new Error('Pine roster diverges from the page\'s list');

  booted = true;
  const speed = { seen: false, prev: new Vector3(), speed: 0 };
  const continuation = huntRosterContinuation(hunt, PINE_NATIVE_HUNT, { rng, bodies: () => list, actor: body => body.actor, noise: speed, sight: seen });
  const cadence = hunt.bindRoster({ limit: LIVE_MAX, order: 'combined', at: i => list[i], actor: body => body.actor,
    id: body => body.id, player, noise: speed, sight: seen, reach,
    brainDt: (id, urgent) => host.brainDt(id, urgent) });
  host.events.on('damage.dealt', ({ req, killed }) => { cadence.damaged(req.target, killed); }, host.scope);

  host.onStep(ROSTER_STEP, dt => {
    cadence.observe(dt); continuation.advance(dt); cadence.decide();
    // a running charge on the body clock: its band's step (0 on a paused or off frame, both frames' time on the next)
    for (let i = 0; i < LIVE_MAX; i++) {
      const body = list[i], a = body?.actor;
      if (body === undefined) break;
      if (a?.alive !== true || a.stunned || a.state !== 'charge') continue;
      const step = host.bodyDt(body.id); if (step > 0) hunt.advanceCharge(a, step, player);
    }
  }, {
    snapshot: () => { const common = continuation.snapshot(); return ({ version: 3, rng: common.rng, clock: common.clock, speed: { init: common.noise.seen, x: common.noise.prev[0], z: common.noise.prev[2], v: common.noise.speed }, next,
      bodies: list.map((b, i) => {
        const memory = common.memories[i]; if (memory === undefined || memory === null) throw new Error(`Pine body ${b.id} has no memory`);
        return { id: b.id, kind: b.kind, seen: seen[i] === true, memory };
      }),
      herds: common.herds }); },
    restore: value => {
      const state = v.parse(Saved, value);
      if (state.bodies.length !== list.length || state.herds.length !== hunt.herds.length || state.bodies.some((b, i) => b.id !== list[i]?.id)) throw new Error('Incompatible Pine roster continuation');
      next = state.next;
      continuation.restore({ rng: state.rng, clock: state.clock, noise: { seen: state.speed.init, prev: [state.speed.x, 0, state.speed.z], speed: state.speed.v },
        memories: state.bodies.map(body => body.memory), sight: state.bodies.map(body => body.seen), herds: state.herds });
    },
  });
  // a restoring install: the saved list's live spawns from the host's own recipes, in order (a body retired in play leaves it)
  const saved = ports.saved, keeper = saved === undefined ? undefined : v.parse(Saved, saved.adapters.find(adapter => adapter.id === ROSTER_STEP)?.state);
  if (saved !== undefined && keeper !== undefined) {
    const kept = new Map(keeper.bodies.map(b => [b.id, b] as const));
    [...list].forEach(b => { if (!kept.has(b.id)) retire(b.actor); });
    // every saved body the boot did not make, in the host's own order: the live spawns in the list, and the bodies a fight
    // keeps out of it (the Antler King's: his species thinks nothing, the fight drives him)
    saved.entities.forEach(({ id }) => {
      if (host.entities.has(id)) return;
      const checked = intake.read(saved, id), b = kept.get(id), kind = b?.kind ?? checked.spec.kind, variant = checked.spec.variant;
      const a = join(intake.reinstall(slot(id, kind, variant, intake.spec(kind, variant), checked.seed, checked.scale, { ...checked.at }, checked.yaw), saved), kind, b !== undefined);
      if (b !== undefined) hunt.adopt(a, checked.at.x, checked.at.z); // its memory: the continuation overwrites it and the stream it drew from
    });
    if (keeper.bodies.some((b, i) => b.id !== list[i]?.id)) throw new Error('Incompatible Pine roster continuation');
  }
  /** a parked prewarm body made real where the page spawned it, out of the list (the King when he first comes): no draws */
  const adoptParked = (id: string, x: number, z: number, yaw: number): PineHuntBody => {
    const row = parked.find(p => p.id === id);
    if (row === undefined) throw new Error(`Pine has no parked body ${id}`);
    return join(intake.arrive(slot(id, row.kind, row.variant, row.spec, row.seed, row.scale, { x, y: 0, z }, yaw)), row.kind, false);
  };
  return { bodies: () => list, parked: () => parked, hunt, spawn: (kind, x, z, yaw, variant) => spawn(kind, x, z, yaw, variant),
    spawnLoose: (kind, x, z, yaw, variant) => spawn(kind, x, z, yaw, variant, false), retire, adoptParked,
    actor: made };
}
