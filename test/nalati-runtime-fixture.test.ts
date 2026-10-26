import { expect, test } from 'vitest';
import * as v from 'valibot';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nalatiRuntime } from './fixtures/nalati-runtime';
import pins from './fixtures/nalati-place-runtime-files.json' with { type: 'json' };

test('native test metadata retains the complete original runtime wire', () => {
  const runtime = v.parse(v.record(v.string(), v.unknown()), nalatiRuntime);
  const floorSources = [
    { name: 'world/floors/0.bin', kind: 'bin', source: 'data/place-floor-0.generated.bin' },
    { name: 'world/floors/1.bin', kind: 'bin', source: 'data/place-floor-1.generated.bin' },
  ];
  const bytes = new TextEncoder().encode(`${JSON.stringify({ floorSources, ...runtime }, null, 2)}\n`);
  expect(hashImmutableBytes(bytes)).toBe(pins['src/shards/nalati-grasslands/data/placeRuntime.generated.json']);
});
