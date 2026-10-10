import * as v from 'valibot';
import { NpcRowSchema as npcSchema, parseNpcRow as parseNpc, parseNpcDialogueRow as parseDialogue, type NpcDialogueRow as Dialogue, type NpcRow as Npc } from '@wildshard/game/quest/npcRow';
import { QuestGraphSchema as graphSchema, parseQuestGraph as parseGraph, type QuestGraphRow as Graph } from '@wildshard/game/quest/questGraph';

/** A quest-giver NPC row (SF27): who it is, where it stands, what it says and how its pivot figure moves. */
export const NpcRowSchema = v.pipe(npcSchema);
/** A validated quest-giver NPC row. */
export type NpcRow = Npc;
/** Compile an authored NPC row; an unknown field or an empty dialogue refuses. */
export function parseNpcRow(input: unknown): Npc { return parseNpc(input); }
/** A quest graph's runtime row (SF27): its interaction actor, its marks' step id and its actions (`summon` a boss). */
export const QuestGraphSchema = v.pipe(graphSchema);
/** A validated quest graph runtime row. */
export type QuestGraphRow = Graph;
/** Compile an authored quest graph runtime row; an unknown field refuses. */
export function parseQuestGraph(input: unknown): Graph { return parseGraph(input); }

/** Compile dialogue for a skinned or pivot NPC while its existing view owns the figure. */
export function parseNpcDialogueRow(input: unknown): Dialogue { return parseDialogue(input); }
