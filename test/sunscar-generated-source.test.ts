// oxlint-disable-next-line import/no-nodejs-modules -- Verify the converted folder after actual generation.
import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { hashImmutableBytes } from '../src/sdk/immutable';
import originalWorld from './fixtures/sunscar-world-files.json' with { type: 'json' };

const folder = 'src/shards/sunscar-dunes/';

test('converted Sunscar keeps no generated handoffs or textual output debt', () => {
  const app = v.parse(v.object({ producers: v.record(v.string(), v.array(v.string())) }),
    JSON.parse(readFileSync('scripts/source-generation-outputs.json', 'utf8')));
  // App-wide discovery remains with its defining G656 producer until GR11/GS.
  const appOutputs = new Set(Object.values(app.producers).flat());
  const files = readdirSync(folder, { recursive: true, encoding: 'utf8' }).map(name => folder + name);
  expect(files.filter(name => name.includes('.generated.') && !appOutputs.has(name))).toEqual([]);
  const debt = v.parse(v.object({ files: v.array(v.string()) }), JSON.parse(readFileSync('lint/generated-source-debt.json', 'utf8')));
  expect(debt.files.filter(name => name.startsWith(folder) && name.includes('.generated.'))).toEqual([]);
});

// G606/G694: frozen legacy boot still names these five public files. They are
// held for LD, separate from the modern source product's owned geometry.
test('the five legacy-held world GLBs retain all original bytes until LD', () => {
  for (const name of ['rocks.glb', 'dressing.glb', 'tower.glb', 'caravan.glb', 'well.glb'] as const) {
    const bytes = readFileSync(`public/assets/sunscar-dunes/baked/${name}`);
    expect({ bytes: bytes.length, hash: hashImmutableBytes(bytes) }).toEqual(originalWorld[name]);
  }
});
