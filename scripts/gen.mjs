// Node's TypeScript/asset hooks let the CLI and Vite share the same table writers.
import { genShards, refreshDiscovery } from './gen-shards.mjs';
import { genBudgetDerivations } from './gen-budget-derivations.mjs';
import { genAskIds } from './gen-ask-ids.mjs';
import { prepareGeneration } from './generate.mjs';
import { genStarterArmClips } from './gen-starter-arm-clips.mjs';
import { genStarterWeapons } from './gen-starter-weapons.mjs';
import { genStarterBag } from './gen-starter-bag.mjs';
import { genStarterEffects } from './gen-starter-effects.mjs';
import { writeGeneratorInventory } from './generator-inventory.mjs';
import { execFileSync } from 'node:child_process';
import { quietCli } from './quiet-cli.mjs';

quietCli('gen');

const buildInputs = process.argv.includes('--build-inputs');
// --proof (fast proofs: serve-build.sh, `pnpm build:proof`): the game's build inputs only, with the pre-commit's parallel
// generation; the derived docs (API docs, WebGPU inventory, scripts/README.md, generator inventory) are skipped.
const proof = process.argv.includes('--proof');
async function step(name, run) {
  const started = performance.now();
  try { return await run(); }
  finally { if (buildInputs) console.info(`gen-step ${name}: ${((performance.now() - started) / 1000).toFixed(3)}s`); }
}

// No step imports a discovery module older than its manifest (a mirror slot keeps ignored files).
await step('discovery', () => refreshDiscovery());
// Rig-generating producers read the shared aliases too, so emit their pure table before the cache walk.
await step('arm-clips', () => genStarterArmClips());
await step('starter-weapons', () => genStarterWeapons());
await step('starter-bag', () => genStarterBag());
await step('starter-effects', () => genStarterEffects());
// G292 admitted outputs are ready before asset sizes, versions and shard packing read them.
await step('generation', () => prepareGeneration(`${import.meta.dirname}/..`, { concurrency: buildInputs || proof ? 4 : 1 }));
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
// E486: SHARD SELECT's PORTED badges read the committed src/game/shard/portShares.json, which the plan ruler writes with
// ruler.json (scripts/gen-port-shares.mjs) and pre-commit keeps in step; gen has no port-shares step.
// SF74 W13 (G281): the API surface, docs/api/*.md and the export index are build outputs, gitignored (~1.6 s).
// Commit-time inputs (scripts/precommit-inputs.mjs) keep only src/public outputs, so they skip these docs.
if (!buildInputs && !proof) {
  const { writeApiDocs } = await import('./gen-api.mjs');
  writeApiDocs();
  const { writeHostCatalogue } = await import('./gen-host-catalogue.mjs');
  await step('host-catalogue', () => writeHostCatalogue());
  execFileSync(process.execPath, ['scripts/webgpu-inventory.mjs'], {cwd: `${import.meta.dirname}/..`, stdio: 'inherit'});
}

// G405: derived documentation is fresh build output, never commit payload.
if (!buildInputs && !proof) execFileSync(process.execPath, ['scripts/normalize/liveness.mjs', '--readme'], {cwd: `${import.meta.dirname}/..`, stdio: 'inherit'});
if (!proof) await step('generator-inventory', () => writeGeneratorInventory(`${import.meta.dirname}/..`));
