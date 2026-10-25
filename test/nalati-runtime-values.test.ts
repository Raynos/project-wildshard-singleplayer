// oxlint-disable-next-line import/no-nodejs-modules -- Compare all current predecessor metadata and floor bytes before retirement.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bundle the defining source for the author boundary.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import * as v from 'valibot';
import { nalatiRuntimeRows } from '../src/shards/nalati-grasslands/generators/runtimeRows';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { hashImmutableBytes } from '../src/sdk/immutable';
import pins from './fixtures/nalati-place-runtime-files.json' with { type: 'json' };

const prefix = 'src/shards/nalati-grasslands/';
function original(path: string): unknown { const value: unknown = JSON.parse(readFileSync(`${prefix}${path}`, 'utf8')); return value; }
const inputs = { places: original('data/places.json'), paint: original('data/poiPaint.json') };

test('source values retain every predecessor metadata field and complete floor byte', () => {
  const packet = nalatiRuntimeRows(inputs);
  const before = v.parse(v.looseObject({ floorSources: v.array(v.object({ name: v.string(), source: v.string() })) }), original('data/placeRuntime.generated.json'));
  const { floorSources, ...runtime } = before;
  expect(packet.runtime).toEqual(runtime);
  expect(packet.metrics).toEqual(original('boot/modelMetrics.generated.json'));
  expect(packet.capture).toEqual(original('data/staticCapture.generated.json'));
  expect(packet.shapeBook).toEqual(original('data/shapeBook.generated.json'));
  expect(packet.floors.map(floor => floor.name)).toEqual(floorSources.map(floor => floor.name));
  for (const [index, floor] of packet.floors.entries()) {
    const beforeFloor = floorSources[index]; if (beforeFloor === undefined) throw new Error('Missing predecessor floor');
    const path = `${prefix}${beforeFloor.source}`;
    const expected = Object.entries(pins).find(([name]) => name === path)?.[1];
    expect(expected).toBeDefined(); expect(hashImmutableBytes(floor.bytes)).toBe(expected);
    expect(Buffer.compare(floor.bytes, readFileSync(path))).toBe(0);
  }
});

test('separate source builds own their metadata and floor backing', () => {
  const first = nalatiRuntimeRows(inputs);
  const before = first.floors.map(floor => hashImmutableBytes(floor.bytes));
  for (const floor of first.floors) floor.bytes.fill(0);
  if (first.capture === null || typeof first.capture !== 'object') throw new Error('Missing static capture rows');
  Reflect.set(first.capture, 'layer', 999);
  const second = nalatiRuntimeRows(inputs);
  expect(second.capture).toEqual(original('data/staticCapture.generated.json'));
  expect(second.floors.map(floor => hashImmutableBytes(floor.bytes))).toEqual(before);
});

test('the direct value producer stays in one config-safe source chunk', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve(`${prefix}generators/runtimeRows.ts`), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
  } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing direct runtime source bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});


test('the shipping post file retains its complete predecessor capture values', async () => {
  const { output } = await import('../src/shards/nalati-grasslands/generators/output');
  const file = output.namedFiles.find(row => row.name === 'look/post.json');
  if (file === undefined) throw new Error('Missing admitted Nalati post file');
  const bytes = output.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing owned Nalati post bytes');
  const document = v.parse(v.object({ painted: v.object({ capture: v.unknown() }) }), JSON.parse(new TextDecoder().decode(bytes)));
  expect(document.painted.capture).toEqual(original('data/staticCapture.generated.json'));
});
