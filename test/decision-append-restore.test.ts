// oxlint-disable-next-line import/no-nodejs-modules -- The actual host consumes the shipped native physics bytes.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { compileScript } from '@wildshard/sdk/compileScript';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { parseDecisionScripts } from '../src/format/decisionScripts';
import { scriptV1Layout } from '../src/format/scriptAbiV1';
import { createShardfileSim } from '../src/game/plugin/simulation';
import { loadRapier } from '../src/engine/physics/rapier';
import { SIM_LEVEL } from './fixtures/sim-level/level';

// G566: a native shard that gains a decision script (Driftwood's barrel watch) still restores its old saves. A saved
// contract whose script rows are a strict prefix of today's restores exactly, and only the appended bindings start fresh;
// a reordered, removed or changed row stays incompatible.
const rapier = loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
const io = scriptV1Layout(1, 0), state = 16384 + io.state * 8;
let counting: Uint8Array = new Uint8Array();
beforeAll(async () => {
  // every call adds one to its first state slot: an observable continuation
  counting = await compileScript(`export function ws_abi():i32{return 1;} export function ws_init(lo:i32,hi:i32):void{} export function ws_io():i32{return 16384;} export function ws_handle():i32 { store<f64>(${state},load<f64>(${state})+1); return 0; }`, { abi: 1 });
});
function shard(rows: readonly { id: string; tick?: number }[]) {
  const source = emptyShardfile({ slug: 'decision-append', name: 'Decision Append', author: 'Test', seed: 2, revision: 1 });
  const native = SIM_LEVEL.entities[0]; if (native === undefined) throw new Error('Missing creature fixture');
  const hash = hashImmutableBytes(counting);
  const scripts = parseDecisionScripts(rows.map(row => ({ id: row.id, abi: '1.0', side: 'sim', module: `blobs/wasm/${hash}.wasm`, source: `behaviour/${row.id}.as`,
    binding: { shard: true }, onFail: 'hold', tick: row.tick ?? 10, on: ['start', 'tick'], reads: [], commands: [], stateVersion: 1,
    state: [{ name: 'calls', type: 'f64', default: 0, scope: 'binding' }], params: {} })));
  return { source, assets: new Map([[hash, counting]]), sections: new Map<string, unknown>([['sim/scripts', scripts]]) };
}
async function saved(rows: readonly { id: string; tick?: number }[]) {
  const f = shard(rows), sim = createShardfileSim(f.source, f.assets, { sections: f.sections, rapier: await rapier });
  try { for (let i = 0; i < 30; i++) sim.host.step(); const value = sim.decisions?.snapshot(); if (value === undefined) throw new Error('Missing decisions'); return value; }
  finally { sim.dispose(); }
}
async function restoreInto(rows: readonly { id: string; tick?: number }[], value: string) {
  const f = shard(rows), sim = createShardfileSim(f.source, f.assets, { sections: f.sections, rapier: await rapier });
  try { sim.decisions?.restore(value); return JSON.parse(sim.decisions?.snapshot() ?? 'null') as { decision: { bindings: { id: number; script: string; slots: Record<string, number> }[] }; enabled: [number, boolean][] }; }
  finally { sim.dispose(); }
}

test('an appended script row restores the old bindings exactly and starts only the new one fresh', async () => {
  const old = await saved([{ id: 'captain' }]), before = JSON.parse(old) as { decision: { staged: unknown[]; bindings: { id: number; slots: Record<string, number> }[] } };
  const after = await restoreInto([{ id: 'captain' }, { id: 'barrels' }], old);
  expect(after.decision.bindings.find(row => row.id === 1)).toEqual(before.decision.bindings.find(row => row.id === 1));
  expect((after.decision as { staged?: unknown[] }).staged).toEqual(before.decision.staged); expect(before.decision.staged.length).toBeGreaterThan(0);
  expect(after.decision.bindings.find(row => row.id === 1)?.slots['calls']).toBeGreaterThan(0);
  const appended = after.decision.bindings.find(row => row.id === 2);
  expect(appended?.script).toBe('barrels'); expect(appended?.slots['calls']).toBe(0);
  expect(after.enabled.find(([id]) => id === 2)?.[1]).toBe((appended as { enabled?: boolean } | undefined)?.enabled === true);
});

test('a reordered, removed or changed script row stays incompatible', async () => {
  const two = await saved([{ id: 'captain' }, { id: 'barrels' }]), one = await saved([{ id: 'captain' }]);
  await expect(restoreInto([{ id: 'barrels' }, { id: 'captain' }], two)).rejects.toThrow('Incompatible decision continuation');
  await expect(restoreInto([{ id: 'captain' }], two)).rejects.toThrow('Incompatible decision continuation');
  await expect(restoreInto([{ id: 'captain', tick: 5 }, { id: 'barrels' }], one)).rejects.toThrow('Incompatible decision continuation');
  await expect(restoreInto([{ id: 'barrels' }, { id: 'extra' }], one)).rejects.toThrow('Incompatible decision continuation');
});

test('the same contract still restores byte-identically', async () => {
  const value = await saved([{ id: 'captain' }, { id: 'barrels' }]), f = shard([{ id: 'captain' }, { id: 'barrels' }]);
  const sim = createShardfileSim(f.source, f.assets, { sections: f.sections, rapier: await rapier });
  try { sim.decisions?.restore(value); expect(sim.decisions?.snapshot()).toBe(value); } finally { sim.dispose(); }
});
