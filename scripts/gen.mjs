// Node's TypeScript/asset hooks let the CLI and Vite share the same table writers.
import { resolve } from 'node:path';
import { genShards, refreshDiscovery } from './gen-shards.mjs';
import { genBudgetDerivations } from './gen-budget-derivations.mjs';
import { generationPlan, buildPrograms, emitProgramTables, programInputPlan } from './gen-programs.mjs';
import { assertHeavyLease } from './heavy-lane-lease.mjs';
import { generationTailCached } from './generation-tail-cache.mjs';
import { genStarterArmClips } from './gen-starter-arm-clips.mjs';
import { genStarterWeapons } from './gen-starter-weapons.mjs';
import { genStarterBag } from './gen-starter-bag.mjs';
import { genStarterEffects } from './gen-starter-effects.mjs';
import { genDecisionPolicies } from './gen-decision-policy.mjs';
import { genShardWords } from './gen-shard-words.mjs';
import { quietCli } from './quiet-cli.mjs';
import { beginPushInputs } from './push-post-inputs.mjs';
import { beginProgramInputProof } from './source-input-proof.mjs';

quietCli('gen');
const root = resolve(import.meta.dirname, '..');
const requests = process.argv.filter(arg => arg.startsWith('--shard='));
if (requests.length > 1) throw new Error('Generation accepts one --shard= request');
const shard = requests.at(0)?.slice(8);
// Separate product phases own ordinary products; discovery providers are
// required generation inputs even in an inputs-only invocation.
const inputsOnly = ['--inputs-only', '--proof', '--build-inputs'].some(flag => process.argv.includes(flag));
const plan = generationPlan(root, shard), inputPlan = programInputPlan(root, plan);
if (!inputsOnly && !process.env.CI && !process.env.GITHUB_ACTIONS) assertHeavyLease('build');
const publishPushInputs = beginPushInputs(`${import.meta.dirname}/..`);
const publishProgramProof = beginProgramInputProof(root, plan.products);

const buildInputs = process.argv.includes('--build-inputs');
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
await import('./bake-loader.mjs');
// DS1.1: structural wire schemas are small deterministic authoring outputs, never committed.
const { writeFormatJsonSchemas } = await import('./gen-format-schema.mjs');
await step('format-schemas', () => writeFormatJsonSchemas(`${import.meta.dirname}/..`));
const vocabularyShard = inputPlan.scoped && inputPlan.products.length === 1 ? inputPlan.products[0] : undefined;
// Product programs may read the static vocabulary before discovery exists.
await step('shard-vocabulary', () => genShardWords(root, false, vocabularyShard));
await emitProgramTables(root, plan, {
  inputsOnly, reuse: process.argv.includes('--proof') || process.argv.includes('--reuse'),
  build: async (inputRoot, selected, reuse) => {
    let count = 0;
    await step('programs', async () => { count = await buildPrograms(inputRoot, selected, reuse); });
    return count;
  },
  writeTables: async () => {
    await step('shards', () => generationTailCached(root, 'shards-before', () => genShards(undefined, false, false, vocabularyShard)));
    const { generateBootTables } = await import('../vite/gen.ts');
    await step('boot-tables', () => generationTailCached(`${import.meta.dirname}/..`, 'boot', async () => {
      if (buildInputs && process.env.WS_PRECOMMIT_BOOT_CACHE) {
        const { generateBootTablesCached } = await import('./gen-boot-cache.mjs');
        generateBootTablesCached(`${import.meta.dirname}/..`, process.env.WS_PRECOMMIT_BOOT_CACHE, generateBootTables);
      } else generateBootTables();
    }));
    await step('budgets', async () => {
      for (const selected of plan.scoped ? plan.products : [undefined]) await genBudgetDerivations(undefined, process.argv.includes('--check-budgets'), selected);
    });
    // Boot tables add static imports; derive the closure from the completed graph.
    await step('shards', () => generationTailCached(root, 'shards-after', () => genShards(undefined, false, false, vocabularyShard)));
  },
});
publishProgramProof();
try { publishPushInputs(); }
catch (error) { console.warn(`push-inputs: completed cache unavailable: ${error instanceof Error ? error.message : String(error)}`); }
