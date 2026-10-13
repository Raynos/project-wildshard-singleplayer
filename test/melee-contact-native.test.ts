// oxlint-disable-next-line import/no-nodejs-modules -- The defining binder must load in the canonical clean Node simulation host.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the same Node binary as the canonical native witnesses.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('loads and runs admitted contacts through the unchanged renderer-refusing native loader', () => {
  const output = execFileSync(execPath, ['--experimental-transform-types', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e', `
    import { bindMeleeContacts } from './src/game/plugin/simulation.ts';
    const rows = [{ lane: 'primary', heavy: true, cooldown: 0.9, shape: 'lane', reach: 8, size: 0.9,
      height: 0.9, allowance: 0.7, lands: [0.12, 0.32], show: 0.62, reports: true,
      hits: [0, 1].map(k => ({ source: 'owner', damage: 16, tags: ['dmg.melee'], moveId: 'fixture.' + k,
        copyVectors: false, copyTags: false, reactions: [] })) }];
    const family = bindMeleeContacts('weapon.fixture', rows, { owner: 'env', targets: () => [], hit: () => null });
    family.swing(0); family.cool(1 / 60); family.advance(0.32);
    console.log(JSON.stringify({ cooldown: family.cooldown, t: family.t, landed: family.landed, source: family.row(0).hits[0].source }));
  `], { encoding: 'utf8', timeout: 10_000 });
  expect(JSON.parse(output)).toEqual({ cooldown: 0.9 - 1 / 60, t: 0.32, landed: 2, source: 'env' });
});
