// Node's TypeScript/asset hooks let the CLI and Vite share the same table writers.
import { genShards, refreshDiscovery } from './gen-shards.mjs';
import { genBudgetDerivations } from './gen-budget-derivations.mjs';
import { genAskIds } from './gen-ask-ids.mjs';
import { prepareGeneration } from './generate.mjs';
import { genStarterArmClips } from './gen-starter-arm-clips.mjs';
import { genStarterWeapons } from './gen-starter-weapons.mjs';
import { genStarterBag } from './gen-starter-bag.mjs';
import { genStarterEffects } from './gen-starter-effects.mjs';
import { genDecisionPolicies } from './gen-decision-policy.mjs';
import { quietCli } from './quiet-cli.mjs';
import { beginPushInputs } from './push-post-inputs.mjs';

quietCli('gen');
const publishPushInputs = beginPushInputs(`${import.meta.dirname}/..`);

const buildInputs = process.argv.includes('--build-inputs');
// --proof remains a build-input alias. Derived documentation belongs to pnpm docs.
const proof = process.argv.includes('--proof');
/** @param {string} name @param {()=>unknown} run */
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
// Policies are real producer inputs under shard roots. Creating them after
// the phase invalidates its negative inventories in the next CI job.
await step('decision-policies', () => genDecisionPolicies(`${import.meta.dirname}/..`));
// G292 admitted outputs are ready before asset sizes, versions and shard packing read them.
await step('generation', () => prepareGeneration(`${import.meta.dirname}/..`, { concurrency: buildInputs || proof || process.argv.includes('--parallel') ? 4 : 1 }));
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
try { publishPushInputs(); }
catch (error) { console.warn(`push-inputs: completed cache unavailable: ${error instanceof Error ? error.message : String(error)}`); }
