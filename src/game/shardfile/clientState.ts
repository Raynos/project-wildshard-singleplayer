import * as v from 'valibot';
import type { ShardfileSimulation } from './simulation';
import type { DeclaredItems } from './items';
import type { Shardfile } from './schema';

const finite = v.pipe(v.number(), v.finite());
const natural = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
const name = v.pipe(v.string(), v.maxLength(256));
const vector = v.strictObject({ x: finite, y: finite, z: finite });
const item = v.strictObject({ version: v.literal(1), id: name,
  tick: v.pipe(finite, v.integer(), v.minValue(-1), v.maxValue(Number.MAX_SAFE_INTEGER)),
  cooldown: v.pipe(finite, v.minValue(0)), fuel: v.pipe(finite, v.minValue(0), v.maxValue(1)),
  lit: v.boolean(), held: v.boolean(), chargeTime: v.pipe(finite, v.minValue(0)),
  pending: v.pipe(v.array(v.strictObject({ action: v.picklist([1, 2, 3, 4]), aim: v.nullable(v.strictObject({ origin: vector, direction: vector })) })), v.maxLength(16)),
});
const itemsSchema = v.record(name, item);
const checkpoint = v.strictObject({ version: v.literal(1), revision: natural, tick: natural,
  lane: v.nullable(v.pipe(v.string(), v.maxLength(32 * 1024 * 1024))), items: itemsSchema,
  flags: v.pipe(v.array(name), v.maxLength(4096)),
  quests: v.pipe(v.array(v.strictObject({ version: v.literal(1), id: name, started: v.boolean(), currentId: v.nullable(name) })), v.maxLength(256)),
  dialogue: v.record(name, v.nullable(name)),
});
type ClientCheckpoint = v.InferOutput<typeof checkpoint>;
/** Logical level progress, independent of the Game's borrowed physics world and player motor. */
export const clientStateSave = { key: 'platform.continuation', scope: 'shard' as const, version: 1,
  schema: v.nullable(checkpoint), initial: (): ClientCheckpoint | null => null };
type Runtimes = DeclaredItems['runtimes'];

function itemStates(items: Runtimes): v.InferOutput<typeof itemsSchema> {
  return v.parse(itemsSchema, Object.fromEntries([...items].map(([id, runtime]) => [id, runtime.snapshot()])));
}
function restoreItems(items: Runtimes, input: unknown): void {
  const states = v.parse(itemsSchema, input);
  if (Object.keys(states).length !== items.size || [...items.keys()].some((id) => states[id] === undefined)) throw new Error('Item continuation identities changed');
  for (const [id, runtime] of items) { const state = states[id]; if (state === undefined) throw new Error('Missing item continuation'); runtime.restore(state); }
}
/** Include authoritative item queues in complete headless snapshots as well as the client's local checkpoint. */
export function installClientItemState(sim: ShardfileSimulation, items: Runtimes, step: () => void): void {
  sim.host.onStep('items.declared', step, { snapshot: () => JSON.stringify(itemStates(items)), restore: (value) => {
    if (typeof value !== 'string') throw new Error('Invalid item continuation');
    const before = itemStates(items);
    try { const parsed: unknown = JSON.parse(value); restoreItems(items, parsed); }
    catch (error) { restoreItems(items, before); throw error; }
  } });
}
/** Snapshot only logical authored progress; regional whole-world snapshots remain owned by the grid sim registry. */
export function captureClientState(source: Shardfile, sim: ShardfileSimulation, items: Runtimes): ClientCheckpoint {
  return v.parse(checkpoint, { version: 1, revision: source.identity.revision, tick: sim.host.state.tick,
    lane: sim.lane?.snapshot() ?? null, items: itemStates(items), flags: sim.host.flags.all,
    quests: sim.quest.quests.map((quest) => quest.snapshot()), dialogue: sim.quest.snapshot() });
}
function apply(sim: ShardfileSimulation, items: Runtimes, state: ClientCheckpoint): void {
  if ((sim.lane === undefined) !== (state.lane === null) || state.quests.length !== sim.quest.quests.length) throw new Error('Local continuation contract changed');
  if (state.lane !== null) sim.lane?.restore(state.lane);
  restoreItems(items, state.items);
  sim.host.flags.restore(state.flags);
  for (const quest of sim.quest.quests) {
    const saved = state.quests.find((row) => row.id === quest.def.id); if (saved === undefined) throw new Error('Missing quest continuation'); quest.restore(saved);
  }
  sim.quest.restore(state.dialogue); sim.host.state.tick = state.tick;
}
/** Refuse incompatible/corrupt progress atomically. Silent quest restore never repeats profile rewards or scene events. */
export function restoreClientState(source: Shardfile, sim: ShardfileSimulation, items: Runtimes, input: unknown): boolean {
  const result = v.safeParse(checkpoint, input); if (!result.success || result.output.revision !== source.identity.revision) return false;
  const previous = captureClientState(source, sim, items);
  try { apply(sim, items, result.output); return true; }
  catch { apply(sim, items, previous); return false; }
}
