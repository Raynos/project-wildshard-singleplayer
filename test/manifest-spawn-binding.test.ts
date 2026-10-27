import { expect, test } from 'vitest';
import { parseManifestMetadata } from '../src/format/minimap';
import pine from '../src/shards/pine-hollow/manifest.json' with { type: 'json' };

// D58: a spawns binding may name a generator export, which scripts/manifest-spawns.mjs runs at discovery time.
test('a spawns binding names a generator export or a JSON/generated module, nothing else', () => {
  expect(parseManifestMetadata(pine, 'pine-hollow').bindings.spawns).toEqual({ module: './generators/fauna', export: 'PINE_FAUNA' });
  for (const module of ['./generators/../fauna', './generators/fauna.ts', './data/fauna.ts', './runtime/fauna'])
    expect(() => parseManifestMetadata({ ...pine, bindings: { ...pine.bindings, spawns: { module, export: 'PINE_FAUNA' } } }, 'pine-hollow')).toThrow();
});
