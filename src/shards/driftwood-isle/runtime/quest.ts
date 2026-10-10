import * as v from 'valibot';
import { Vector3 } from 'three';
import type { SimHost } from '@wildshard/engine/sim';
import { Bodies, Body, overlapBox } from '@wildshard/engine/physics/bodies';
import type { Collider } from '@dimforge/rapier3d-simd';
import { BARREL_BODY, BARREL_HALF, BarrelWatch, barrelAtPlate, type BarrelEnv } from '@wildshard/engine/world/interact/barrel';
import type { GroupName } from '@wildshard/engine/physics/groups';
import { autoFlag, type InteractDef, type InteractTable } from '@wildshard/engine/world/interact/types';
import { test } from '@wildshard/engine/world/interact/flags';
import type { QuestData } from '@wildshard/game/shardfile/quests';
import type { DeclaredQuests } from '@wildshard/game/quest/declared';
import { installQuestGraph } from '@wildshard/game/quest/questGraph';
import type { AchievementDef } from '@wildshard/game/achievements';
import { SEA_GLASS_FLAG, SHARD_FLAGS } from '../quest/interactables';
import { DRIFTWOOD_GRAPH, DRIFTWOOD_ACTIONS } from '../data/questGraph';
import { QUEST_DONE } from '../quest/questLine';
import baked from './spots.baked.json' with { type: 'json' };
import { DriftwoodPack } from './pack';
import { DriftwoodZipline } from './zipline';
import type { DriftwoodScriptFinale } from './scriptFinale';

/** The script command actor that carries Driftwood's [E] prompts (`{ kind: 'script', actorId: DRIFTWOOD_INTERACT, value }`). */
export const DRIFTWOOD_INTERACT = 'driftwood.interact';
/** The prompts a command's value names: Wendell's talk, the iron sword, the zipline, and `row + i` for the table's row `i`. */
export const DRIFTWOOD_ACT = { talk: 0, sword: 1, zipline: 2, row: 100 } as const;
/** The quest keeper's fixed-step id (the dropped key's point, the reward beat's clock, the flag feats' counts). */
export const QUEST_STEP = 'driftwood.quest';
/** The finale's last flag (runtime/finale.ts: the reward view's end). */
export const REWARD_FLAG = 'seen:reward';

/** The browser player's eye above the feet (engine Player EYE): prompts pick by eye distance (Interactables.pickInteractable). */
const EYE = 1.68;
/** Interactables.ts: the kit's prompt radius, its walk-in take radius (feet), the walk-in's height window and the plate slab. */
const PROMPT_R = 2.5, TOUCH_R = 1.1, TOUCH_DY = 2.2, PLATE_INSET = 0.1, PLATE_DEPTH = 0.1;
/** Wendell's talk radius from his head (quest/Spine.ts TALK_R). */
const TALK_R = 3.2;
/** The iron sword's prompt (weapons/IronSword.ts): 2.6 m from the eye once no drowned sailor guards it. */
const SWORD_R = 2.6;
const MAX_COMMANDS = 1024, MAX_ROWS = 64, MAX_BODIES = 64;
const TALKED_FLAG = 'talked:castaway';
const PLATE_SEES: readonly GroupName[] = ['PLAYER', 'ITEM'], anyOwner = (): boolean => true;

const finite = v.pipe(v.number(), v.finite()), xyz = { x: finite, y: finite, z: finite };
const Row = v.strictObject({ id: v.string(), kind: v.string(), ...xyz, yaw: finite, prompt: v.optional(v.strictObject(xyz)),
  collider: v.optional(v.strictObject({ x: finite, z: finite, hw: finite, hd: finite, rot: finite, yTop: finite, yBottom: finite })) });
const Prompt = v.strictObject({ label: v.string(), ...xyz, radius: finite });
const Spots = v.object({ version: v.literal(1), rows: v.array(Row), talk: Prompt, sword: Prompt, reward: v.strictObject({ ...xyz, yaw: finite, pitch: finite, phase: finite }),
  zipline: v.strictObject({ top: v.strictObject(xyz), bottom: v.strictObject(xyz), sag: finite, prompt: v.strictObject({ ...xyz, radius: finite }) }) });
/** The page's placements (src/shards/driftwood-isle/generators/bake-driftwood-spots.mjs), strictly. */
export type DriftwoodSpots = v.InferOutput<typeof Spots>;
/** Driftwood's baked interactable spots, parsed strictly. */
export function driftwoodSpots(): DriftwoodSpots { return v.parse(Spots, baked); }

/** One body of the island as the quest reads it: its kind and its live actor (the sailor's guard and his fall). */
export interface QuestBody { readonly kind: string; readonly actor: { readonly alive: boolean; readonly position: { readonly x: number; readonly z: number }; readonly combatActor: () => unknown } | null }
/** What the quest keeper is lent. */
export interface DriftwoodQuestPorts {
  readonly quests: QuestData;
  readonly table: InteractTable;
  readonly spots: DriftwoodSpots;
  /** the flag feats (quest/Feats.ts; the kill feats are runtime/kills.ts's) */
  readonly feats: readonly AchievementDef[];
  readonly commands: () => readonly { readonly actorId: string; readonly value: number }[];
  readonly fact: (name: string, entity: string) => void;
  readonly coins: (amount: number, entity: string) => void;
  readonly bodies: () => readonly QuestBody[];
  /** the floor a dropped key lies on (the adventure's floorAt: the ground, else the wreck's deck) */
  readonly floorAt: (x: number, z: number) => number;
  /** the iron sword taken: it goes into the hand (EquipmentService's pickup selects it) */
  readonly ironTaken: () => void;
  /** the still sea the barrel's watch reads (the island's lowered sea) */
  readonly waterLevel: number;
  /** the walk velocity the player asks for this tick (m/s; the page's Player.velocity, which BarrelWatch reads) */
  readonly walk: () => { readonly x: number; readonly z: number };
  /** a restoring install: the barrel's native body comes back with the saved world, never spawned again */
  readonly restoring: boolean;
  /** The admitted finale, stepped at this keeper's existing post-player/ride phase. */
  readonly finale: DriftwoodScriptFinale;
}

/** The fixed cuboid the page baked for a kit collider box (its centre and half extents), or throws: the world lacks it. */
function bakedBox(physics: SimHost['physics'], c: { x: number; z: number; hw: number; hd: number; yTop: number; yBottom: number }): Collider {
  const cy = (c.yTop + c.yBottom) / 2, hy = (c.yTop - c.yBottom) / 2, hits: Collider[] = [];
  const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-3;
  physics.world.forEachCollider(collider => {
    const t = collider.translation(), h = collider.halfExtents();
    if (h !== null && collider.parent() === null && near(t.x, c.x) && near(t.y, cy) && near(t.z, c.z) && near(h.x, c.hw) && near(h.y, hy) && near(h.z, c.hd)) hits.push(collider);
  });
  const found = hits[0];
  if (found === undefined) throw new Error('Driftwood\'s baked world has no collider for a kit box');
  return found;
}

/** A barrel's continuation as plain snapshot data. */
function barrelState(handle: number, watch: BarrelWatch): { handle: number; watch: { lost: number; wedge: number; from: { x: number; y: number; z: number } } } {
  const { lost, wedge, from } = watch.state();
  return { handle, watch: { lost, wedge, from: { x: from.x, y: from.y, z: from.z } } };
}

/** One table row with its flag spellings made once (the step reads them every tick). */
interface Rule {
  readonly d: InteractDef; readonly spot: DriftwoodSpots['rows'][number]; readonly auto: string | null;
  readonly sets: readonly string[]; readonly gives: readonly string[]; readonly lockKey: string | null;
  readonly loot: readonly ({ readonly kind: 'item'; readonly id: string; readonly n: number } | { readonly kind: 'flag'; readonly id: string })[];
  readonly taken: string; readonly open: string; readonly lit: string; readonly used: string; readonly lever: string; readonly plate: string;
}
const Watch = v.strictObject({ lost: finite, wedge: finite, from: v.strictObject(xyz) });
const Saved = v.strictObject({ key: v.nullable(v.strictObject(xyz)), finale: v.string(), iron: v.boolean(), counts: v.record(v.string(), v.pipe(finite, v.integer(), v.minValue(0))),
  pack: v.unknown(), zipline: v.unknown(),
  barrel: v.nullable(v.strictObject({ handle: v.pipe(finite, v.integer(), v.minValue(0)), watch: Watch })) });
/** the barrel body's collider owner (a plain value, so the snapshot's collider tags carry it) */
const BARREL_OWNER = { kind: 'barrel', id: 'tide-barrel' } as const;

/**
 * "The Sealed Ring" in the renderer-free host (SF72): the declared quest rows through the game's declared quest path
 * (`DeclaredQuests` on `host.flags`, its `driftwood.quest` fact through the platform's fact port), and the island's
 * interactables table (quest/interactables.ts) with the engine kit's own rules (world/interact/Interactables.ts: shown /
 * locked / prompt radius / interact, the walk-in sea glass, the plates' slab overlap against the player and items, the
 * sluice's latch), each at the point the page placed it (baked), driven by `script` commands at the kit's prompt radii from
 * the player's eye. Wendell's talk sets `talked:castaway` (his first dialogue's end); the drowned sailor's death drops the
 * hold key where he fell (quest/Spine.ts `kit.moveTo`); the iron sword is taken once no drowned sailor stands
 * (quest/guards.ts) and goes into the hand; the reward beat starts within 7 m of the finale's spot once the captain is dead
 * and sets `seen:reward` 7 s later. The flag feats (quest/Feats.ts) emit their stable ledger facts from the flags.
 * Chest contents enter the actual authored pack through the page's inventory law, in table order, after the row's
 * automatic and explicit flags. The pack is part of the quest continuation; opening an already open chest adds nothing.
 * Not modelled: the prompts' line of sight; the nearest-prompt pick (a command names its row);
 * the reward view's carry of the player; travel to the zipline launch; the shown strongbox's collider (the
 * baked world keeps the load-time set). The puzzle barrel is the kit's own body (world/interact/barrel.ts BARREL_BODY) at
 * its baked home in the host's world, which the player's capsule pushes on the page's law (PLAYER_BODY), with the kit's
 * never-jam rule (BarrelWatch, each tick on the walk the player asks for); the open sluice drops its baked collider (on the
 * page it parks the tick its gate starts to lift, here in the tick it opens).
 */
export function installDriftwoodQuest(host: SimHost, ports: DriftwoodQuestPorts): { quests: DeclaredQuests; pack: DriftwoodPack; act: (value: number) => void } {
  const { table, spots } = ports, flags = host.flags;
  if (table.rows.length > MAX_ROWS || spots.rows.length !== table.rows.length) throw new Error('Driftwood spots do not match the interactables table');
  const rules = table.rows.map((d, i): Rule => {
    const spot = spots.rows[i];
    if (spot?.id !== d.id || spot.kind !== d.kind) throw new Error(`Driftwood spot ${String(i)} does not match row ${d.id}`);
    if (d.kind === 'chest' && d.contents.length > MAX_ROWS) throw new RangeError('Driftwood chest contents exceed their finite bound');
    const loot: Rule['loot'] = d.kind === 'chest' ? d.contents.map(l => 'item' in l ? { kind: 'item', id: l.item, n: l.n ?? 1 }
      : { kind: 'flag', id: 'key' in l ? `key:${l.key}` : l.flag }) : [];
    const gives = d.kind === 'key' ? [`key:${d.key}`] : [];
    return { d, spot, auto: autoFlag(d), sets: d.sets ?? [], gives, loot, taken: `taken:${d.id}`, open: `open:${d.id}`, lit: `lit:${d.id}`, used: `used:${d.id}`,
      lever: `lever:${d.id}`, plate: `plate:${d.id}`, lockKey: (d.kind === 'chest' || d.kind === 'door') && d.lock !== undefined ? `key:${d.lock}` : null };
  });
  const graph = installQuestGraph(host, { quests: ports.quests, interactions: DRIFTWOOD_ACTIONS, npcs: [], graph: DRIFTWOOD_GRAPH },
    { spots: { interact: [], crack: [] }, commands: ports.commands, fact: ports.fact, coins: ports.coins, drive: 'external' });
  const quests = graph.quests;
  const pack = new DriftwoodPack();
  // The page's carried branch leaves the motor alone and clears impulse/velocity before the ride's post-player update.
  // This one player owner will also host the reward carry; an inactive ride retains the ordinary host motion law.
  const rider = { position: host.player.position, velocity: new Vector3() };
  let carried = false;
  const zipline = new DriftwoodZipline({ top: new Vector3(spots.zipline.top.x, spots.zipline.top.y, spots.zipline.top.z),
    bottom: new Vector3(spots.zipline.bottom.x, spots.zipline.bottom.y, spots.zipline.bottom.z), sag: spots.zipline.sag }, on => {
    carried = on;
    if (!on) flags.set('used:zipline');
  });
  host.usePlayerDriver({ input: command => {
    if (!carried) return false;
    if (command !== undefined) host.player.yaw = command.yaw;
    host.playerImpulse.set(0, 0, 0); rider.velocity.set(0, 0, 0); host.playerFall.grounded = false;
    return true;
  }, step: () => undefined });
  const eye = new Vector3(), at = new Vector3(), keyPrompt = { x: 0, y: 0, z: 0 }, slab = { x: 0, y: 0, z: 0 }, half = { x: 0, y: PLATE_DEPTH, z: 0 };
  const state: { key: { x: number; y: number; z: number } | null; iron: boolean } = { key: null, iron: false };
  const feats = ports.feats.filter(f => f.kind === undefined).map(f => ({ id: f.id, count: f.count, name: `driftwood.${f.id}`,
    entities: Array.from({ length: f.count }, (_, k) => `${f.id}:${String(k + 1)}`), n: 0 }));
  if (feats.length > MAX_ROWS || feats.some(f => f.count > MAX_ROWS)) throw new RangeError('Driftwood feats exceed their finite bound');
  const near = (p: { x: number; y: number; z: number }, radius: number): boolean => {
    eye.copy(host.player.position); eye.y += EYE;
    return at.set(p.x, p.y, p.z).distanceTo(eye) < radius;
  };
  const raiseAll = (list: readonly string[], on: boolean): void => { for (let k = 0; k < MAX_ROWS; k++) { const f = list[k]; if (f === undefined) break; flags.set(f, on); } };
  const shown = (r: Rule): boolean => !((r.d.kind === 'key' || r.d.kind === 'pickup') && flags.has(r.taken)) && test(flags, r.d.showWhen);
  const locked = (r: Rule): boolean => !test(flags, r.d.requires) || (r.lockKey !== null && !flags.has(r.lockKey) && !flags.has(r.open));
  /** Interactables.promptRadius / baseRadius */
  const radius = (r: Rule): number => {
    const d = r.d;
    if (!shown(r)) return 0;
    const base = d.kind === 'chest' ? (flags.has(r.open) ? 0 : PROMPT_R)
      : d.kind === 'door' ? (d.opensWhen !== undefined && d.lock === undefined && d.requires === undefined ? 0 : PROMPT_R)
        : d.kind === 'beacon' ? (flags.has(r.lit) ? 0 : PROMPT_R + 0.4)
          : d.kind === 'altar' ? (flags.has(r.used) ? 0 : PROMPT_R + 0.3)
            : d.kind === 'bench' ? PROMPT_R + 0.5
              : d.kind === 'lever' ? (d.latch === true && flags.has(r.lever) ? 0 : PROMPT_R)
                : d.kind === 'plate' || d.kind === 'barrel' ? 0 : PROMPT_R;
    return d.reach === undefined ? base : base > 0 ? d.reach : 0;
  };
  /** Interactables.interact (a locked row only toasts) */
  const interact = (r: Rule): void => {
    const d = r.d;
    if (!shown(r) || locked(r) || d.kind === 'plate' || d.kind === 'barrel') return;
    // Physical doors retain their toggle law; other prompts commit the admitted graph row.
    if (d.kind === 'door') {
      if (d.look === 'plank' && flags.has(r.open)) { flags.clear(r.open); return; }
      if (r.auto !== null) flags.set(r.auto);
      raiseAll(r.sets, true);
    } else if (!graph.run(d.id).ok) return;
    if (d.kind === 'chest') {
      for (let k = 0; k < MAX_ROWS; k++) {
        const loot = r.loot[k]; if (loot === undefined) break;
        if (loot.kind === 'item') pack.add(loot.id, loot.n);
        else flags.set(loot.id);
      }
    }
  };
  /** the row's prompt point: the hold key's follows where the sailor fell (Interactables.moveTo, 1 m over the key) */
  const promptOf = (r: Rule): { x: number; y: number; z: number } | undefined => {
    if (r.d.kind !== 'key' || state.key === null) return r.spot.prompt;
    keyPrompt.x = state.key.x; keyPrompt.y = state.key.y + 1.0; keyPrompt.z = state.key.z;
    return keyPrompt;
  };
  const guarded = (): boolean => {
    const list = ports.bodies();
    for (let i = 0; i < MAX_BODIES; i++) { const b = list[i]; if (b === undefined) break; if (b.kind === 'sailor' && b.actor?.alive === true) return true; }
    return false;
  };
  const act = (value: number): void => {
    if (value === DRIFTWOOD_ACT.talk) { if (near(spots.talk, TALK_R)) graph.run('castaway.talk'); return; }
    if (value === DRIFTWOOD_ACT.sword) {
      // while guarded the prompt shrinks to the rack (1.4 m) and E only says why (weapons/IronSword.ts)
      if (!state.iron && !guarded() && near(spots.sword, SWORD_R)) { state.iron = true; ports.ironTaken(); }
      return;
    }
    if (value === DRIFTWOOD_ACT.zipline) {
      if (!zipline.isRiding && near(spots.zipline.prompt, spots.zipline.prompt.radius)) zipline.start();
      return;
    }
    const r = rules[value - DRIFTWOOD_ACT.row], p = r === undefined ? undefined : promptOf(r);
    if (r !== undefined && p !== undefined && near(p, radius(r))) interact(r);
  };

  // the sailor's fall drops the hold key on the floor there (quest/Spine.ts's kill hook, order 10)
  host.events.on('actor.died', ({ actor }) => {
    const body = ports.bodies().find(b => b.actor?.combatActor() === actor);
    if (body?.kind !== 'sailor' || body.actor === null) return;
    const { x, z } = body.actor.position;
    state.key = { x, y: ports.floorAt(x, z), z };
  }, host.scope);

  /** quest/Feats.ts's counts from the flags */
  const total = (id: string): number => id === 'castaway' ? Number(flags.has(TALKED_FLAG)) : id === 'shards' ? SHARD_FLAGS.filter(f => flags.has(f)).length
    : id === 'glass' ? flags.count(SEA_GLASS_FLAG) : id === 'treasure' ? Number(flags.has('open:reef-treasure')) : id === 'vista' ? Number(flags.has('used:vista-bench'))
      : id === 'zipline' ? Number(flags.has('used:zipline')) : id === 'quest' ? Number(flags.has(QUEST_DONE)) : 0;
  /** each new count emits its stable ledger fact (quest/facts.ts `bindDriftwoodFacts.count`), capped at the feat's count */
  const syncFeats = (): void => {
    for (let i = 0; i < MAX_ROWS; i++) {
      const feat = feats[i]; if (feat === undefined) break;
      const value = Math.min(feat.count, Math.max(feat.n, total(feat.id)));
      for (let k = 0; k < MAX_ROWS; k++) { const n = feat.n + 1; if (n > value) break; feat.n = n; ports.fact(feat.name, feat.entities[n - 1] ?? feat.id); }
    }
  };
  const offFlags = flags.onChange((f, on) => { if (on && !f.startsWith('plate:') && !f.startsWith('lever:')) syncFeats(); });
  host.scope.onDispose(offFlags);

  /** Interactables.plateDown: a thin slab over the plate, a little inside its rim, against the player and items */
  const plateDown = (r: Rule, size: number): boolean => {
    const h = Math.max(0.05, size / 2 - PLATE_INSET);
    slab.x = r.spot.x; slab.y = r.spot.y + PLATE_DEPTH / 2; slab.z = r.spot.z; half.x = h; half.z = h;
    return overlapBox(host.physics, slab, half, r.spot.yaw, PLATE_SEES, anyOwner);
  };
  /** Interactables.update / refresh for one row: a plate's press, a walk-in take, a latching door */
  const stepRow = (r: Rule): void => {
    const d = r.d, feet = host.player.position;
    if (!shown(r)) return;
    if (d.kind === 'plate') {
      const down = plateDown(r, d.size);
      if (down !== flags.has(r.plate)) { flags.set(r.plate, down); raiseAll(r.sets, down); }
    } else if (d.kind === 'pickup' && d.touch === true) {
      const dx = feet.x - r.spot.x, dz = feet.z - r.spot.z;
      if (dx * dx + dz * dz < TOUCH_R * TOUCH_R && Math.abs(feet.y - r.spot.y) < TOUCH_DY) { graph.run(d.id); }
    } else if (d.kind === 'door' && d.latch === true && d.opensWhen !== undefined && !flags.has(r.open) && test(flags, d.opensWhen)) flags.set(r.open);
  };
  // the puzzle barrel (Interactables.placeLive's 'barrel'): the kit's body at its home, upright on the row's yaw, in its
  // own body service over the host's world (pre / post around the host's world step, as the page's fixed phases)
  const barrelRule = rules.find(r => r.d.kind === 'barrel'), plates = rules.filter(r => r.d.kind === 'plate');
  const leash = barrelRule?.d.kind === 'barrel' ? barrelRule.d.leash : 0;
  const home = barrelRule === undefined ? null : { x: barrelRule.spot.x, y: barrelRule.spot.y, z: barrelRule.spot.z };
  const upright = { x: 0, y: Math.sin((barrelRule?.spot.yaw ?? 0) / 2), z: 0, w: Math.cos((barrelRule?.spot.yaw ?? 0) / 2) };
  const walked = { x: 0, y: 0, z: 0 }, player = { position: host.player.position, velocity: walked };
  let service = new Bodies(host.physics, host.player.position), barrel: Body | null = null, watch: BarrelWatch | null = null, adopt: number | null = null;
  const env: BarrelEnv = {
    player, floorAt: ports.floorAt, water: () => ports.waterLevel,
    onPlate: c => plates.some(p => p.d.kind === 'plate' && shown(p) && barrelAtPlate(c, p.spot, p.d.size)),
  };
  const lifted = { x: 0, y: 0, z: 0 };
  const lift = (p: { x: number; y: number; z: number }): { x: number; y: number; z: number } => { lifted.x = p.x; lifted.y = p.y + BARREL_HALF + 0.01; lifted.z = p.z; return lifted; };
  const spawnBarrel = (): void => {
    if (home === null) return;
    barrel = service.spawn({ ...BARREL_BODY, owner: BARREL_OWNER }, lift(home), undefined, upright);
    watch = new BarrelWatch(home, leash);
  };
  /** the barrel back at its start, upright, at rest (Interactables.sendHome) */
  const sendHome = (b: Body): void => { if (home !== null) b.teleport(lift(home), upright); watch?.clear(); };
  // the sluice's baked collider (the gate as the page loaded it, shut): it leaves the world once the gate opens
  const sluiceRule = rules.find(r => r.d.kind === 'door' && r.d.latch === true && r.d.opensWhen !== undefined && r.spot.collider !== undefined);
  let sluice: Collider | null = null;
  const findSluice = (): void => { sluice = sluiceRule?.spot.collider === undefined ? null : bakedBox(host.physics, sluiceRule.spot.collider); };
  host.onStep(QUEST_STEP, dt => {
    const list = ports.commands();
    for (let c = 0; c < MAX_COMMANDS; c++) {
      const command = list[c]; if (command === undefined) break;
      if (command.actorId === DRIFTWOOD_INTERACT) act(command.value);
    }
    // the barrel first (Interactables.update: its pose from the body, then the never-jam rule; plates feel the body itself)
    const b = barrel;
    if (b !== null) {
      service.post(dt);
      const asked = ports.walk(); walked.x = carried ? 0 : asked.x; walked.z = carried ? 0 : asked.z;
      if (watch?.check(b.curr, dt, env) === true) sendHome(b);
      service.pre(dt);
    }
    for (let i = 0; i < MAX_ROWS; i++) { const r = rules[i]; if (r === undefined) break; stepRow(r); }
    // the open gate's collider leaves the world (Interactables.syncDoor parks it; the sluice latches open)
    if (sluiceRule !== undefined && flags.has(sluiceRule.open) && sluice?.isEnabled() === true) sluice.setEnabled(false);
    // Adventure's zipline update is after the player/kit and before the finale's reward beat.
    zipline.update(dt, rider);
    // Only the admitted script owns finale timing; the native quest/body clock keeps its original phase.
    ports.finale.update(dt);
  }, {
    snapshot: () => ({ key: state.key, finale: ports.finale.snapshot(), iron: state.iron, pack: pack.snapshot(), zipline: zipline.snapshot(), counts: Object.fromEntries(feats.map(f => [f.id, f.n])),
      barrel: barrel === null || watch === null ? null : barrelState(barrel.rb.handle, watch) }),
    restore: value => {
      const saved = v.parse(Saved, value);
      zipline.restore(saved.zipline); carried = zipline.isRiding;
      pack.restore(saved.pack);
      ports.finale.restore(saved.finale); state.key = saved.key; state.iron = saved.iron;
      feats.forEach(f => { f.n = saved.counts[f.id] ?? 0; });
      if ((saved.barrel === null) !== (home === null)) throw new Error('Incompatible Driftwood barrel continuation');
      if (saved.barrel !== null && home !== null) { watch = new BarrelWatch(home, leash); watch.restore(saved.barrel.watch); adopt = saved.barrel.handle; }
    },
    // the restored world holds the barrel's native body: a body service over it adopts it by handle (its pose and last
    // velocity read back off the body, as a step leaves them); the sluice's collider is found again in the new world
    physicsRestored: () => {
      service = new Bodies(host.physics, host.player.position); findSluice();
      if (adopt === null) return;
      const world = host.physics.world;
      if (!world.bodies.contains(adopt)) throw new Error('Saved Driftwood barrel has no native body');
      const rb = world.getRigidBody(adopt), b = new Body(rb, rb.collider(0), { ...BARREL_BODY, owner: BARREL_OWNER }, 0);
      service.list.push(b); barrel = b; adopt = null;
    },
  });
  if (!ports.restoring) { spawnBarrel(); findSluice(); }
  return { quests, pack, act };
}
