import * as v from "valibot";
import type { NpcDef } from "@wildshard/engine/quest/core";
import type { SimHost } from "@wildshard/engine/sim";
import { DeclaredQuests } from "../quest/declared";
import { installInteractionRows, InteractionRules, parseInteractionRows, type InteractionRowsData, type InteractionSpot } from "../quest/interactionRows";
import { autoFlag, type InteractTable } from "@wildshard/engine/world/interact/types";
import type { QuestData } from "@wildshard/format/quests";
import { bindHeadlessPrompts, type HeadlessPrompt, type PromptRegistration } from "./prompts";

const npcRowName = v.pipe(v.string(), v.minLength(1), v.maxLength(96));
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(400));
const names = v.pipe(v.array(npcRowName), v.maxLength(64));
const npcRowFinite = v.pipe(v.number(), v.finite());
const positive = v.pipe(npcRowFinite, v.minValue(0));
const npcRowPoint = v.strictObject({ x: npcRowFinite, z: npcRowFinite });
const vec3 = v.tuple([npcRowFinite, npcRowFinite, npcRowFinite]);
const condition = v.strictObject({ all: v.exactOptional(names), any: v.exactOptional(names), none: v.exactOptional(names) });


/** Dialogue data independent of its rendered body. Skinned stand-in NPCs keep their own figure installer. */
export const NpcDialogueRowSchema = v.strictObject({ id: npcRowName, name: text,
  dialogue: v.pipe(v.array(v.strictObject({ when: v.exactOptional(condition), lines: v.pipe(v.array(text), v.minLength(1), v.maxLength(16)), sets: v.exactOptional(names) })), v.minLength(1), v.maxLength(16)),
});
/** Validated dialogue row; directly consumed by both the page and native NpcDialogue. */
export type NpcDialogueRow = v.InferOutput<typeof NpcDialogueRowSchema>;
/** Validate the dialogue without inventing pivot-figure fields for a skinned NPC. */
export function parseNpcDialogueRow(input: unknown): NpcDialogueRow { return v.parse(NpcDialogueRowSchema, input); }

/**
 * A quest-giver NPC as a declared row (SHARD-PLATFORM SF27, the pivot-NPC row): who it is, where it stands and what it
 * says, and how its figure moves. The figure is one generated model split onto pivots (not skinned): the head turns at
 * the neck, one arm swings at the shoulder; it faces `faceHome` until the player comes within `faceRange`, waves within
 * `waveRange` until its `metFlag` is raised, and gestures while it talks. Its talk prompt (`spot`, the interaction rows'
 * named spot) stands `talkHeight` over its feet and reaches `talkRadius` from the player's eye. Its first matching
 * dialogue entry is what it says (the engine's NpcDef order).
 */
export const NpcRowSchema = v.strictObject({
  id: npcRowName, name: text, spot: npcRowName, at: npcRowPoint, faceHome: npcRowPoint, metFlag: npcRowName,
  talkHeight: positive, talkRadius: positive, faceRange: positive, waveRange: positive,
  /** the solid column round it (`half` m square, from `below` under its feet to `above` over them) */
  collider: v.strictObject({ half: positive, below: positive, above: positive, surface: v.picklist(['flesh', 'wood', 'metal', 'felt', 'shell', 'earth']) }),
  /**
   * The figure: the model id, fitted to `height` m with its feet on y 0 facing +Z; the head is every triangle at or
   * over the neck; the arm, the triangles with x under `armBelowX` and y over `armAboveY` up to the neck; the material's
   * roughness and flat shading.
   */
  figure: v.strictObject({ model: npcRowName, height: positive, neck: vec3, shoulder: vec3, armBelowX: npcRowFinite, armAboveY: npcRowFinite,
    roughness: v.pipe(npcRowFinite, v.minValue(0), v.maxValue(1)), flat: v.boolean() }),
  dialogue: NpcDialogueRowSchema.entries.dialogue,
});
/** A validated quest-giver NPC row (`NpcRowSchema`). */
export type NpcRow = v.InferOutput<typeof NpcRowSchema>;
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
export function installQuestGraph(host: SimHost, rows: QuestGraphRows, ports: QuestGraphPorts): { quests: DeclaredQuests; rules: InteractionRules; run: (id: string, changed?: () => void) => ReturnType<InteractionRules['run']> } {
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
  return { quests, rules, run: (id, changed) => { const result = rules.run(id, changed); if (result.ok) done(id); return result; } };
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
