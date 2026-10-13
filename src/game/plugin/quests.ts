/** Transitional quest bridge: retire when quest behavior is expressed by authored rows. */
import { MathUtils, type Vector3 } from "three";
import * as v from "valibot";
import * as npcs from '@wildshard/format/npcs';

import type { NpcDef } from "@wildshard/engine/quest/core";
import type { SimHost } from "@wildshard/engine/sim";
import { DeclaredQuests } from "../quest/declared";
import { bindHeadlessPrompts, type HeadlessPrompt, type PromptRegistration, eyeReaches, installInteractionRows, InteractionRules, parseInteractionRows, type InteractionRowsData, type InteractionSpot } from "../quest/interactionRows";
import { autoFlag, type InteractTable } from "@wildshard/engine/world/interact/types";
import type { QuestData } from "@wildshard/format/quests";

/** Mutable pose lent by a reward's player owner; this law creates no player, motor, camera or view. */
export interface QuestRewardPosePlayer { position: Vector3; velocity: Vector3; yaw: number; pitch: number }
/** The pose and clock phase captured once when the reward starts. Its owner persists these values with elapsed time. */
export interface QuestRewardOrigin { position: Vector3; yaw: number; pitch: number; phase: number }
/** An authored destination; absent components retain the captured pose or the running clock. */
export interface QuestRewardPoseTarget { at?: Vector3; yaw?: number; pitch?: number; phase?: number }

/** The shipping reward pose: 2.5 s camera ease, shortest yaw and 3.5 s forward clock ease, without presentation. */
export function applyQuestRewardPose(elapsed: number, from: Readonly<QuestRewardOrigin>, target: Readonly<QuestRewardPoseTarget>,
  player: QuestRewardPosePlayer, dayNight: { phase: number } | null | undefined): void {
  const k = MathUtils.smoothstep(elapsed, 0, 2.5);
  if (target.at !== undefined) player.position.lerpVectors(from.position, target.at, k);
  player.velocity.set(0, 0, 0);
  const turn = (target.yaw ?? from.yaw) - from.yaw;
  player.yaw = from.yaw + Math.atan2(Math.sin(turn), Math.cos(turn)) * k;
  player.pitch = from.pitch + ((target.pitch ?? from.pitch) - from.pitch) * k;
  if (dayNight && target.phase !== undefined) {
    const ahead = ((target.phase - from.phase) % 1 + 1) % 1;
    dayNight.phase = (from.phase + ahead * MathUtils.smoothstep(elapsed, 0, 3.5)) % 1;
  }
}

/** The defining format dialogue schema, shared by the page and native owners by identity. */
export const NpcDialogueRowSchema = npcs.NpcDialogueRowSchema;
/** Ordered authored dialogue independent of the runtime figure. */
export type NpcDialogueRow = npcs.NpcDialogueRow;
/** Validate the dialogue without inventing pivot-figure fields for a skinned NPC. */
export function parseNpcDialogueRow(input: unknown): NpcDialogueRow { return v.parse(NpcDialogueRowSchema, input); }
/** The defining format motion schema; runtime easing and pose laws stay unchanged. */
export const NpcMotionSchema = npcs.NpcMotionSchema;
/** A validated pivot NPC motion row. */
export type NpcMotion = npcs.NpcMotion;
/** The defining format NPC schema, preserving identity for every existing runtime consumer. */
export const NpcRowSchema = npcs.NpcRowSchema;
/** A validated quest-giver NPC row. */
export type NpcRow = npcs.NpcRow;
/** Compile an authored NPC row; an unknown field or an empty dialogue refuses. */
export function parseNpcRow(input: unknown): NpcRow { return v.parse(NpcRowSchema, input); }

/** The engine's NpcDef for the row's talk: its dialogue entries in order (the first whose condition holds is said). */
export function npcDef(row: NpcRow): NpcDef {
  return { id: row.id, name: row.name, dialogue: row.dialogue.map(entry => ({
    ...(entry.when === undefined ? {} : { when: { ...entry.when } }), lines: [...entry.lines], ...(entry.sets === undefined ? {} : { sets: [...entry.sets] }) })) };
}
/** The row's talk spot over the ground: its head's height and its prompt's reach (the interaction rows' spot). */
export function npcSpot(row: NpcRow, groundAt: (x: number, z: number) => number): { x: number; y: number; z: number; radius: number } {
  return { x: row.at.x, y: groundAt(row.at.x, row.at.z) + row.talkHeight, z: row.at.z, radius: row.talkRadius };
}

const questGraphName = v.pipe(v.string(), v.minLength(1), v.maxLength(96));
/**
 * A quest graph's runtime row (SHARD-PLATFORM SF27): the `script` command actor that carries its interaction rows, the
 * fixed-step id of their marks' continuation, and its `actions`, the beats a row's run starts beyond its flags (today
 * `summon`: the named boss encounter is armed, as a signal fire calls a boss up). Lighting a brazier and cracking a lever
 * are the interaction rows' own crack rows (`crack: 'light' | 'heavy'`).
 */
export const QuestGraphSchema = v.strictObject({
  actor: questGraphName, step: questGraphName,
  actions: v.pipe(v.array(v.strictObject({ row: questGraphName, summon: questGraphName })), v.maxLength(64)),
});
/** A validated quest graph runtime row (`QuestGraphSchema`). */
export type QuestGraphRow = v.InferOutput<typeof QuestGraphSchema>;
/** Compile an authored quest graph runtime row; an unknown field refuses. */
export function parseQuestGraph(input: unknown): QuestGraphRow { return v.parse(QuestGraphSchema, input); }

/** One baked spot: where the built world placed a prompt or a crack target (a crack target answers as `crack.<id>`). */
export interface QuestGraphSpot extends InteractionSpot { readonly id: string }
/** The rows a quest graph runs: the admitted quests, the interaction rows, the quest-givers and the runtime row. */
export interface QuestGraphRows {
  readonly quests: QuestData;
  readonly interactions: InteractionRowsData;
  readonly npcs: readonly NpcRow[];
  readonly graph: QuestGraphRow;
}
/** What a quest graph is lent: the baked spots, the cracking item, the tick's commands and the platform's effect ports. */
export interface QuestGraphPorts {
  readonly spots: { readonly interact: readonly QuestGraphSpot[]; readonly crack: readonly QuestGraphSpot[] };
  /** the item that cracks: its light / heavy reach and the act its lash reached this tick */
  readonly crack?: { readonly reach: { readonly light: number; readonly heavy: number }; readonly cracked: () => number | null };
  readonly commands: () => readonly { readonly actorId: string; readonly value: number }[];
  /** Optional actual page roster; commands can answer only its selected visible nearest prompt. */
  readonly promptRegistrations?: readonly PromptRegistration[];
  /** An existing modal/ride owner delivers actions itself. With no marks, no extra step or snapshot is installed. */
  readonly drive?: 'commands' | 'external';
  readonly fact: (name: string, entity: string) => void;
  readonly coins: (amount: number, entity: string) => void;
  /** a `summon` action ran: arm the named boss encounter */
  readonly summon?: (boss: string) => void;
}

/**
 * Runs a shard's declared quest graph in the renderer-free host (SF27): the quest rows through the game's declared quest
 * path (`DeclaredQuests` on `host.flags`, its facts and coins through the effect ports) and the interaction rows through
 * the platform's interaction step, at the baked spots and each quest-giver's talk spot over the ground; a row's run starts
 * its declared actions. A `summon` action with no summon port refuses at install.
 */
export function installQuestGraph(host: SimHost, rows: QuestGraphRows, ports: QuestGraphPorts): { quests: DeclaredQuests; rules: InteractionRules; run: (id: string, changed?: () => void) => ReturnType<InteractionRules['run']>;
  /** Whether the player's eye stands within the named spot's prompt radius (an externally driven graph's prompts). */
  near: (spot: string) => boolean } {
  const actions = new Map(rows.graph.actions.map(action => [action.row, action] as const)), summon = ports.summon;
  if (actions.size > 0 && summon === undefined) throw new Error('A quest graph summons a boss but has no summon port');
  if (ports.drive === 'external' && rows.interactions.marks.length > 0) throw new Error('Externally driven quest marks need an explicit continuation owner');
  const quests = new DeclaredQuests(host, rows.quests, { fact: ports.fact, coins: ports.coins });
  const rules = new InteractionRules(host.flags, rows.interactions);
  const groundAt = (x: number, z: number): number => host.groundHeightAt(x, z);
  const spots = Object.fromEntries([...rows.npcs.map(npc => [npc.spot, npcSpot(npc, groundAt)] as const),
    ...ports.spots.interact.map(s => [s.id, s] as const), ...ports.spots.crack.map(s => [`crack.${s.id}`, s] as const)]);
  const done = (row: string): void => { const action = actions.get(row); if (action !== undefined) summon?.(action.summon); };
  const prompts = ports.promptRegistrations === undefined ? undefined : bindHeadlessPrompts(ports.promptRegistrations, id => {
    const entry = rows.interactions.rows.find(row => row.at === id && row.crack === undefined), spot = spots[id];
    if (entry === undefined || spot === undefined) return undefined;
    const prompt: HeadlessPrompt = { act: entry.act, position: spot, radius: spot.radius };
    return prompt;
  });
  if (ports.drive !== 'external') installInteractionRows(host, rules, { actorId: rows.graph.actor, stepId: rows.graph.step, spots, commands: ports.commands,
    ...(prompts === undefined ? {} : { prompts }),
    ...(ports.crack === undefined ? {} : { crack: ports.crack }),
    done });
  return { quests, rules, run: (id, changed) => { const result = rules.run(id, changed); if (result.ok) done(id); return result; },
    near: (id) => { const spot = spots[id]; if (spot === undefined) throw new Error(`Undeclared quest spot ${id}`); return eyeReaches(host, spot); } };
}

/** Compile the flag effects of latched levers, pickups and benches from the engine's authored table. Geometry, inventory,
 * sitting, prompt ordering and LOS remain with their existing owners; unsupported kinds refuse instead of losing effects. */
export function compileQuestTable(table: InteractTable, bindings: readonly { readonly id: string; readonly act: number }[]): InteractionRowsData {
  return parseInteractionRows({ marks: [], rows: bindings.map(binding => {
    const matches = table.rows.filter(row => row.id === binding.id), row = matches[0];
    if (matches.length !== 1 || row === undefined || !(row.kind === 'pickup' || row.kind === 'bench' || row.kind === 'lever' && row.latch === true)) {
      throw new Error(`Unsupported quest table action ${binding.id}`);
    }
    const flag = autoFlag(row);
    if (flag === null) throw new Error(`Missing quest table flag ${binding.id}`);
    const needs = [...(row.showWhen === undefined ? [] : [row.showWhen]), ...(row.requires === undefined ? [] : [row.requires]),
      ...(row.kind === 'bench' ? [] : [{ none: [flag] }])];
    return { id: row.id, act: binding.act, at: row.id, needs, sets: [flag, ...(row.kind === 'lever' ? [] : row.sets ?? [])] };
  }) });
}
