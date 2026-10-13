import { MathUtils, type Vector3 } from "three";
import * as v from "valibot";
import type { NpcDef } from "@wildshard/engine/quest/core";
import type { SimHost } from "@wildshard/engine/sim";
import { DeclaredQuests } from "../quest/declared";
import { eyeReaches, installInteractionRows, InteractionRules, parseInteractionRows, type InteractionRowsData, type InteractionSpot } from "../quest/interactionRows";
import { autoFlag, type InteractTable } from "@wildshard/engine/world/interact/types";
import type { QuestData } from "@wildshard/format/quests";
import { bindHeadlessPrompts, type HeadlessPrompt, type PromptRegistration } from "./prompts";

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

/** One pivot's turn (radians): `base` plus `swing`·sin(`hz`·t), only the sine's positive half when marked 'half'. */
const npcSwing = v.union([v.tuple([npcRowFinite, npcRowFinite, positive]), v.tuple([npcRowFinite, npcRowFinite, positive, v.literal('half')])]);
/** A pose: the arm's `lift` (the shoulder about z), `forward` (the shoulder about x) and the forearm's `bend` (the elbow about z). */
const npcPose = v.strictObject({ lift: npcSwing, forward: npcSwing, bend: npcSwing });
/**
 * How a pivot NPC moves: whether it `turns` to face the player (within its face range or while it talks; else back to
 * its home facing); whether it waves only until it is met; its arm's easing rate (per second); its breath (a yaw sway
 * and a vertical swell, [amplitude, hz]); and its arm's pose at rest, waving (the player within its wave range) and
 * talking.
 */
export const NpcMotionSchema = v.strictObject({ turns: v.boolean(), waveUntilMet: v.boolean(), ease: positive,
  breathe: v.strictObject({ yaw: v.tuple([npcRowFinite, positive]), scale: v.tuple([npcRowFinite, positive]) }),
  rest: npcPose, wave: npcPose, talk: npcPose });
/** A validated pivot NPC motion row. */
export type NpcMotion = v.InferOutput<typeof NpcMotionSchema>;

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
  /** the solid column round it (`half` m square, from `below` under its feet to `above` over them); none: it is not solid */
  collider: v.exactOptional(v.strictObject({ half: positive, below: positive, above: positive, surface: v.picklist(['flesh', 'wood', 'metal', 'felt', 'shell', 'earth']) })),
  /**
   * The figure: the model id, fitted to `height` m with its feet on y 0 facing +Z (centred on its footing when `centre`
   * is 'base'); the head is every triangle at or over the neck (no neck: no head pivot); the arm, the triangles with x
   * under `armBelowX + armSlope·y` and y over `armAboveY`, under `armTopY` (else the neck + 0.02); with an `elbow`, the
   * arm's triangles past the plane through `elbow.at` square to `elbow.axis` (x-y) are the forearm on the elbow pivot;
   * the vertex-coloured material's roughness and flat shading (a flat figure's normals are recomputed).
   */
  figure: v.strictObject({ model: npcRowName, height: positive, neck: v.exactOptional(vec3), shoulder: vec3, armBelowX: npcRowFinite, armAboveY: npcRowFinite,
    armSlope: v.exactOptional(npcRowFinite), armTopY: v.exactOptional(npcRowFinite), centre: v.exactOptional(v.picklist(['base'])),
    elbow: v.exactOptional(v.strictObject({ at: vec3, axis: v.tuple([npcRowFinite, npcRowFinite]) })),
    roughness: v.pipe(npcRowFinite, v.minValue(0), v.maxValue(1)), flat: v.boolean() }),
  /** how the figure moves (`NpcMotionSchema`); none: `PIVOT_NPC_MOTION` (plugin/geometry) */
  motion: v.exactOptional(NpcMotionSchema),
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
