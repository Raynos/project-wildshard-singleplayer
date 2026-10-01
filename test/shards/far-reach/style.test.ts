import { expect, it } from 'vitest';
import { toLevelSpec, type ShardManifest } from '#game';
import manifest from '#shards/far-reach/manifest';

it('accepts and carries an authored style word without changing explicit creature/kit rendering', () => {
  const custom = { ...manifest, style: 'unlistedStyle' } satisfies ShardManifest;
  const spec = toLevelSpec(custom);
  expect(spec.creatureStyle).toBe('unlistedStyle');
  expect(spec.kitLook).toBe('toon'); expect(spec.creatures?.lowPoly).toBe(true);
  expect(manifest.style).toBe('skyReach');
});
