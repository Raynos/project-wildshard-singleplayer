// oxlint-disable-next-line import/no-nodejs-modules -- Pin frozen original floor and shape test oracles.
import { readFileSync } from 'node:fs';
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

test('frozen shape and floor oracles retain every original writer byte', () => {
  const shape = readFileSync('test/fixtures/nalati-shape-book-original.json');
  expect(hashImmutableBytes(shape)).toBe(pins['src/shards/nalati-grasslands/data/shapeBook.generated.json']);
  for (const [index, length] of [389376, 183184].entries()) {
    const floor = readFileSync(`test/fixtures/nalati-floor-original-${String(index)}.bin`);
    expect(floor.byteLength).toBe(length);
    const path = `src/shards/nalati-grasslands/data/place-floor-${String(index)}.generated.bin`;
    const pin = Object.entries(pins).find(([name]) => name === path)?.[1];
    expect(pin).toBeDefined(); expect(hashImmutableBytes(floor)).toBe(pin);
  }
});
