// oxlint-disable-next-line import/no-nodejs-modules -- Import the creature policies in plain Node with the renderer-denying loader.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the current Node binary for the closure proof.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

// SF72: the policies a renderer-free Driftwood host runs (the captain's fight, the monkey's perch / strike shell, the crab's
// and the sailor's brain shells, the shared contact) load in plain Node under the loader that refuses renderer modules.
const POLICIES = ['species/captainPolicy.ts', 'species/monkeyPolicy.ts', 'species/crab.ts', 'species/sailor.ts', 'combat/strikes.ts'];

it('imports the Driftwood creature policies without DOM or renderer modules', () => {
  const script = `for (const m of ${JSON.stringify(POLICIES)}) await import('./src/shards/driftwood-isle/' + m);
const { CaptainBrain } = await import('./src/shards/driftwood-isle/species/captainPolicy.ts');
const { MonkeyBrain } = await import('./src/shards/driftwood-isle/species/monkeyPolicy.ts');
if (typeof CaptainBrain !== 'function' || typeof MonkeyBrain !== 'function') throw new Error('missing policy');
if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('DOM present');`;
  const result = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e', script],
    { encoding: 'utf8', timeout: 20000 });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
});
