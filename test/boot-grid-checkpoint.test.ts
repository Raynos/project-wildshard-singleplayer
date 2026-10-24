// @vitest-environment happy-dom
import { afterEach, expect, test } from 'vitest';
import { bootSignalRoadPlan, bootTemplateCheckpoint, bootTemplateRoadPlans, verifyBootTemplateRoad } from '../scripts/parity/boot-smoke.mjs';
import type { FloorGridState, FloorGridWitness, FloorGridPlan } from '../scripts/frame-floor-grid.mjs';

test('smoke road entries follow the observed lattice without changing local entry points', () => {
  const state = { pitch: 562.5, cells: [
    { instance: 'template', slug: '_template', cell: [-1, -1] },
    { instance: 'signal', slug: 'sunscar-dunes', cell: [-1, 0] },
  ] };
  const plans = bootTemplateRoadPlans(state);
  expect(plans.entry.start).toEqual({ x: -843.75, z: -562.5 });
  expect(plans.entry.waypoints).toEqual([{ x: -792.5, z: -562.5 }]);
  expect(plans.exit.waypoints).toEqual([plans.entry.start]);
  expect(bootSignalRoadPlan(state)).toMatchObject({ start: { x: -562.5, z: 281.25 },
    waypoints: [{ x: -562.5, z: 245 }] });
  expect(() => bootTemplateRoadPlans({ ...state, pitch: 500 })).toThrow('Invalid grid pitch');
  expect(() => bootSignalRoadPlan({ ...state, pitch: Infinity })).toThrow('Invalid grid pitch');
});

const cells = [{ instance: 'home', slug: 'driftwood-isle', cell: [0, 0] as const },
  { instance: 'template-2', slug: '_template', cell: [1, 1] as const }];
const key = 'wildshard.save.v2.template-2';
afterEach(() => { localStorage.removeItem(key); });

test('the short Template roundtrip enters from the road and returns by held input without a second pose', () => {
  const { entry, exit } = bootTemplateRoadPlans({ cells });
  expect(entry).toMatchObject({ from: null, to: 'template-2', start: { x: 277.5, z: 555 }, requiredResidents: ['template-2'] });
  expect(exit).toMatchObject({ from: 'template-2', to: null, waypoints: [entry.start] });
  expect(exit.start).toBeUndefined();
  for (const plan of [entry, exit]) expect(plan.movement).toBe('road-hover');
});

test.each([null, {}, { cells: [] }, { cells: [{ ...cells[1], cell: [1.5, 0] }] },
  { cells: [{ instance: '', slug: '_template', cell: [0, 1] }] }])('missing or malformed Template inventory refuses: %j', state => {
  expect(() => bootTemplateRoadPlans(state)).toThrow();
});

function save(data: unknown) { localStorage.setItem(key, JSON.stringify({ keys: { 'platform.region': { v: 1, data } } })); }
const exact = { revision: 1, integrity: 123, mode: 'exact', snapshot: '{"version":4}', logical: null };
test('durable Template evidence requires the real namespace and a complete checkpoint envelope', () => {
  expect(() => bootTemplateCheckpoint('template-2')).toThrow('no durable checkpoint');
  for (const data of [null, {}, { ...exact, integrity: -1 }, { ...exact, snapshot: '' }, { ...exact, revision: 0 }]) {
    save(data); expect(() => bootTemplateCheckpoint('template-2')).toThrow('invalid durable checkpoint');
  }
  save(exact);
  expect(bootTemplateCheckpoint('template-2')).toMatchObject({ instance: 'template-2', mode: 'exact', revision: 1, integrity: 123, snapshotCharacters: 13 });
});

function witness(plan: FloorGridPlan, beforeCount: number): FloorGridWitness {
  const at = (current: string | null, count: number): FloorGridState => ({ home: 'home', inside: current, cells,
    live: { crossing: { phase: 'settled', issue: null }, live: { current, crossings: count, gameplayReady: true,
      residents: current === null ? [] : [current], worldFeet: { x: current === null ? 277.5 : 310, y: 0.5, z: 555 },
      transitions: [{ from: plan.from, to: plan.to }] } } });
  return { plan, before: at(plan.from, beforeCount), after: at(plan.to, beforeCount + 1), elapsedSeconds: 1,
    trace: [{ seconds: 0.5, x: 290, y: 0.5, z: 555, current: plan.from, gameplayReady: true }] };
}
test('prepared-only, uncommitted, wrong-owner or missing durable Template proof cannot pass', () => {
  const plans = bootTemplateRoadPlans({ cells }); save(exact);
  const entry = witness(plans.entry, 0), exit = witness(plans.exit, 1), checkpoint = bootTemplateCheckpoint('template-2');
  expect(() => verifyBootTemplateRoad({ entry, exit, checkpoint })).not.toThrow();
  expect(() => verifyBootTemplateRoad({ entry, exit, checkpoint: { ...checkpoint, instance: 'other' } })).toThrow('does not match');
  const noCommit = { ...exit, after: { ...exit.after, live: { ...exit.after.live, live: { ...exit.after.live.live, crossings: 1 } } } };
  expect(() => verifyBootTemplateRoad({ entry, exit: noCommit, checkpoint })).toThrow('frame commits');
  const prepared = { ...entry, after: entry.before };
  expect(() => verifyBootTemplateRoad({ entry: prepared, exit, checkpoint })).toThrow('Destination interior');
});
