import * as v from 'valibot';
import type { SimHost } from '@wildshard/engine/sim';
import { DeclaredQuests } from './declared';
import { installInteractionRows, InteractionRules, parseInteractionRows, type InteractionRowsData, type InteractionSpot } from './interactionRows';
import { autoFlag, type InteractTable } from '@wildshard/engine/world/interact/types';
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
  if (ports.drive !== 'external') installInteractionRows(host, rules, { actorId: rows.graph.actor, stepId: rows.graph.step, spots, commands: ports.commands,
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
