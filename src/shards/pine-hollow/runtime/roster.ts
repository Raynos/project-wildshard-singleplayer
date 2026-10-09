import * as v from 'valibot';
import { Vector3 } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { HuntBrain, spawnRolls, type HuntBody, type HuntMemory, type HuntNav } from '@wildshard/engine/ai/hunt';
import { canReach } from '@wildshard/engine/ai/reach';
import { castRay } from '@wildshard/engine/physics/query';
import type { BakedGrid } from '@wildshard/engine/world/BakedTerrain';
import type { SimHost } from '@wildshard/engine/sim';
import { isEliteVariant, PINE_ELITE_ANIMALS, PINE_ELITE_DEFS, swapRolledElites } from '../combat/eliteRoster';
import { pineEliteStreams } from '../combat/eliteStreams';
import { SPAWN } from '../layout';
import { PINE_FAUNA } from './fauna';
import { PINE_HERD_STREAM, PINE_KING_KIND, pineHuntGround, pineSpawnSpecies } from './herds';
import type { PineBake } from './baked';

/** The roster keeper's fixed-step id. */
export const ROSTER_STEP = 'pine.roster';
/** The manager's list at load (160 herd bodies and the 4 lair elites): every keeper loop is bounded by it. */
const BODY_COUNT = 164;
/** The scheduler's 'ai' rate (app/scheduler.ts AI; Pine overrides no tier ticks): decisions at 20 Hz within 60 m of the player,
 *  10 Hz to 160 m, paused beyond (the time away discarded). A scripted elite is pinned: it thinks every frame ('always'). */
const NEAR = 60, FAR = 160, NEAR_HZ = 20, FAR_HZ = 10;
/** What a renderer-free body adds for the hunting brain: never hidden (no view), no ground tilt to sample. */
const HUNT_BODY = { hidden: false, sampleTerrain: (): void => undefined };
/** combat/ctx.ts SCRIPTED: the state a fight's own animal holds (the manager's loop leaves it alone). */
const SCRIPTED = 'sidestep';
/** The host's fixed step (s): a blow lands between steps, its wake takes one frame for a new subject's clock. */
const FRAME = 1 / 60;

/** One manager body: its id and kind, the live host actor, and whether a fight scripts it (an elite). */
export interface PineBody { readonly id: string; readonly kind: string; readonly actor: HuntBody; readonly scripted: boolean }
/** A parked prewarm body (runtime/antlerKing.ts `prewarm`): its id and rolled recipe, no host body until the King's script calls it. */
export interface PineParked { readonly id: string; readonly kind: string; readonly variant: string; readonly spec: AnimalSimSpec; readonly seed: number; readonly scale: number }
export interface PineRosterPorts {
  readonly bake: PineBake;
  /** the terrain grid the page installs before the herds (public/assets/baked/pine-hollow/terrain.bin) */
  readonly grid: BakedGrid;
  /** the shard's baked navmesh (public/assets/baked/pine-hollow/navmesh.bin), as the page's hunting brain asks it */
  readonly nav: HuntNav | null;
}

const finite = v.pipe(v.number(), v.finite());
const Stream = v.strictObject({ version: v.literal(1), state: finite, initial: finite, scrambledFork: v.boolean() });
const Memory = v.record(v.string(), v.union([finite, v.boolean(), v.array(v.tuple([finite, finite, finite]))]));
const Saved = v.strictObject({ version: v.literal(1), rng: Stream, clock: finite, speed: v.strictObject({ init: v.boolean(), x: finite, z: finite, v: finite }),
  bodies: v.array(v.strictObject({ id: v.string(), clock: v.tuple([v.nullable(finite), finite, finite]), seen: v.boolean(), memory: Memory })),
  herds: v.array(v.tuple([finite, finite])) });
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
 * Every tick, in the manager's list order: the herds' decisions on the scheduler's 'ai' clock (20 Hz within 60 m, 10 Hz to
 * 160 m, paused beyond) and a pinned elite's every frame (its state is the fight's: the brain's ambient calls and confine
 * still run, as the page's do), a 'lost.sight' wake when a stalking / charging / alert hunter loses its line to the player,
 * the hit reaction and its wake on a non-lethal blow, and a running charge on the body clock (`advanceCharge`), its contact
 * filed as the page's PlayerHurt.creature files it (`feel.blow`: the host knocks the player back). The player's noise is the
 * manager's smoothed ground speed (the headless player never sprints).
 *
 * Not yet owned (fail-closed, progress/shard-platform/handoffs/sf72-pine.md): the elites' fights (EliteGoals over a
 * renderer-free lane), the Antler King, the rain's wander goals, the bodies' 'half' / 'paused' update bands and the physics
 * body LOD (the host steps and collides every body every tick: an engine host seam).
 */
export function installPineRoster(host: SimHost, ports: PineRosterPorts): {
  bodies: () => readonly PineBody[]; parked: () => readonly PineParked[]; hunt: HuntBrain<HuntBody>;
} {
  const { bake, grid } = ports, rng = new Rng(PINE_HERD_STREAM), player = host.player.position;
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
  let next = 0;
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
    const id = `creature:${String(next++)}`, row = baked.get(id) ?? bakedParked.get(id);
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
  /** AnimalManager.spawnAnimal: the shared stream's rolls, the creature floor from a metre over the ground, the brain's memory. */
  const spawn = (kind: string, x: number, z: number, yaw: number, variant: string | string[] | undefined): HuntBody => {
    const r = rolls(kind, variant), at = creatureFloor(x, z, heightAt(x, z) + 1);
    const a: HuntBody = Object.assign(host.spawn({ id: r.id, spec: r.spec, seed: r.seed, scale: r.scale, at: { x, y: at.y, z }, yaw }), HUNT_BODY);
    a.levelGround = at.structure;
    if (at.structure) a.groundHeight = (px, pz, py) => creatureFloor(px, pz, py).y;
    a.herd = -1;
    list.push({ id: r.id, kind, actor: a, scripted: false });
    hunt.adopt(a, x, z);
    return a;
  };
  const retire = (a: HuntBody): void => {
    const i = list.findIndex(b => b.actor === a); if (i !== -1) list.splice(i, 1);
    hunt.forget(a); host.retire(a.entityId);
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

  const last = Array.from({ length: BODY_COUNT }, (): number | null => null), elapsed = new Float64Array(BODY_COUNT), credit = new Float64Array(BODY_COUNT), seen = Array.from({ length: BODY_COUNT }, () => false);
  const speed = { init: false, x: 0, z: 0, v: 0 };
  let clock = 0;
  /** TickScheduler.due (brain side) for body `i`: credit at its band's rate, elapsed time as its dt; an interrupt wakes it now. */
  const due = (i: number, a: HuntBody, scripted: boolean, urgent: boolean, dt: number): number => {
    const now = host.clock.now, d = Math.hypot(a.position.x - player.x, a.position.y - player.y, a.position.z - player.z);
    const hz = scripted || a.state === SCRIPTED ? Infinity : d < NEAR ? NEAR_HZ : d < FAR ? FAR_HZ : 0;
    const step = now - (last[i] ?? now - dt); // a new subject starts a frame ago
    last[i] = now;
    if (hz === 0) { elapsed[i] = 0; credit[i] = 0; } else { elapsed[i] = (elapsed[i] ?? 0) + step; credit[i] = (credit[i] ?? 0) + step; }
    if (!urgent && (hz === 0 || (credit[i] ?? 0) + 1e-9 < 1 / hz)) return 0;
    const brainDt = elapsed[i] ?? 0;
    elapsed[i] = 0;
    credit[i] = urgent || hz === Infinity ? 0 : Math.max(0, (credit[i] ?? 0) - Math.floor(((credit[i] ?? 0) + 1e-9) * hz) / hz);
    return brainDt;
  };
  const decide = (a: HuntBody, dt: number): void => { if (dt > 0) hunt.think(a, dt, player, false, speed.v); };
  // AnimalManager.damaged: a death stops its timer; a blow that does not kill is the brain's hit reaction and wakes it now
  host.events.on('damage.dealt', ({ req, killed }) => {
    const i = list.findIndex(b => b.actor.combatActor() === req.target), body = list[i];
    if (body === undefined) return;
    if (killed) { hunt.died(body.actor); return; }
    hunt.hurt(body.actor);
    if (body.actor.alive) decide(body.actor, due(i, body.actor, body.scripted, true, FRAME));
  }, host.scope);

  host.onStep(ROSTER_STEP, dt => {
    if (!speed.init) { speed.x = player.x; speed.z = player.z; speed.init = true; }
    const moved = Math.hypot(player.x - speed.x, player.z - speed.z);
    speed.x = player.x; speed.z = player.z;
    speed.v += (Math.min(moved / dt, 9) - speed.v) * (1 - 0.5 ** (dt * 10));
    hunt.beginTick(dt); clock += dt; hunt.resetRepaths();
    for (let i = 0; i < BODY_COUNT; i++) {
      const body = list[i]; if (body === undefined) continue;
      const a = body.actor;
      let urgent = false;
      if (a.alive && a.aggressive && (a.state === 'charge' || a.state === 'stalk' || a.state === 'alert')) {
        const line = canReach(a, player, host.physics);
        urgent = seen[i] === true && !line; seen[i] = line;
      }
      decide(a, due(i, a, body.scripted, urgent, dt));
    }
    for (let i = 0; i < BODY_COUNT; i++) { const a = list[i]?.actor; if (a?.alive === true && !a.stunned && a.state === 'charge') hunt.advanceCharge(a, dt, player); }
  }, {
    snapshot: () => ({ version: 1, rng: { ...rng.snapshot() }, clock, speed: { ...speed },
      bodies: list.map((b, i) => {
        const memory = hunt.memory(b.actor); if (memory === undefined) throw new Error(`Pine body ${b.id} has no memory`);
        return { id: b.id, clock: [last[i] ?? null, elapsed[i] ?? 0, credit[i] ?? 0] as [number | null, number, number], seen: seen[i] === true, memory: saveMemory(memory) };
      }),
      herds: hunt.herds.map(h => [h.cx, h.cz] as [number, number]) }),
    restore: value => {
      const state = v.parse(Saved, value);
      if (state.bodies.length !== BODY_COUNT || state.herds.length !== hunt.herds.length || state.bodies.some((b, i) => b.id !== list[i]?.id)) throw new Error('Incompatible Pine roster continuation');
      rng.restore(state.rng); Object.assign(speed, state.speed);
      // the brain's clock is a sum of the same steps: a fresh brain (clock 0) takes the saved sum exactly
      hunt.beginTick(state.clock - clock); clock = state.clock;
      state.bodies.forEach((b, i) => {
        const body = list[i], memory = body === undefined ? undefined : hunt.memory(body.actor);
        if (memory === undefined) throw new Error('Incompatible Pine roster continuation');
        [last[i], elapsed[i], credit[i]] = b.clock; seen[i] = b.seen; loadMemory(memory, b.memory);
      });
      state.herds.forEach(([cx, cz], i) => { const herd = hunt.herds[i]; if (herd !== undefined) { herd.cx = cx; herd.cz = cz; } });
    },
  });
  return { bodies: () => list, parked: () => parked, hunt };
}
