import * as v from 'valibot';
import type { ShardfileSimulation } from './simulation';
import type { DeclaredItems } from './items';
import type { Shardfile } from './schema';
import { LogicalStateSchema, migrateLogicalState, type DeclaredMigrations } from './migrations';
import { logicalStateFromLane, restoreLogicalLane } from './logicalState';
import { test as flagsMatch } from '@wildshard/engine/world/interact/flags';
import type { SimSnapshot } from '@wildshard/engine/sim/snapshot';

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
const fields = { revision: natural, tick: natural,
  lane: v.nullable(v.pipe(v.string(), v.maxLength(32 * 1024 * 1024))), items: itemsSchema,
  flags: v.pipe(v.array(name), v.maxLength(4096)),
  quests: v.pipe(v.array(v.strictObject({ version: v.literal(1), id: name, started: v.boolean(), currentId: v.nullable(name) })), v.maxLength(256)),
  dialogue: v.record(name, v.nullable(name)),
};
const legacyCheckpoint = v.strictObject({ version: v.literal(1), ...fields });
const logicalCheckpoint = v.strictObject({ version: v.literal(2), shard: name, state: LogicalStateSchema, ...fields });
/** Versioned local progress accepted independently of a regional engine snapshot. */
export const ClientCheckpointSchema = v.union([legacyCheckpoint, logicalCheckpoint]);
/** Portable declared progress plus the exact-revision fast path; old payloads stay readable. */
export type ClientCheckpoint = v.InferOutput<typeof ClientCheckpointSchema>;
/** Logical level progress, independent of the Game's borrowed physics world and player motor. */
export const clientStateSave = { key: 'platform.continuation', scope: 'shard' as const, version: 1,
  schema: v.nullable(ClientCheckpointSchema), initial: (): ClientCheckpoint | null => null };
type Runtimes = DeclaredItems['runtimes'];

/** Retry every home save owner; a logical continuation alone cannot confirm durable rewards or coins. */
export function checkpointClientState(ports: { ledger: { flush: () => boolean }; purse: { flush: () => boolean } | null; encounters: () => boolean; continuation: () => boolean }): boolean {
  const profile = ports.ledger.flush(), coins = ports.purse?.flush() ?? true;
  // Attempt all writes even after a refusal, retaining the latest local progress for the next retry.
  const encounters = ports.encounters(), continuation = ports.continuation();
  return profile && coins && encounters && continuation;
}

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
  const lane = sim.lane?.snapshot() ?? null;
  return v.parse(logicalCheckpoint, { version: 2, shard: source.identity.slug, state: migrateLogicalState(logicalStateFromLane(source.state.version, lane), source.state), revision: source.identity.revision, tick: sim.host.state.tick,
    lane, items: itemStates(items), flags: sim.host.flags.all,
    quests: sim.quest.quests.map((quest) => quest.snapshot()), dialogue: sim.quest.snapshot() });
}
/** Persist a portable companion to a same-engine region snapshot, so later revisions never need its old Rapier bytes. Legacy regions supply their known state-version-1 origin. */
export function clientStateFromRegion(source: Shardfile, snapshot: SimSnapshot, revision = source.identity.revision, stateVersion = source.state.version): ClientCheckpoint {
  v.parse(v.literal(source.identity.slug), snapshot.levelId);
  const lane = snapshot.adapters.find((adapter) => adapter.id === 'script.declared')?.state ?? null;
  if (lane !== null && typeof lane !== 'string') throw new Error('Invalid regional script state');
  const itemState = snapshot.adapters.find((adapter) => adapter.id === 'items.declared')?.state;
  if (itemState !== undefined && typeof itemState !== 'string') throw new Error('Invalid regional item state');
  const items: unknown = itemState === undefined ? {} : JSON.parse(itemState);
  const state = logicalStateFromLane(stateVersion, lane);
  // The exact region snapshot already owns executable memory. Its migration companion must not duplicate or depend on it.
  return v.parse(logicalCheckpoint, { version: 2, shard: source.identity.slug, state, revision, tick: snapshot.state.tick, lane: null, items,
    flags: snapshot.flags, quests: snapshot.quests, dialogue: snapshot.adapters.find((adapter) => adapter.id === 'quest.declared')?.state ?? {} });
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
function applyMigrated(source: Shardfile & { migrations?: DeclaredMigrations }, sim: ShardfileSimulation, items: Runtimes, state: ClientCheckpoint): void {
  // All historical version-1 client checkpoints predate authored state-version migrations and used state version 1.
  const logical = state.version === 2 ? state.state : logicalStateFromLane(1, state.lane);
  const migrated = migrateLogicalState(logical, source.state, source.migrations ?? []);
  restoreLogicalLane(sim.lane, migrated);
  for (const [id, runtime] of items) {
    const saved = state.items[id]; if (saved === undefined) continue;
    runtime.restore({ ...saved, tick: state.tick, cooldown: 0, held: false, chargeTime: 0, pending: [] });
  }
  sim.host.flags.restore(state.flags);
  for (const quest of sim.quest.quests) {
    const previous = state.quests.find((row) => row.id === quest.def.id);
    const currentId = previous?.currentId;
    const valid = currentId === null || (currentId !== undefined && quest.def.steps.some((step) => step.id === currentId));
    quest.restore(previous !== undefined && valid ? previous : { version: 1, id: quest.def.id,
      started: flagsMatch(sim.host.flags, quest.def.startWhen), currentId: quest.def.steps.find((step) => !flagsMatch(sim.host.flags, step.done))?.id ?? null });
  }
  const dialogue = sim.quest.snapshot();
  if (dialogue === null || typeof dialogue !== 'object' || Array.isArray(dialogue)) throw new Error('Invalid fresh dialogue');
  for (const row of source.quests.dialogue) {
    const saved = state.dialogue[row.id];
    if (saved === null || (saved !== undefined && row.nodes.some((node) => node.id === saved))) dialogue[row.id] = saved;
  }
  sim.quest.restore(dialogue); sim.host.state.tick = state.tick;
}
/** Refuse incompatible/corrupt progress atomically. Silent quest restore never repeats profile rewards or scene events. */
export function restoreClientState(source: Shardfile & { migrations?: DeclaredMigrations }, sim: ShardfileSimulation, items: Runtimes, input: unknown): boolean {
  const result = v.safeParse(ClientCheckpointSchema, input); if (!result.success || result.output.revision > source.identity.revision
    || !v.safeParse(v.literal(source.identity.slug), sim.host.level.id).success
    || (result.output.version === 2 && !v.safeParse(v.literal(source.identity.slug), result.output.shard).success)) return false;
  const previous = captureClientState(source, sim, items);
  try {
    if (result.output.revision === source.identity.revision) apply(sim, items, result.output);
    else applyMigrated(source, sim, items, result.output);
    return true;
  }
  catch { apply(sim, items, previous); return false; }
}
