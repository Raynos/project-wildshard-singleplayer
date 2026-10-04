import { ScriptLane } from '../../../src/engine/script/lane';
import { DeclaredScriptWorld } from '../../../src/engine/script/state';

/** Recorded query replies deliberately decouple script identity from physics-engine floating-point drift. */
export interface QueryRecord { kind: number; input: readonly number[]; entity: number; reply: readonly number[] }
/** Identical admitted bytes, input tape and reply tape are fed to Node and WebKit. */
export interface ConformanceInput { bytes: readonly number[]; queries: readonly QueryRecord[]; ticks: number; checkpoint: number }
/** Every call's effects/fuel and complete restored continuation; strings preserve bigint and memory bytes exactly. */
export function runConformance(input: ConformanceInput): { calls: unknown[]; final: string; restored: string; queries: number } {
  let cursor = 0;
  const make = (): ScriptLane => {
    const world = new DeclaredScriptWorld({ fields: { 1: [-100000, 100000] }, archetypes: [], events: [1], maxEntities: 8 }, [1, 2].map((id) => ({ id, name: `actor ${id}`, position: [0, 0, 0], fields: { 1: 0 }, frozen: false, interactive: true })), {
      shared: [{ id: 101, name: 'door', type: 'bool', privacy: 'public', default: 0, min: 0, max: 1 }],
      player: [{ id: 202, name: 'progress', type: 'i32', privacy: 'owner', default: 0, min: 0, max: 10000 }],
    }, new Map([[1, 'alice'], [2, 'bob']]));
    return new ScriptLane({ world, query: (kind, request, entity) => {
      const record = input.queries[cursor++];
      if (!record || record.kind !== kind || record.entity !== entity || JSON.stringify(record.input) !== JSON.stringify(request)) throw new Error('Query tape divergence');
      return record.reply;
    }, modules: [{ name: 'policy', bytes: Uint8Array.from(input.bytes), seedLo: 435, seedHi: 0 }],
    bindings: [1, 2].map((entity) => ({ module: 'policy', entity, actorId: entity === 1 ? 'alice' : 'bob', kind: 'server' })), divisor: 1 });
  };
  const lane = make(), calls: unknown[] = []; let saved = '', savedCursor = 0;
  for (let tick = 1; tick <= input.ticks; tick++) {
    const result = lane.step(tick);
    if (result.some((call) => !call.ok)) throw new Error(`Conformance trap at ${tick}: ${JSON.stringify(result)}`);
    calls.push(result);
    if (tick === input.checkpoint) { saved = lane.snapshot(); savedCursor = cursor; }
  }
  if (cursor !== input.queries.length || saved.length === 0) throw new Error('Incomplete conformance tape');
  const final = lane.snapshot(), queries = cursor; cursor = savedCursor;
  const fresh = make(); fresh.restore(saved);
  for (let tick = input.checkpoint + 1; tick <= input.ticks; tick++) {
    const result = fresh.step(tick);
    if (JSON.stringify(result) !== JSON.stringify(calls[tick - 1])) throw new Error('Restored call divergence');
  }
  const restored = fresh.snapshot(); if (restored !== final) throw new Error('Restored state divergence');
  return { calls, final, restored, queries };
}
