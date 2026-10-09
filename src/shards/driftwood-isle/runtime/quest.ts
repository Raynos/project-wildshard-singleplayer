import * as v from 'valibot';
import { Vector3 } from 'three';
import type { SimHost } from '@wildshard/engine/sim';
import { overlapBox } from '@wildshard/engine/physics/bodies';
import type { GroupName } from '@wildshard/engine/physics/groups';
import { autoFlag, type InteractDef, type InteractTable } from '@wildshard/engine/world/interact/types';
import { test } from '@wildshard/engine/world/interact/flags';
import type { QuestData } from '@wildshard/game/shardfile/quests';
import { DeclaredQuests } from '@wildshard/game/quest/declared';
import type { AchievementDef } from '@wildshard/game/achievements';
import { SEA_GLASS_FLAG, SHARD_FLAGS } from '../quest/interactables';
import { QUEST_DONE } from '../quest/questLine';
import baked from './spots.baked.json' with { type: 'json' };

/** The script command actor that carries Driftwood's [E] prompts (`{ kind: 'script', actorId: DRIFTWOOD_INTERACT, value }`). */
export const DRIFTWOOD_INTERACT = 'driftwood.interact';
/** The prompts a command's value names: Wendell's talk, the iron sword on the rack, and `row + i` for the table's row `i`. */
export const DRIFTWOOD_ACT = { talk: 0, sword: 1, row: 100 } as const;
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
/** The reward beat (runtime/finale.ts, game/quest/reward.ts): it starts within 7 m of the spot and ends 7 s later. */
const REWARD_R = 7, REWARD_HOLD = 7;
const MAX_COMMANDS = 1024, MAX_ROWS = 64, MAX_BODIES = 64;
const TALKED_FLAG = 'talked:castaway', CAPTAIN_DEAD = 'dead:captain';
const PLATE_SEES: readonly GroupName[] = ['PLAYER', 'ITEM'], anyOwner = (): boolean => true;

const finite = v.pipe(v.number(), v.finite()), xyz = { x: finite, y: finite, z: finite };
const Row = v.strictObject({ id: v.string(), kind: v.string(), ...xyz, yaw: finite, prompt: v.optional(v.strictObject(xyz)),
  collider: v.optional(v.strictObject({ x: finite, z: finite, hw: finite, hd: finite, rot: finite, yTop: finite, yBottom: finite })) });
const Prompt = v.strictObject({ label: v.string(), ...xyz, radius: finite });
const Spots = v.object({ version: v.literal(1), rows: v.array(Row), talk: Prompt, sword: Prompt, reward: v.strictObject(xyz) });
/** The page's placements (scripts/bake-driftwood-spots.mjs), strictly. */
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
}

/** One table row with its flag spellings made once (the step reads them every tick). */
interface Rule {
  readonly d: InteractDef; readonly spot: DriftwoodSpots['rows'][number]; readonly auto: string | null;
  readonly sets: readonly string[]; readonly gives: readonly string[]; readonly lockKey: string | null;
  readonly taken: string; readonly open: string; readonly lit: string; readonly used: string; readonly lever: string; readonly plate: string;
}
const Saved = v.strictObject({ key: v.nullable(v.strictObject(xyz)), reward: finite, iron: v.boolean(), counts: v.record(v.string(), v.pipe(finite, v.integer(), v.minValue(0))) });

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
 * Not modelled: the prompts' line of sight; the nearest-prompt pick (a command names its row); chest doubloons (pack items,
 * not purse coins); the reward view's carry of the player; the zipline (`used:zipline`); the puzzle barrel's body (the
 * host's player capsule is not blocked by ITEM bodies, so it could not push one); the shown strongbox's and the open
 * sluice's colliders (the baked world keeps the load-time set).
 */
export function installDriftwoodQuest(host: SimHost, ports: DriftwoodQuestPorts): { quests: DeclaredQuests; act: (value: number) => void } {
  const { table, spots } = ports, flags = host.flags;
  if (table.rows.length > MAX_ROWS || spots.rows.length !== table.rows.length) throw new Error('Driftwood spots do not match the interactables table');
  const rules = table.rows.map((d, i): Rule => {
    const spot = spots.rows[i];
    if (spot?.id !== d.id || spot.kind !== d.kind) throw new Error(`Driftwood spot ${String(i)} does not match row ${d.id}`);
    const gives = d.kind === 'chest' ? d.contents.flatMap(l => 'key' in l ? [`key:${l.key}`] : 'flag' in l ? [l.flag] : []) : d.kind === 'key' ? [`key:${d.key}`] : [];
    return { d, spot, auto: autoFlag(d), sets: d.sets ?? [], gives, taken: `taken:${d.id}`, open: `open:${d.id}`, lit: `lit:${d.id}`, used: `used:${d.id}`,
      lever: `lever:${d.id}`, plate: `plate:${d.id}`, lockKey: (d.kind === 'chest' || d.kind === 'door') && d.lock !== undefined ? `key:${d.lock}` : null };
  });
  const quests = new DeclaredQuests(host, ports.quests, { fact: ports.fact, coins: ports.coins });
  const eye = new Vector3(), at = new Vector3(), keyPrompt = { x: 0, y: 0, z: 0 }, slab = { x: 0, y: 0, z: 0 }, half = { x: 0, y: PLATE_DEPTH, z: 0 };
  const state: { key: { x: number; y: number; z: number } | null; reward: number; iron: boolean } = { key: null, reward: -1, iron: false };
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
    if (d.kind === 'lever') {
      if (d.latch !== true || !flags.has(r.lever)) raiseAll(r.sets, flags.toggle(r.lever));
      return;
    }
    if (d.kind === 'door' && d.look === 'plank' && flags.has(r.open)) { flags.clear(r.open); return; }
    raiseAll(r.gives, true);
    if (r.auto !== null) flags.set(r.auto);
    raiseAll(r.sets, true);
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
    if (value === DRIFTWOOD_ACT.talk) { if (near(spots.talk, TALK_R) && !flags.has(TALKED_FLAG)) flags.set(TALKED_FLAG); return; }
    if (value === DRIFTWOOD_ACT.sword) {
      // while guarded the prompt shrinks to the rack (1.4 m) and E only says why (weapons/IronSword.ts)
      if (!state.iron && !guarded() && near(spots.sword, SWORD_R)) { state.iron = true; ports.ironTaken(); }
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
      if (dx * dx + dz * dz < TOUCH_R * TOUCH_R && Math.abs(feet.y - r.spot.y) < TOUCH_DY) { flags.set(r.taken); raiseAll(r.sets, true); }
    } else if (d.kind === 'door' && d.latch === true && d.opensWhen !== undefined && !flags.has(r.open) && test(flags, d.opensWhen)) flags.set(r.open);
  };
  host.onStep(QUEST_STEP, dt => {
    const list = ports.commands();
    for (let c = 0; c < MAX_COMMANDS; c++) {
      const command = list[c]; if (command === undefined) break;
      if (command.actorId === DRIFTWOOD_INTERACT) act(command.value);
    }
    for (let i = 0; i < MAX_ROWS; i++) { const r = rules[i]; if (r === undefined) break; stepRow(r); }
    // the reward beat: the view eases in, and its end completes the quest
    const feet = host.player.position;
    if (state.reward === -1 && flags.has(CAPTAIN_DEAD) && !flags.has(REWARD_FLAG) && Math.hypot(feet.x - spots.reward.x, feet.z - spots.reward.z) < REWARD_R) state.reward = 0;
    if (state.reward >= 0) { state.reward += dt; if (state.reward > REWARD_HOLD) { state.reward = -2; flags.set(REWARD_FLAG); } }
  }, {
    snapshot: () => ({ key: state.key, reward: state.reward, iron: state.iron, counts: Object.fromEntries(feats.map(f => [f.id, f.n])) }),
    restore: value => {
      const saved = v.parse(Saved, value);
      state.key = saved.key; state.reward = saved.reward; state.iron = saved.iron;
      feats.forEach(f => { f.n = saved.counts[f.id] ?? 0; });
    },
  });
  return { quests, act };
}
