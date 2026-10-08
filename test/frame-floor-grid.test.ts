import { expect, it } from 'vitest';
import { gridFloorPlans, gridFloorWitnessFailures, type FloorGridState, type FloorGridWitness } from '../scripts/frame-floor-grid.mjs';

const cells = [{ instance: 'home', slug: 'driftwood-isle', cell: [0, 0] as const },
  { instance: 'template-1', slug: '_template', cell: [-1, -1] as const },
  { instance: 'pine', slug: 'pine-hollow', cell: [0, 1] as const },
  { instance: 'nalati', slug: 'nalati-grasslands', cell: [1, 0] as const }];
const state = (current: string, x: number, z: number): FloorGridState => ({ home: 'home', cells, inside: current,
  live: { crossing: { phase: 'idle', issue: null }, live: { current, worldFeet: { x, y: 0.55, z }, crossings: 0,
    transitions: [], residents: [current], gameplayReady: true } } });

it('routes a corner template through midpoint entrances and returns over the same road without another pose seed', () => {
  const [out, back] = gridFloorPlans({ home: 'home', cells }, 'template');
  expect(out).toMatchObject({ start: { x: 0, z: -230 }, waypoints: [{ x: 0, z: -277.5 },
    { x: -277.5, z: -277.5 }, { x: -277.5, z: -555 }, { x: -325, z: -555 }] });
  expect(back?.waypoints).toEqual([{ x: -277.5, z: -555 }, { x: -277.5, z: -277.5 }, { x: 0, z: -277.5 }, { x: 0, z: -230 }]);
  expect(back?.start).toBeUndefined();
});

it('requires real Pine and Nalati runtime residents in the requested Developer travel scenario', () => {
  const [pine, nalati] = gridFloorPlans({ home: 'home', cells }, 'runtime-travel');
  expect(pine?.requiredResidents).toEqual(['pine']);
  expect(nalati?.requiredResidents).toEqual(['pine', 'nalati']);
  expect(nalati?.waypoints).toEqual([{ x: 0, z: 277.5 }, { x: 277.5, z: 277.5 }, { x: 277.5, z: 0 }, { x: 325, z: 0 }]);
  expect(nalati?.start).toBeUndefined();
  expect(gridFloorPlans({ home: 'home', cells }, 'baseline')).toEqual([]);
  expect(() => gridFloorPlans({ home: 'home', cells: cells.slice(0, 2) }, 'runtime-travel')).toThrow('Pine and Nalati');
});

function witness(): FloorGridWitness {
  const plan = gridFloorPlans({ home: 'home', cells }, 'runtime-travel')[1];
  if (plan === undefined) throw new Error('Missing route fixture');
  const before = state('pine', 0, 325), after = state('nalati', 325, 0);
  after.live.live.crossings = 2; after.live.live.transitions = [{ from: 'pine', to: null }, { from: null, to: 'nalati' }];
  after.live.live.residents = ['pine', 'nalati'];
  return { plan, before, after, elapsedSeconds: 50, trace: [{ seconds: 25, x: 277.5, y: 0.55, z: 277.5, current: null, gameplayReady: true }] };
}

it('requires frame commits, interior gameplay, residency and a finite above-ground route in addition to frame cadence', () => {
  expect(gridFloorWitnessFailures(witness())).toEqual([]);
  const changes: ((row: FloorGridWitness) => void)[] = [
    row => { row.after.live.live.crossings = 0; },
    row => { row.after.live.live.transitions.reverse(); },
    row => { row.after.inside = null; },
    row => { row.after.live.live.gameplayReady = false; },
    row => { row.after.live.live.residents = ['nalati']; },
    row => { row.after.live.live.worldFeet.x = 805; },
    row => { row.trace = []; },
    row => { row.trace[0] = { seconds: 1, x: Number.NaN, y: 0, z: 0, current: null, gameplayReady: true }; },
    row => { row.trace[0] = { seconds: 1, x: 0, y: -1, z: 0, current: null, gameplayReady: true }; },
  ];
  for (const change of changes) { const row = witness(); change(row); expect(gridFloorWitnessFailures(row).length).toBeGreaterThan(0); }
});
