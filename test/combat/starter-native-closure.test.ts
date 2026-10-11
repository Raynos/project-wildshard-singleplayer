// oxlint-disable-next-line import/no-nodejs-modules -- The native loader must refuse any renderer dependency reached by starter rows.
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('loads the shared starter equipment and native contact profiles without the page or renderer', () => {
  const source = `
    import { DirectorLane } from './src/game/plugin/director.ts';
    import { SWORD, WOODEN_SWORD, IRON_SWORD, SWORD_WOOD, SWORD_IRON } from './src/game/weapons/starterMeleeProfile.ts';
    import { SWORD as again } from '@wildshard/game/weapons/starterMeleeProfile';
    console.log(JSON.stringify({ director: typeof DirectorLane, same: SWORD === again, ids: [SWORD.id, WOODEN_SWORD.id, IRON_SWORD.id],
      profiles: [SWORD_WOOD.id, SWORD_IRON.id], combo: SWORD_WOOD.moves.combo === SWORD_IRON.moves.combo }));
  `;
  const result: unknown = JSON.parse(execFileSync('node', ['--import', './scripts/sim-node-loader.mjs',
    '--input-type=module', '-e', source], { encoding: 'utf8', timeout: 5000 }));
  expect(result).toEqual({ director: 'function', same: true, ids: ['weapon.sword', 'weapon.sword', 'weapon.sword-iron'],
    profiles: ['weapon.sword', 'weapon.sword-iron'], combo: true });
});
