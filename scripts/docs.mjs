// Derived human/agent inventories run separately from game-input generation.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { quietCli } from './quiet-cli.mjs';

quietCli('docs');
await import('./bake-loader.mjs');
const root = resolve(import.meta.dirname, '..');
/** @param {string} name @param {()=>unknown} run */
async function step(name, run) {
  const started = performance.now();
  try { return await run(); }
  finally { console.info(`docs-step ${name}: ${((performance.now() - started) / 1000).toFixed(3)}s`); }
}
await step('api', async () => (await import('./gen-api.mjs')).writeApiDocs(root));
await step('host-catalogue', async () => (await import('./gen-host-catalogue.mjs')).writeHostCatalogue(root));
await step('webgpu', () => execFileSync(process.execPath, ['scripts/webgpu-inventory.mjs'], { cwd: root, stdio: 'inherit' }));
await step('liveness', () => execFileSync(process.execPath, ['scripts/normalize/liveness.mjs', '--readme'], { cwd: root, stdio: 'inherit' }));
await step('generator-inventory', async () => (await import('./generator-inventory.mjs')).writeGeneratorInventory(root));
