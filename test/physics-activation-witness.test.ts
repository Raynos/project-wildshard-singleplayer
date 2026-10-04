import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual harness functions without launching a browser.
import { runInNewContext } from 'node:vm';
// oxlint-disable-next-line import/default -- Vite raw source loader has one default string export.
import source from '../scripts/physics-baseline.mjs?raw';

interface Witness { systems: string[]; deviceSaves: Record<string, string> }
function harness(args: string[]): (page: { evaluate: () => Promise<Witness> }, shard: string) => Promise<Witness> {
  const context: Record<string, unknown> = { argv: args, flag: () => '' };
  const begin = source.indexOf('const SETTINGS ='), end = source.indexOf('const waitFor =');
  if (begin === -1 || end <= begin) throw new Error('Harness fixture section missing');
  runInNewContext(`${source.slice(begin, end)};globalThis.check = activationWitness;`, context);
  const check = context['check']; if (typeof check !== 'function') throw new Error('Activation witness missing');
  return check as (page: { evaluate: () => Promise<Witness> }, shard: string) => Promise<Witness>;
}
it('refuses an ON receipt when a saved choice exists but the declared system never installed', async () => {
  const key = 'debug.plugin.driftwood-isle.driftwoodHybrid';
  const check = harness([`--device-save=${key}=on`, '--expect-system=driftwood-isle:shard.driftwood.movers=on']);
  await expect(check({ evaluate: () => Promise.resolve({ systems: [], deviceSaves: { [key]: 'on' } }) }, 'driftwood-isle')).rejects.toThrow('Activation witness failed');
  await expect(check({ evaluate: () => Promise.resolve({ systems: ['shard.driftwood.movers'], deviceSaves: {} }) }, 'driftwood-isle')).rejects.toThrow('Device fixture missing');
  await expect(check({ evaluate: () => Promise.resolve({ systems: ['shard.driftwood.movers'], deviceSaves: { [key]: 'on' } }) }, 'driftwood-isle')).resolves.toMatchObject({ systems: ['shard.driftwood.movers'] });
});
it('refuses an OFF receipt if the mover system is present, and scopes assertions to their shard', async () => {
  const check = harness(['--expect-system=driftwood-isle:shard.driftwood.movers=off']);
  const page = { evaluate: () => Promise.resolve({ systems: ['shard.driftwood.movers'], deviceSaves: {} }) };
  await expect(check(page, 'driftwood-isle')).rejects.toThrow('Activation witness failed');
  await expect(check(page, 'pine-hollow')).resolves.toMatchObject({ systems: ['shard.driftwood.movers'] });
});
