import { expect, test } from 'vitest';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { moverBake, parseMovers } from '@wildshard/format/movers';
import { captureDriftwoodMovers } from '../src/shards/driftwood-isle/generators/movers';
import { MOVER_BAKE as driftwood } from '../src/shards/driftwood-isle/data/moverBake';
import { MOVER_BAKE as sky } from '../src/shards/far-reach/data/moverBake';
import skyRows from '../src/shards/far-reach/data/movers.generated.json' with { type: 'json' };
import { captureSkyMovers } from '../src/shards/far-reach/generators/movers';
import rows from '../src/shards/driftwood-isle/data/movers.generated.json' with { type: 'json' };

// The complete pre-change generated TS payload, after JSON parsing and stringification.
const original = '7b0c66a9d2223a8f101a331ccc9a76f90b4de0e3a675f32c6f1740419180834e';
function originalPayload(data: readonly { execution: string }[]): string {
  return JSON.stringify(data.map(({ execution, ...row }) => { expect(execution).toBe('native'); return row; }));
}
test('keeps every original mover value while explicitly selecting native execution', () => {
  expect(hashImmutableBytes(new TextEncoder().encode(originalPayload(rows)))).toBe(original);
  const [boat, bridge] = rows;
  if (boat === undefined || bridge === undefined) throw new Error('Missing mover output');
  const captured = captureDriftwoodMovers(boat.module, bridge.module);
  expect(rows).toEqual(captured);
  expect(parseMovers(rows)).toEqual(parseMovers(captured));
  const [skyBridge, lift] = [...new Set(skyRows.map(row => row.module))];
  if (skyBridge === undefined || lift === undefined) throw new Error('Missing Sky drivers');
  expect(hashImmutableBytes(new TextEncoder().encode(originalPayload(skyRows)))).toBe('78c3a25ceb451fed7f740b310b795b19f232bf5776a4734f4fef5a34b33d6f9f');
  expect(JSON.stringify(skyRows)).toBe(JSON.stringify(captureSkyMovers(skyBridge, lift)));
});

test('keeps TypeScript as the default and refuses unsupported mover output formats', () => {
  expect(moverBake('driftwood-isle', driftwood).output).toBe('json');
  expect(moverBake('far-reach', sky).output).toBe('json');
  expect(moverBake('test', { capture: sky.capture, modules: sky.modules }).output).toBe('typescript');
  expect(() => moverBake('test', { ...driftwood, output: 'javascript' })).toThrow();
});
