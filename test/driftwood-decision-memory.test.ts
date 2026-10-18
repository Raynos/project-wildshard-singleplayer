import { beforeAll, expect, test } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { compileScript } from '@wildshard/sdk/compileScript';
import { nameBlob } from '../src/sdk/blobs';
import { mergeProjectBlobs } from '../src/sdk/projectOutput';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { parseDecisionScripts } from '../src/format/decisionScripts';
import { validateShardfileAssets } from '../src/format/assetAdmission';
import { SCRIPT_LIMITS } from '../src/format/scriptLimits';
import product, { DRIFTWOOD_DECISION_MEMORY } from '../src/shards/driftwood-isle/generators/product';
import { CAPTAIN_DECISION } from '../src/shards/driftwood-isle/generators/captainDecision';
import { DRIFTWOOD_REGULAR_DECISIONS } from '../src/shards/driftwood-isle/generators/driftwoodRegularCombat';
import { TIDAL_GIANTS_DECISIONS } from '../src/shards/driftwood-isle/generators/tidalGiantsCombat';
import navigation from '../src/shards/driftwood-isle/data/navigation.generated.json';
import fixed from '../src/shards/driftwood-isle/data/fixedTiles.generated.json';

const declared = [...CAPTAIN_DECISION, ...DRIFTWOOD_REGULAR_DECISIONS, ...TIDAL_GIANTS_DECISIONS];
const modules: Uint8Array[] = [];
beforeAll(async () => {
  for (const [index, row] of declared.entries()) modules.push(await compileScript(`
export function ws_abi():i32 { return 1; }
export function ws_init(lo:i32,hi:i32):void {}
export function ws_io():i32 { return 16384; }
export function ws_handle():i32 { return ${index}; }`, { abi: 1, maximumPages: row.pages }));
});
function fixture(reserve = DRIFTWOOD_DECISION_MEMORY) {
  const source = emptyShardfile({ slug: 'driftwood-budget-test', name: 'Budget test', author: 'Test', revision: 1, seed: 2 });
  source.budgets.sim.resident = reserve;
  const blobs = declared.map((row, index) => {
    const bytes = modules[index]; if (bytes === undefined) throw new Error('Missing test module');
    return nameBlob(`behaviour/${row.id}.wasm`, 'wasm', bytes, { critical: true, script: { abi: 1, pages: row.pages } });
  });
  const merged = mergeProjectBlobs(source, new Map(), blobs);
  const scripts = parseDecisionScripts(declared.map((row, index) => {
    const blob = blobs[index]; if (blob === undefined) throw new Error('Missing test blob');
    return { id: row.id, abi: '1.0', side: 'sim', module: `blobs/wasm/${blob.file.hash}.wasm`,
      source: row.source, binding: { shard: true }, pages: row.pages, onFail: 'hold', on: ['start'],
      reads: [], commands: [], stateVersion: 1, state: [], params: {} };
  }));
  const fileBytes = merged.shard.files.reduce((sum, file) => sum + file.decoded + file.gpu, 0);
  merged.shard.serverBudget.memory = fileBytes + DRIFTWOOD_DECISION_MEMORY;
  return { ...merged, scripts };
}
function admit(value: ReturnType<typeof fixture>) {
  return validateShardfileAssets(value.shard, value.assets, hashImmutableBytes, undefined, undefined, value.scripts);
}
test('Driftwood accounts declared guest pages independently of placeholder hashes and compiled file bytes', () => {
  const reserve = declared.reduce((sum, row) => sum + row.pages * 65536 * 2, 0);
  expect(reserve).toBe(786432); expect(DRIFTWOOD_DECISION_MEMORY).toBe(reserve);
  const files = [...navigation.files, ...fixed.files.filter(file => fixed.critical.includes(file.hash))];
  expect(product.budgets.sim.resident).toBe(reserve + files.reduce((sum, file) => sum + file.decoded + file.gpu, 0));
  expect(product.serverBudget.memory).toBe(1000000 + reserve + files.reduce((sum, file) => sum + file.decoded, 0));
  expect(declared.length).toBeLessThanOrEqual(SCRIPT_LIMITS.instances);
  expect(reserve).toBeLessThanOrEqual(SCRIPT_LIMITS.memoryBytes);
});
test('actual asset admission accepts all six distinct bounded modules with the complete reserve', () => {
  const value = fixture();
  expect(new Set(value.scripts.map(row => row.module)).size).toBe(declared.length);
  expect(() => admit(value)).not.toThrow();
});
test('actual asset admission rejects the prior one-guest reserve', () => {
  expect(() => admit(fixture(2 * 65536))).toThrow('script memory budget understated or above host cap');
});
test('actual asset admission enforces the exact aggregate server-memory boundary', () => {
  const value = fixture(); expect(() => admit(value)).not.toThrow();
  value.shard.serverBudget.memory -= 1;
  expect(() => admit(value)).toThrow('script memory budget understated or above host cap');
});
