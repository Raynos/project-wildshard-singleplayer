import { expect, test } from 'vitest';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { signalManifestMetadata } from '../src/shards/sunscar-dunes/generators/manifestGround';

// Original signal-manifest-ground metadata, before GR4 removes its file
// handoff. This pins every authored quest height, capture height and tint-grid
// descriptor without reading a generated seed or rebuilding the tint lattice.
test('Sunscar point queries retain the original ground metadata', () => {
  const bytes = new TextEncoder().encode(encodeCanonicalJson(signalManifestMetadata()));
  expect(hashImmutableBytes(bytes)).toBe('97841a514935d6b0b1940bbaf701695d92e3b4edac9e3b59b35bed8736b4ae65');
});
