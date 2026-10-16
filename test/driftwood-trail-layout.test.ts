import { expect, test } from 'vitest';
import { originalTrailside } from '../src/shards/driftwood-isle/generators/driftwoodTrailside.mjs';
import { islandTrailsideSpec, trailsideSpecKey } from '../src/shards/driftwood-isle/generators/trailsideLayout';
import { copyTrailsideGeometry, loadTrailsideGeometry } from '../src/shards/driftwood-isle/runtime/boot/trailsideGeometry';
import { admitDriftwoodFixtureRows } from './fixtures/driftwoodRows';
import bake from '../src/shards/driftwood-isle/data/trailsideBake.json' with { type: 'json' };

test('the offline layout preserves the admitted weld, placements and every collider exactly', async () => {
  const original = originalTrailside();
  const metadata = structuredClone(original.metadata);
  expect(metadata).toEqual(bake);
  admitDriftwoodFixtureRows();
  await loadTrailsideGeometry(new Map([['trailside', original.geometry]]));
  const copy = copyTrailsideGeometry();
  try {
    expect(copy.metadata).toEqual(expect.objectContaining({ specKey: trailsideSpecKey(islandTrailsideSpec()) }));
    expect({ ...copy.metadata, worldColliders: copy.worldColliders }).toEqual(metadata);
    expect(Object.keys(copy.geometry.attributes)).toEqual(Object.keys(original.geometry.attributes));
    for (const [name, attribute] of Object.entries(original.geometry.attributes)) {
      expect(copy.geometry.getAttribute(name).array).toEqual(attribute.array);
      expect(copy.geometry.getAttribute(name).array.buffer).not.toBe(attribute.array.buffer);
    }
    expect(copy.geometry.index?.array).toEqual(original.geometry.index?.array);
  } finally { copy.geometry.dispose(); original.geometry.dispose(); }
});

test('explicit changed author layouts still refuse before copying geometry', () => {
  admitDriftwoodFixtureRows();
  const changed = islandTrailsideSpec();
  changed.signs.push({ x: 0, z: 0, arrows: [{ toward: 0, label: 'TEST' }] });
  expect(() => copyTrailsideGeometry(trailsideSpecKey(changed))).toThrow('Trailside layout changed');
});
