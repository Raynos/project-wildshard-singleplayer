// PINE-HOLLOW-REMASTER PH-0.3: the house pipelines' per-shard lookups — Driftwood keeps exactly what it had, Pine Hollow
// gets a Blender area and nothing else yet (no LUT file, no painted horizon, no adventure).
import { describe, expect, it } from 'vitest';
import { area, blenderAreaFor, blenderModelsBase, CELL } from '../src/world/blenderArea';
import { lutUrl } from '../src/world/lut';
import { horizonStrips } from '../src/world/HorizonMatte';
import { hasAdventure } from '../src/game/quest/Adventure';
import { CHUNK_HALF } from '../src/core/config';

describe('per-shard pipeline lookups (PH-0.3)', () => {
  it('Blender areas: Driftwood unchanged, Pine Hollow provisional, others none', () => {
    const dw = blenderAreaFor('driftwood-isle');
    expect(dw).toEqual(area);
    expect(area.x0).toBeCloseTo(-CHUNK_HALF + 71 * CELL, 9);
    expect(area.z1).toBeCloseTo(-CHUNK_HALF + 117 * CELL, 9);
    const ph = blenderAreaFor('pine-hollow');
    expect(ph).not.toBeNull();
    if (ph) {
      expect(ph.x0).toBeGreaterThan(-CHUNK_HALF);
      expect(ph.x1).toBeLessThan(CHUNK_HALF);
      expect(ph.x1).toBeGreaterThan(ph.x0);
      expect(ph.z1).toBeGreaterThan(ph.z0);
    }
    expect(blenderAreaFor('no-such-shard')).toBeNull();
    expect(blenderModelsBase('driftwood-isle')).toBe('/assets/models/driftwood-blender/');
    expect(blenderModelsBase('pine-hollow')).toBe('/assets/models/pine-hollow-blender/');
  });

  it('LUT: a shard gets one only when the build has its file', () => {
    expect(lutUrl('driftwood-isle')).toBe('/assets/lut/driftwood-isle.bin');
    expect(lutUrl('pine-hollow')).toBeNull();
  });

  it('painted horizon: Driftwood its strips and range, Pine Hollow its photoreal pair (PH-L5), others none', () => {
    expect(horizonStrips('driftwood-isle')).toEqual({
      day: '/assets/horizon/driftwood-isle-day.webp', night: '/assets/horizon/driftwood-isle-night.webp', elMin: -4, elMax: 24,
    });
    // the range is scripts/horizon-matte/configs/pine-hollow.json's strip; the texels are scene-linear ÷ 4 (encode.py)
    expect(horizonStrips('pine-hollow')).toEqual({
      day: '/assets/horizon/pine-hollow-day.webp', night: '/assets/horizon/pine-hollow-night.webp', elMin: -30, elMax: 14, scale: 4,
      phone: { day: '/assets/horizon/pine-hollow-day-phone.webp', night: '/assets/horizon/pine-hollow-night-phone.webp' },
    });
    expect(horizonStrips('nalati-grasslands')).toBeNull();
  });

  it('adventure registry: Driftwood registered, Pine Hollow empty', () => {
    expect(hasAdventure('driftwood-isle')).toBe(true);
    expect(hasAdventure('pine-hollow')).toBe(false);
  });
});
