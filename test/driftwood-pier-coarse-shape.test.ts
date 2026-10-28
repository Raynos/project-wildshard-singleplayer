import { expect, test } from 'vitest';
import { pierCoarse, PIER_COARSE_FROM, PENNANT_BLUE } from '../src/shards/driftwood-isle/generators/pierCoarse';
import { PIER_PALETTE } from '../src/shards/driftwood-isle/generators/pier';
import { pierDeckAt } from '../src/shards/driftwood-isle/generators/pierLayout';
import { worldPierSites, resolvePierParams } from '../src/shards/driftwood-isle/generators/pierSites';
import { driftwoodGroundSampler } from '../src/shards/driftwood-isle/generators/groundSampling';
import { DECLARED_SEA } from '../src/shards/driftwood-isle/generators/sea';

const ground = driftwoodGroundSampler();
const piers = worldPierSites().map(site => resolvePierParams(site, ground, DECLARED_SEA.level));

test('each world pier stand-in is a few hundred flat-shaded triangles, clear of the sea-end road footprint', () => {
  expect(piers).toHaveLength(4);
  for (const p of piers) {
    const g = pierCoarse(p), position = g.getAttribute('position'), normal = g.getAttribute('normal'), color = g.getAttribute('color');
    expect(g.index).toBeNull();
    expect(normal.count).toBe(position.count); expect(color.count).toBe(position.count);
    expect(position.count / 3).toBeGreaterThan(60); expect(position.count / 3).toBeLessThanOrEqual(500);
    g.computeBoundingBox();
    const box = g.boundingBox;
    expect(box?.min.z).toBeGreaterThanOrEqual(PIER_COARSE_FROM - 1e-6);
    // the slab runs the whole deck, and the pilings reach down to the sea floor
    expect(box?.max.z).toBeCloseTo(p.length, 1);
    expect(box?.min.y).toBeCloseTo(Math.min(-p.pileDepth, p.landing === null ? 0 : p.landing.postGround[0] - 1.2, p.landing === null ? 0 : p.landing.postGround[1] - 1.2), 3);
  }
});

test('the slab follows the deck profile: its top meets pierDeckAt along the pier', () => {
  for (const p of piers) {
    const position = pierCoarse(p).getAttribute('position'), normal = pierCoarse(p).getAttribute('normal');
    const tops: { z: number; y: number }[] = [];
    for (let i = 0; i < position.count; i++) if (normal.getY(i) > 0.9 && Math.abs(position.getX(i)) > 1) tops.push({ z: position.getZ(i), y: position.getY(i) });
    for (const along of [PIER_COARSE_FROM, p.length / 2, p.length]) {
      const nearest = tops.reduce((best, row) => Math.abs(row.z - along) < Math.abs(best.z - along) ? row : best);
      if (Math.abs(nearest.z - along) < 0.05) expect(nearest.y).toBeCloseTo(pierDeckAt(p, along), 3);
    }
  }
});

test('it is drawn in the pier palette and the pennant blue, no other colour', () => {
  const allowed = [...Object.values(PIER_PALETTE), PENNANT_BLUE];
  for (const p of piers) {
    const color = pierCoarse(p).getAttribute('color');
    for (let i = 0; i < color.count; i++)
      expect(allowed.some(c => Math.abs(c.r - color.getX(i)) < 1e-6 && Math.abs(c.g - color.getY(i)) < 1e-6 && Math.abs(c.b - color.getZ(i)) < 1e-6)).toBe(true);
  }
});
