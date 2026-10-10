import { expect, it } from 'vitest';
import layout from '../src/game/grid/singleplayer.json';
import { gridApproachPlans } from '../scripts/grid-approach-regression.mjs';
import type { FloorGridState } from '../scripts/frame-floor-grid.mjs';

it.each(['public', 'developer', 'devserver'] as const)('requires real-input preparation and entry for every %s grid cell', mode => {
  const overrides = mode === 'public' ? [] : layout.grid[mode];
  const replaced = new Set(overrides.map(cell => cell.cell.join(',')));
  const cells: FloorGridState['cells'] = [...layout.grid.cells.filter(cell => !replaced.has(cell.cell.join(','))), ...overrides]
    .map(cell => { const [x, z] = cell.cell; if (x === undefined || z === undefined) throw new Error('Missing cell address');
      return { instance: cell.instance, slug: cell.slug, cell: [x, z] }; });
  const plans = gridApproachPlans({ home: 'driftwood-isle', cells });
  expect(plans.map(plan => plan.to ?? '').sort((a, b) => a.localeCompare(b))).toEqual(cells.map(cell => cell.instance).sort((a, b) => a.localeCompare(b)));
  expect(plans[0]?.start).toBeDefined();
  for (const plan of plans) {
    expect(plan.movement).toBe('road-hover'); expect(plan.requiredResidents).toEqual([plan.to]);
    expect(plan.waypoints.length).toBeGreaterThan(0);
  }
  expect(plans.at(-1)?.to).toBe('driftwood-isle');
});

it('refuses duplicate catalogue identities rather than silently skipping a shard', () => {
  const cell = { instance: 'driftwood-isle', slug: 'driftwood-isle', cell: [0, 0] as const };
  expect(() => gridApproachPlans({ home: cell.instance, cells: [cell, cell] })).toThrow('every catalogue cell');
});
