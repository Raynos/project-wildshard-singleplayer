import * as v from 'valibot';
import type { SimHost } from '@wildshard/engine/sim';
import { DeclaredQuests } from './declared';
import { installInteractionRows, InteractionRules, type InteractionRowsData, type InteractionSpot } from './interactionRows';
import { npcSpot, type NpcRow } from './npcRow';
import type { QuestData } from '../shardfile/quests';

const name = v.pipe(v.string(), v.minLength(1), v.maxLength(96));
/**
 * A quest graph's runtime row (SHARD-PLATFORM SF27): the `script` command actor that carries its interaction rows, the
 * fixed-step id of their marks' continuation, and its `actions`, the beats a row's run starts beyond its flags (today
 * `summon`: the named boss encounter is armed, as a signal fire calls a boss up). Lighting a brazier and cracking a lever
 * are the interaction rows' own crack rows (`crack: 'light' | 'heavy'`).
 */
export const QuestGraphSchema = v.strictObject({
  actor: name, step: name,
  actions: v.pipe(v.array(v.strictObject({ row: name, summon: name })), v.maxLength(64)),
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
export function installQuestGraph(host: SimHost, rows: QuestGraphRows, ports: QuestGraphPorts): { quests: DeclaredQuests; rules: InteractionRules } {
  const actions = new Map(rows.graph.actions.map(action => [action.row, action] as const)), summon = ports.summon;
  if (actions.size > 0 && summon === undefined) throw new Error('A quest graph summons a boss but has no summon port');
  const quests = new DeclaredQuests(host, rows.quests, { fact: ports.fact, coins: ports.coins });
  const rules = new InteractionRules(host.flags, rows.interactions);
  const groundAt = (x: number, z: number): number => host.groundHeightAt(x, z);
  const spots = Object.fromEntries([...rows.npcs.map(npc => [npc.spot, npcSpot(npc, groundAt)] as const),
    ...ports.spots.interact.map(s => [s.id, s] as const), ...ports.spots.crack.map(s => [`crack.${s.id}`, s] as const)]);
  installInteractionRows(host, rules, { actorId: rows.graph.actor, stepId: rows.graph.step, spots, commands: ports.commands,
    ...(ports.crack === undefined ? {} : { crack: ports.crack }),
    done: row => { const action = actions.get(row); if (action !== undefined) summon?.(action.summon); } });
  return { quests, rules };
}
