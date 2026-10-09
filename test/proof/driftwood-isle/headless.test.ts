import { expect, it } from 'vitest';
import { driftwoodWitness } from './native';

it('walks and interacts for 10k ticks in the real native island and proves all four flared entries', () => {
  const result = driftwoodWitness('headless');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ slug: 'driftwood-isle', compatible: false,
    headless: { status: 'passed', ticksExecuted: 10_000, alive: true, entries: { lanes: 92 } } });
}, 60_000);
for (const name of ['tick-10000', 'captain']) it(`continues the actual gameplay tape from ${name} within 10k ticks`, () => {
  const result = driftwoodWitness(`slice-${name}`);
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ [`slice-${name}`]: { status: 'passed', complete: true } });
}, 60_000);
