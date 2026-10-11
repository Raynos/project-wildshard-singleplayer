import { expect, it } from 'vitest';
import { floorGridPortalPlan, gridFloorWitnessFailures, type FloorGridPlan, type FloorGridState, type FloorGridWitness } from '../scripts/frame-floor-grid.mjs';

const cell = { instance: 'floating', slug: 'fixture', cell: [2, 3] as const };
const plan: FloorGridPlan = { name: 'fixture-road-entry', from: null, to: cell.instance, movement: 'road-hover',
  start: { x: 1387.5, z: 1665 }, waypoints: [{ x: 1320, z: 1665 }], requiredResidents: [cell.instance] };
const portal = { road: { id: 'road.east', at: [236, 0, 0] }, destination: { id: 'square', at: [0.95, 125, 7.5] }, links: [{ from: 'road.east', to: 'square' }] };
const entries = [{ edge: 'east', kind: 'portalLink', portal }];

it('follows the actual declared landing after the road portal instead of returning to a flat waypoint', () => {
  expect(floorGridPortalPlan(plan, cell, entries)).toEqual({ ...plan,
    waypoints: [{ id: 'road.east', x: 1346, y: 0, z: 1665 }, { id: 'square', x: 1110.95, y: 125, z: 1672.5 }],
    portal: { road: { id: 'road.east', x: 1346, y: 0, z: 1665 }, destination: { id: 'square', x: 1110.95, y: 125, z: 1672.5 } } });
  expect(plan.waypoints).toEqual([{ x: 1320, z: 1665 }]);
  expect(floorGridPortalPlan(plan, cell, [])).toBe(plan);
  expect(floorGridPortalPlan(plan, cell, [{ ...entries[0], edge: 'west' }])).toBe(plan);
});

it('refuses malformed destinations and unlinked nodes rather than guessing a spawn or transfer', () => {
  expect(() => floorGridPortalPlan(plan, cell, [{ edge: 'east', kind: 'portalLink', portal: { ...portal, destination: { id: 'square', at: [0, Number.NaN, 0] } } }])).toThrow('Invalid declared');
  expect(() => floorGridPortalPlan(plan, cell, [{ edge: 'east', kind: 'portalLink', portal: { ...portal, links: [] } }])).toThrow('Missing declared');
});

it('requires a visited road node and grounded destination in addition to entered runtime readiness', () => {
  const resolved = floorGridPortalPlan(plan, cell, entries);
  const state = (current: string | null): FloorGridState => ({ home: 'home', cells: [cell], inside: current, claims: [],
    live: { crossing: { phase: 'settled', issue: null }, live: { current, worldFeet: { x: 1110.95, y: 125, z: 1672.5 },
      crossings: current === null ? 0 : 1, transitions: current === null ? [] : [{ from: null, to: cell.instance }],
      residents: current === null ? [] : [cell.instance], gameplayReady: true } } });
  const witness: FloorGridWitness = { plan: resolved, before: state(null), after: state(cell.instance), elapsedSeconds: 5,
    trace: [{ seconds: 1, x: 1346, y: 0.02, z: 1665, current: cell.instance, gameplayReady: true }], portal: { roadSeen: true, landed: true } };
  expect(gridFloorWitnessFailures(witness)).toEqual([]);
  expect(gridFloorWitnessFailures({ ...witness, portal: { roadSeen: false, landed: true } })).toContain('Declared portal road and landing were not traversed');
  expect(gridFloorWitnessFailures({ ...witness, portal: { roadSeen: true, landed: false } })).toContain('Declared portal road and landing were not traversed');
  const { portal: omitted, ...missing } = witness;
  expect(omitted).toBeDefined();
  expect(gridFloorWitnessFailures(missing)).toContain('Declared portal road and landing were not traversed');
});


it('walks the declared lift approach before resolving an entered runtime, without a shard-name guess', () => {
  const approach = [{ x: 235, y: 0, z: 0 }, { x: 234, y: 0, z: 0 }];
  const resolved = floorGridPortalPlan(plan, cell, [{ edge: 'east', kind: 'socketLift', lift: { approach } }]);
  expect(resolved).toEqual({ ...plan, waypoints: [{ x: 1345, z: 1665 }, { x: 1344, z: 1665 }], authoredLift: { edge: 'east' } });
  expect(() => floorGridPortalPlan(plan, cell, [{ edge: 'east', kind: 'socketLift', lift: { approach: [{ x: 235, y: 0, z: 0 }] } }])).toThrow('Invalid declared');
  expect(() => floorGridPortalPlan(plan, cell, [{ edge: 'east', kind: 'socketLift', lift: { approach: [approach[0], { x: 234, y: Infinity, z: 0 }] } }])).toThrow('Invalid declared');
});
