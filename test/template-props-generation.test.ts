import { expect, test } from 'vitest';
import { bake } from '../src/sdk/bake';
import { templateScene } from '../src/shards/_template/generators/templateScene';
// oxlint-disable-next-line import/no-nodejs-modules -- Exact byte equality without dumping megabytes of binary on a mismatch.
import { Buffer } from 'node:buffer';
import { templatePropRows } from '../src/shards/_template/generators/props';

test('direct props preserve every byte and row of the original scene-walk producer', () => {
  const fixture = templateScene(20);
  try {
    const original = bake(fixture.scene, { slug: 'template', name: 'Template shard' }, { props: fixture.props }).props;
    if (original === null) throw new Error('Original producer has no props');
    const { assets: actual, ...rows } = templatePropRows(), { assets: expected, ...originalRows } = original;
    expect(rows).toEqual(originalRows); expect([...actual.keys()]).toEqual([...expected.keys()]);
    for (const [hash, bytes] of actual) {
      const old = expected.get(hash); if (old === undefined) throw new Error('Unexpected props asset');
      expect(Buffer.compare(bytes, old), hash).toBe(0);
    }
  } finally { fixture.dispose(); }
});
