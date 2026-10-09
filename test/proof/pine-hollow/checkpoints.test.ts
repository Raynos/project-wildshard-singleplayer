import { expect, it } from 'vitest';
import { pineWitness } from './native';

// Every loaded repository module, native asset, loader and lockfile participates in the exact inputs hash.
it('refuses checkpoints written from any other gameplay inputs', () => {
  const result = pineWitness('fresh');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ status: 'fresh' });
}, 60_000);
