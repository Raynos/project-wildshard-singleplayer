import { expect, it } from 'vitest';
import { CONTENT_CAPS } from '../src/engine/core/config';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { PageResidency } from '../src/game/grid/pageResidency';
import { runtimeAccountedBytes } from '../src/game/grid/runtimeCost';
import { DRIFTWOOD_RUNTIME_COST } from '../src/shards/driftwood-isle/data/runtimeCost';

const measured = DRIFTWOOD_RUNTIME_COST;

it('applies calibration once to the measured whole runtime home, including its render cost', () => {
  const owner = new PageResidency(new ResidencyAllocator());
  const claim = owner.admitHome('home', runtimeAccountedBytes(measured));
  expect(claim.bytes).toBe(Math.ceil(589_497_000 / CONTENT_CAPS.residentFactor));
  const expected = CONTENT_CAPS.engineBase + CONTENT_CAPS.overlap + 589_497_000;
  expect(owner.allocator.cost().playing).toBeGreaterThanOrEqual(expected);
  expect(owner.allocator.cost().playing).toBeLessThanOrEqual(expected + 2);
  // The real 1GB envelope includes the streaming overlap: a further 40MB cannot hide behind an empty source budget.
  expect(owner.allocator.reserve({ id: 'library:neighbour', category: 'library', owner: 'next', bytes: 40_000_000, distance: 1, needed: true })).toBeNull();
  owner.dispose();
});

it('refuses missing provenance, nonfinite or negative readings and an impossible engine subtraction', () => {
  for (const input of [undefined, { ...measured, device: '' }, { ...measured, evidence: '' }, { ...measured, rev: 'unknown' }, { ...measured, webContentMB: Number.NaN }, { ...measured, glMB: -1 }, { ...measured, engineBaseMB: 889 }, { ...measured, gpuProcessMB: 255 }]) {
    expect(() => runtimeAccountedBytes(input)).toThrow();
  }
});
