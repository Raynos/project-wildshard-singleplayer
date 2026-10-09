import { expect, it } from 'vitest';
import { skyWitness } from './native';

// The slices resume from checkpoints of the whole tape; a change to anything the witness loads (the runtime, the engine,
// the tape, the physics module, the shard's assets) leaves them stale: regenerate with
//   node --import ./scripts/sim-node-loader.mjs test/proof/far-reach/run.mjs checkpoints
it('resumes only from checkpoints written from the current headless inputs', () => {
  const result = skyWitness('fresh');
  expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toMatchObject({ status: 'fresh' });
  expect(result.status).toBe(0);
}, 60_000);
