// Node's TypeScript/asset hooks let the CLI and Vite share the same table writers.
import { genShards } from './gen-shards.mjs';
import { genBudgetDerivations } from './gen-budget-derivations.mjs';
import { genAskIds } from './gen-ask-ids.mjs';
import { prepareGeneration } from './generate.mjs';
import { genPortShares } from './gen-port-shares.mjs';
import { genStarterArmClips } from './gen-starter-arm-clips.mjs';
import { genStarterWeapons } from './gen-starter-weapons.mjs';
import { writeGeneratorInventory } from './generator-inventory.mjs';
import { execFileSync } from 'node:child_process';

const buildInputs = process.argv.includes('--build-inputs');
async function step(name, run) {
  const started = performance.now();
  try { return await run(); }
  finally { if (buildInputs) console.info(`gen-step ${name}: ${((performance.now() - started) / 1000).toFixed(3)}s`); }
}

// Rig-generating producers read the shared aliases too, so emit their pure table before the cache walk.
await step('arm-clips', () => genStarterArmClips());
await step('starter-weapons', () => genStarterWeapons());
// G292 admitted outputs are ready before asset sizes, versions and shard packing read them.
await step('generation', () => prepareGeneration(`${import.meta.dirname}/..`, { concurrency: buildInputs ? 4 : 1 }));
await import('./bake-loader.mjs');
// DS1.1: structural wire schemas are small deterministic authoring outputs, never committed.
const { writeFormatJsonSchemas } = await import('./gen-format-schema.mjs');
await step('format-schemas', () => writeFormatJsonSchemas(`${import.meta.dirname}/..`));
const shard = process.argv.find((arg) => arg.startsWith('--shard='))?.slice(8);
await step('shards', () => genShards(undefined, false, false, shard));
await step('ask-ids', () => genAskIds());
const { generateBootTables } = await import('../vite/gen.ts');
await step('boot-tables', async () => {
  if (buildInputs && process.env.WS_PRECOMMIT_BOOT_CACHE) {
    const { generateBootTablesCached } = await import('./gen-boot-cache.mjs');
    generateBootTablesCached(`${import.meta.dirname}/..`, process.env.WS_PRECOMMIT_BOOT_CACHE, generateBootTables);
  } else generateBootTables();
});
await step('budgets', () => genBudgetDerivations(undefined, process.argv.includes('--check-budgets'), shard));
// Boot tables add static imports; derive the closure from the completed graph.
await step('shards', () => genShards(undefined, false, false, shard));
// SF65: SHARD SELECT's port badges (the SF6 public share), measured from the completed source tree.
const measures = await step('port-shares', () => genPortShares());
// SF74 W13 (G281): the API surface, docs/api/*.md and the export index are build outputs, gitignored (~1.6 s).
// Commit-time inputs (scripts/precommit-inputs.mjs) keep only src/public outputs, so they skip these docs.
if (!process.argv.includes('--build-inputs')) {
  const { writeApiDocs } = await import('./gen-api.mjs');
  writeApiDocs();
  execFileSync(process.execPath, ['scripts/webgpu-inventory.mjs'], {cwd: `${import.meta.dirname}/..`, stdio: 'inherit'});
}

// G405: derived documentation is fresh build output, never commit payload.
if (!buildInputs) execFileSync(process.execPath, ['scripts/normalize/liveness.mjs', '--readme'], {cwd: `${import.meta.dirname}/..`, stdio: 'inherit'});
await step('generator-inventory', () => writeGeneratorInventory(`${import.meta.dirname}/..`, measures));
