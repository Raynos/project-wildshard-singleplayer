import * as v from 'valibot';
import { Vector3 } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import type { AnimalSim, AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { HuntBrain, spawnRolls, type HuntBody, type HuntMemory, type HuntNav } from '@wildshard/engine/ai/hunt';
import { canReach } from '@wildshard/engine/ai/reach';
import { castRay } from '@wildshard/engine/physics/query';
import type { BakedGrid } from '@wildshard/engine/world/BakedTerrain';
import type { SimHost, SimSpawn } from '@wildshard/engine/sim';
import { isEliteVariant, PINE_ELITE_ANIMALS, PINE_ELITE_DEFS, swapRolledElites } from '../combat/eliteRoster';
import { pineEliteStreams } from '../combat/eliteStreams';
import { SPAWN } from '../layout';
import { PINE_FAUNA } from './fauna';
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
/** What a renderer-free body adds for the hunting brain: not hidden (no view; a fight may hide it), no ground tilt to sample. */
const HUNT_BODY: { hidden: boolean; sampleTerrain: () => void } = { hidden: false, sampleTerrain: (): void => undefined };
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
  /** the terrain grid the page installs before the herds (public/assets/baked/pine-hollow/terrain.bin) */
  readonly grid: BakedGrid;
  /** the shard's baked navmesh (public/assets/baked/pine-hollow/navmesh.bin), as the page's hunting brain asks it */
  readonly nav: HuntNav | null;
  /** the level's authored spawn height (shard.config.ts `spawn.y`): the manager's spawn ray starts a metre over it or the ground */
  readonly spawnY: number;
  /** a restoring host's decoded continuation (SimSnapshot's adapters and entities): its live spawns are reinstalled, in the host's order, after the roster's step */
  readonly saved?: { readonly adapters: readonly { readonly id: string; readonly state: unknown }[]; readonly entities: readonly { readonly id: string }[] } | undefined;
}

const finite = v.pipe(v.number(), v.finite());
const Stream = v.strictObject({ version: v.literal(1), state: finite, initial: finite, scrambledFork: v.boolean() });
const Memory = v.record(v.string(), v.union([finite, v.boolean(), v.array(v.tuple([finite, finite, finite]))]));
const Saved = v.strictObject({ version: v.literal(3), rng: Stream, clock: finite, speed: v.strictObject({ init: v.boolean(), x: finite, z: finite, v: finite }),
  next: v.pipe(v.number(), v.integer(), v.minValue(BODY_COUNT)),
  bodies: v.pipe(v.array(v.strictObject({ id: v.string(), kind: v.string(), seen: v.boolean(), memory: Memory })), v.maxLength(LIVE_MAX)),
  herds: v.array(v.tuple([finite, finite])) });
const Point = v.strictObject({ x: finite, y: finite, z: finite });
/** The host's own recipe of a live spawn (SimHost.spawn's `runtime.actor.<id>` contract), checked before it is reinstalled. */
const Recipe = v.looseObject({ id: v.string(), spec: v.looseObject({ kind: v.string(), variant: v.string() }), seed: finite, scale: finite, at: Point, yaw: finite });
type SavedMemory = v.InferOutput<typeof Memory>;
const point = (p: unknown): [number, number, number] => { if (!(p instanceof Vector3)) throw new Error('Unsaveable Pine hunting path'); return [p.x, p.y, p.z]; };
/** A body's hunting memory as plain values (its path's points as triples). */
function saveMemory(memory: HuntMemory): SavedMemory {
  const out: SavedMemory = {};
  Object.keys(memory).forEach(key => {
    const value: unknown = Reflect.get(memory, key);
    out[key] = Array.isArray(value) ? value.map(point) : typeof value === 'boolean' ? value : Number(value);
  });
  return out;
}
/** Write a saved memory back into the brain's own record, field for field (a missing or retyped field refuses). */
function loadMemory(memory: HuntMemory, saved: SavedMemory): void {
  const keys = Object.keys(memory);
  if (keys.length !== Object.keys(saved).length) throw new Error('Incompatible Pine hunting memory');
  keys.forEach(key => {
    const value = saved[key], known: unknown = Reflect.get(memory, key);
    if (value === undefined || Array.isArray(value) !== Array.isArray(known) || (!Array.isArray(value) && typeof value !== typeof known)) throw new Error(`Incompatible Pine hunting memory ${key}`);
    Reflect.set(memory, key, Array.isArray(value) ? value.map(([x, y, z]) => new Vector3(x, y, z)) : value);
  });
}

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
 * reinstalls every saved body the boot did not make in the host's own order, listed or not. Not yet owned (fail-closed,
 * progress/shard-platform/handoffs/sf72-pine.md): the rain's wander goals.
 */
export function installPineRoster(host: SimHost, ports: PineRosterPorts): {
  bodies: () => readonly PineBody[]; parked: () => readonly PineParked[]; hunt: HuntBrain<HuntBody>;
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
  /** Every body this roster made, listed or kept out of the list by a fight, by entity id. */
  const made = new Map<string, PineHuntBody>();
  // the page's distance bands (engine/sim/bands.ts, Pine overrides no tier ticks): the scheduler's 'ai' rate for the herds
  // (every frame within 60 m, every other frame to 160 m, paused beyond; decisions at 20 / 10 Hz), 'always' for a scripted
  // elite (pinned: it thinks every frame), and the creature body LOD (a capsule within 45 m, released past 55). Before any
  // spawn, and on a restoring host before the host restores its clocks.
  host.useBodyBands({ rate: body => body.driven || body.scripted || body.state === SCRIPTED ? 'always' : 'ai',
    present: body => made.get(body.entityId)?.hidden !== true });
  const kingRow = bake.parked[0];
  if (kingRow?.kind !== PINE_KING_KIND) throw new Error('Pine bake has no Antler King prewarm');
  const species = pineSpawnSpecies({ id: kingRow.variant, label: kingRow.spec.label, weight: 1, rarity: kingRow.spec.rarity, scale: [kingRow.scale, kingRow.scale] });
  const ground = pineHuntGround(grid), heightAt = ground.heightAt;
  const charge = (a: HuntBody, damage: number): void => {
    // PlayerHurt.creature: an environmental blow at the creature, the host's knockback away from it
    host.combat.hit({ source: 'env', sourceTags: [`creature.${a.kind}`, 'feel.blow', 'cover.checked'], target: host.player.health, amount: damage,
      point: a.position.clone(), dir: new Vector3(), cause: { kind: a.kind, label: a.label } });
  };
  const hunt = new HuntBrain<HuntBody>({ rng, fight: { telegraphed: false }, faunaTuning: () => undefined, species }, {
    ground, nav: () => ports.nav, reach: (a, p) => canReach(a, p, host.physics), wanderGoal: () => null, unaware: () => false,
    now: () => host.clock.now * 1000, sound: () => undefined, charge,
  }, new Vector3());
  const list: PineBody[] = [], parked: PineParked[] = [];
  const baked = new Map(bake.actors.map(a => [a.id, a] as const)), bakedParked = new Map(bake.parked.map(a => [a.id, a] as const));
  let next = 0, booted = false;
  /** the bake's recipe for a kind and variant (every body of one kind and variant reads the same row) */
  const recipeOf = (kind: string, variant: string): AnimalSimSpec => {
    // the King's prewarm rows carry his own recipe and the thralls' (the page parks them; a live thrall or King reads them)
    const row = bake.actors.find(a => a.kind === kind && a.variant === variant) ?? bake.parked.find(a => a.kind === kind && a.variant === variant);
    if (row === undefined) throw new Error(`Pine bake has no ${kind} '${variant}' to spawn live`);
    return row.spec;
  };
  const origin = { x: 0, y: 0, z: 0 }, down = { x: 0, y: -1, z: 0 }, sees = ['WORLD'] as const;
  /** creatureFloor: the first WORLD hit under `fromY`; the terrain when it is the ground's heightfield (or nothing). */
  const creatureFloor = (x: number, z: number, fromY: number): { y: number; structure: boolean } => {
    const terrain = heightAt(x, z);
    origin.x = x; origin.y = fromY; origin.z = z;
    const hit = castRay(host.physics, origin, down, Math.max(201, fromY - terrain + 1), sees);
    if (hit === null || (hit.material === 'ground' && hit.collider.shape.type === host.physics.R.ShapeType.HeightField)) return { y: terrain, structure: false };
    return { y: hit.point.y, structure: true };
  };
  const rolls = (kind: string, variant: string | string[] | undefined): { id: string; spec: AnimalSimSpec; seed: number; scale: number; variant: string } => {
    const r = spawnRolls(rng, kind, variant, list.some(b => b.actor.kind === kind && b.actor.rarity === 'legendary' && b.actor.alive), species);
    const id = `creature:${String(next++)}`;
    // a live spawn takes the next id past the load-time list, with the recipe the bake read for its kind and variant
    if (booted) return { id, spec: recipeOf(kind, r.variant.id), seed: r.seed, scale: r.scale, variant: r.variant.id };
    const row = baked.get(id) ?? bakedParked.get(id);
    if (row === undefined) {
      // only a herd body that rolled an elite's identity is missing from the load-time list (the boot swap retired it): its
      // recipe is that identity's, which the elite at its lair carries
      const same = isEliteVariant(kind, r.variant.id) ? bake.actors.find(a => a.kind === kind && a.variant === r.variant.id) : undefined;
      if (same === undefined) throw new Error(`Pine roster diverges from the page at ${id}`);
      return { id, spec: same.spec, seed: r.seed, scale: r.scale, variant: r.variant.id };
    }
    // the bake is the page's own roll: a divergent draw anywhere refuses the roster rather than simulating another world
    if (row.kind !== kind || row.variant !== r.variant.id || row.seed !== r.seed || row.scale !== r.scale) throw new Error(`Pine roster diverges from the page at ${id}`);
    return { id, spec: row.spec, seed: r.seed, scale: r.scale, variant: r.variant.id };
  };
  const seen: boolean[] = [];
  /** the host body of a recipe on the creature floor a metre over the spawn height or the ground, out of any herd */
  const materialize = (recipe: SimSpawn, kind: string, listed = true): PineHuntBody => {
    const { x, z } = recipe.at, at = creatureFloor(x, z, Math.max(ports.spawnY, heightAt(x, z)) + 1);
    recipe.at.y = at.y;
    const a: PineHuntBody = Object.assign(host.spawn(recipe), { ...HUNT_BODY });
    a.levelGround = at.structure;
    if (at.structure) a.groundHeight = (px, pz, py) => creatureFloor(px, pz, py).y;
    if (kind === PINE_KING_KIND) kingPose.attach(a);
    a.herd = -1;
    made.set(recipe.id, a);
    if (!listed) return a;
    if (list.length >= LIVE_MAX) throw new Error('Pine roster is full');
    list.push({ id: recipe.id, kind, actor: a, scripted: false }); seen.push(false);
    return a;
  };
  /** AnimalManager.spawnAnimal: the shared stream's rolls, the creature floor from a metre over the ground, the brain's memory. */
  const spawn = (kind: string, x: number, z: number, yaw: number, variant: string | string[] | undefined, listed = true): PineHuntBody => {
    const r = rolls(kind, variant), a = materialize({ id: r.id, spec: r.spec, seed: r.seed, scale: r.scale, at: { x, y: 0, z }, yaw }, kind, listed);
    hunt.adopt(a, x, z);
    return a;
  };
  const retire = (a: HuntBody): void => {
    const i = list.findIndex(b => b.actor === a); if (i !== -1) { list.splice(i, 1); seen.splice(i, 1); }
    hunt.forget(a); kingPose.retire(a.entityId); host.retire(a.entityId); made.delete(a.entityId);
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
  const speed = { init: false, x: 0, z: 0, v: 0 };
  let clock = 0;
  const decide = (a: HuntBody, dt: number): void => { if (dt > 0) hunt.think(a, dt, player, false, speed.v); };
  // AnimalManager.damaged: a death stops its timer; a blow that does not kill is the brain's hit reaction and wakes it now
  host.events.on('damage.dealt', ({ req, killed }) => {
    const i = list.findIndex(b => b.actor.combatActor() === req.target), body = list[i];
    if (body === undefined) return;
    if (killed) { hunt.died(body.actor); return; }
    hunt.hurt(body.actor);
    if (body.actor.alive) decide(body.actor, host.brainDt(body.id, true));
  }, host.scope);

  host.onStep(ROSTER_STEP, dt => {
    if (!speed.init) { speed.x = player.x; speed.z = player.z; speed.init = true; }
    const moved = Math.hypot(player.x - speed.x, player.z - speed.z);
    speed.x = player.x; speed.z = player.z;
    speed.v += (Math.min(moved / dt, 9) - speed.v) * (1 - 0.5 ** (dt * 10));
    hunt.beginTick(dt); clock += dt; hunt.resetRepaths();
    for (let i = 0; i < LIVE_MAX; i++) {
      const body = list[i]; if (body === undefined) break;
      const a = body.actor;
      let urgent = false;
      if (a.alive && a.aggressive && (a.state === 'charge' || a.state === 'stalk' || a.state === 'alert')) {
        const line = canReach(a, player, host.physics);
        urgent = seen[i] === true && !line; seen[i] = line;
      }
      decide(a, host.brainDt(body.id, urgent));
    }
    // a running charge on the body clock: its band's step (0 on a paused or off frame, both frames' time on the next)
    for (let i = 0; i < LIVE_MAX; i++) {
      const body = list[i], a = body?.actor;
      if (body === undefined) break;
      if (a?.alive !== true || a.stunned || a.state !== 'charge') continue;
      const step = host.bodyDt(body.id); if (step > 0) hunt.advanceCharge(a, step, player);
    }
  }, {
    snapshot: () => ({ version: 3, rng: { ...rng.snapshot() }, clock, speed: { ...speed }, next,
      bodies: list.map((b, i) => {
        const memory = hunt.memory(b.actor); if (memory === undefined) throw new Error(`Pine body ${b.id} has no memory`);
        return { id: b.id, kind: b.kind, seen: seen[i] === true, memory: saveMemory(memory) };
      }),
      herds: hunt.herds.map(h => [h.cx, h.cz] as [number, number]) }),
    restore: value => {
      const state = v.parse(Saved, value);
      if (state.bodies.length !== list.length || state.herds.length !== hunt.herds.length || state.bodies.some((b, i) => b.id !== list[i]?.id)) throw new Error('Incompatible Pine roster continuation');
      rng.restore(state.rng); Object.assign(speed, state.speed); next = state.next;
      // the brain's clock is a sum of the same steps: a fresh brain (clock 0) takes the saved sum exactly
      hunt.beginTick(state.clock - clock); clock = state.clock;
      state.bodies.forEach((b, i) => {
        const body = list[i], memory = body === undefined ? undefined : hunt.memory(body.actor);
        if (memory === undefined) throw new Error('Incompatible Pine roster continuation');
        seen[i] = b.seen; loadMemory(memory, b.memory);
      });
      state.herds.forEach(([cx, cz], i) => { const herd = hunt.herds[i]; if (herd !== undefined) { herd.cx = cx; herd.cz = cz; } });
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
      const contract = saved.adapters.find(adapter => adapter.id === `runtime.actor.${id}`)?.state;
      if (typeof contract !== 'string') throw new Error(`Missing saved Pine body ${id}`);
      const checked = v.parse(Recipe, JSON.parse(contract)), b = kept.get(id), kind = b?.kind ?? checked.spec.kind;
      if (checked.id !== id) throw new Error(`Incompatible saved Pine body ${id}`);
      const a = materialize({ id, spec: recipeOf(kind, checked.spec.variant), seed: checked.seed, scale: checked.scale, at: { ...checked.at }, yaw: checked.yaw }, kind, b !== undefined);
      if (b !== undefined) hunt.adopt(a, checked.at.x, checked.at.z); // its memory: the continuation overwrites it and the stream it drew from
    });
    if (keeper.bodies.some((b, i) => b.id !== list[i]?.id)) throw new Error('Incompatible Pine roster continuation');
  }
  /** a parked prewarm body made real where the page spawned it, out of the list (the King when he first comes): no draws */
  const adoptParked = (id: string, x: number, z: number, yaw: number): PineHuntBody => {
    const row = parked.find(p => p.id === id);
    if (row === undefined) throw new Error(`Pine has no parked body ${id}`);
    return materialize({ id, spec: row.spec, seed: row.seed, scale: row.scale, at: { x, y: 0, z }, yaw }, row.kind, false);
  };
  return { bodies: () => list, parked: () => parked, hunt, spawn: (kind, x, z, yaw, variant) => spawn(kind, x, z, yaw, variant),
    spawnLoose: (kind, x, z, yaw, variant) => spawn(kind, x, z, yaw, variant, false), retire, adoptParked,
    actor: id => made.get(id) ?? null };
}
