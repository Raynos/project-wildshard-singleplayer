import { expect, it } from 'vitest';
import { nativeCompatibility } from '../compatibility/native';
import { checkpointsFresh, nineRapier, replayProof } from './witness';

it('refuses checkpoints from changed inputs and verifies the actual renderer-free closure is fresh', () => {
  expect(checkpointsFresh('changed-inputs').status).toBe('stale');
  const result = nativeCompatibility('nine-dragon-stack', 'fresh');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ status: 'fresh' });
}, 60_000);

it('refuses a stale replay before admitting any checkpoint or advancing any ticks', async () => {
  const report = await replayProof(await nineRapier(), 'changed-inputs', 'ride');
  expect(report).toMatchObject({ status: 'failed', checkpointCaptured: false, suffixTicksExecuted: 0, dependency: 'Stale Nine Dragon checkpoints; regenerate from current headless inputs' });
}, 60_000);
