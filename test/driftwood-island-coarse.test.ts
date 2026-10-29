import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { islandCoarse } from '../src/shards/driftwood-isle/generators/islandCoarse';
import { islandFoliagePlacements } from '../src/shards/driftwood-isle/generators/islandDressing';
import { shoreBoulderFacts } from '../src/shards/driftwood-isle/generators/shoreBoulders';
import { palmAxisAt } from '../src/shards/driftwood-isle/generators/palm';
import { inArea } from '../src/shards/driftwood-isle/generators/blenderArea';

// D200: Driftwood's coarse L1 tiles stand in for the island's palms and shore boulders past the render ring
test('every palm outside the cove and every shore boulder has its far silhouette where it stands', () => {
  const palms = islandFoliagePlacements().tiers.phone.palms.placements, boulders = shoreBoulderFacts().placements;
  const outside = palms.filter(palm => !inArea(palm.x, palm.z, 1));
  expect(outside.length).toBeGreaterThan(100);
  const geometry = islandCoarse(palms, boulders);
  try {
    const position = geometry.getAttribute('position');
    // a palm: a three-sided trunk (6 triangles) and four fronds seen from both sides (16); a boulder: six sides
    expect(position.count / 3).toBe(outside.length * 22 + boulders.length * 6);
    const points: Vector3[] = Array.from({ length: position.count }, (_, i) => new Vector3().fromBufferAttribute(position, i));
    const near = (target: Vector3, within: number): boolean => points.some(point => point.distanceTo(target) < within);
    for (const palm of outside) {
      const top = palmAxisAt(palm.params, 1).add(new Vector3(palm.x, palm.y, palm.z));
      expect(near(top, 0.6), `palm crown at ${palm.x.toFixed(1)}, ${palm.z.toFixed(1)}`).toBe(true);
    }
    for (const palm of palms.filter(row => inArea(row.x, row.z, 1)))
      expect(near(new Vector3(palm.x, palm.y, palm.z), 0.5), 'no stand-in inside the cove').toBe(false);
    for (const boulder of boulders) expect(near(new Vector3(boulder.x, boulder.y, boulder.z), (boulder.params?.r ?? 1) * 1.2)).toBe(true);
  } finally { geometry.dispose(); }
}, 120000);
