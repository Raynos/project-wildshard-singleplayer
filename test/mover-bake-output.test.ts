import { expect, test } from 'vitest';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { moverBake, parseMovers } from '@wildshard/format/movers';
import { captureDriftwoodMovers } from '../src/shards/driftwood-isle/generators/movers';
import { MOVER_BAKE as driftwood } from '../src/shards/driftwood-isle/data/moverBake';
import { MOVER_BAKE as sky } from '../src/shards/far-reach/data/moverBake';
import rows from '../src/shards/driftwood-isle/data/movers.generated.json' with { type: 'json' };

// The complete pre-change generated TS payload, after JSON parsing and stringification.
const original = '7b0c66a9d2223a8f101a331ccc9a76f90b4de0e3a675f32c6f1740419180834e';
test('emits the exact original boat and bridge data from the retained mover recipes', () => {
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(rows)))).toBe(original);
  const [boat, bridge] = rows;
  if (boat === undefined || bridge === undefined) throw new Error('Missing mover output');
  const captured = captureDriftwoodMovers(boat.module, bridge.module);
  expect(rows).toEqual(captured);
  expect(parseMovers(rows)).toEqual(parseMovers(captured));
});

test('keeps TypeScript as the default and refuses unsupported mover output formats', () => {
  expect(moverBake('driftwood-isle', driftwood).output).toBe('json');
  expect(moverBake('far-reach', sky).output).toBe('typescript');
  expect(() => moverBake('test', { ...driftwood, output: 'javascript' })).toThrow();
});
