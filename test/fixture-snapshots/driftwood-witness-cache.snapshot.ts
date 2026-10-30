import { afterAll, expect, test } from 'vitest';
import { cachedDriftwoodWitness, retireDriftwoodWitness } from '../fixtures/driftwood-witness-cache';

test('driftwood-witness-cache snapshot', () => { expect(cachedDriftwoodWitness).toBeTypeOf('function'); });
afterAll(retireDriftwoodWitness);
