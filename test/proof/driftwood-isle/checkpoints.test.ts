import { expect, it } from 'vitest';
import { driftwoodWitness } from './native';

it('refuses checkpoints when any actually loaded gameplay module, tape or native physics byte changed', () => {
  const result = driftwoodWitness('fresh');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ status: 'fresh' });
}, 30_000);
