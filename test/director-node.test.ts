// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the public director with the renderer-denying Node loader.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the current supported Node binary and checkout.
import process from 'node:process';
import { expect, it } from 'vitest';

it('admits and restores the actual Driftwood director in plain Node without page entry services', () => {
  const script = `
    import { readFileSync } from 'node:fs';
    import data from './src/shards/driftwood-isle/data/director.json' with { type: 'json' };
    import { createDirectorLane } from '@wildshard/game/plugin/director';
    const lane = await createDirectorLane(data, readFileSync('src/shards/driftwood-isle/assets/' + data.module), 357);
    const observe = { altar: 0, dead: 0, seen: 0, 'player-x': 20, 'player-z': 0, 'reward-x': 0, 'reward-z': 0 };
    lane.step(0, observe);
    const saved = lane.snapshot();
    lane.step(1, observe);
    lane.restore(saved);
    if (lane.tick !== 0 || lane.snapshot() !== saved || typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('Native Node director restore refused');
    console.log('restored');
  `;
  const result = spawnSync(process.execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e', script], { cwd: process.cwd(), encoding: 'utf8', timeout: 10_000 });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout.trim()).toBe('restored');
});
