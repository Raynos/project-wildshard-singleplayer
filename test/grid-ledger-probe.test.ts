// oxlint-disable-next-line import/no-nodejs-modules -- Exercises the ledger's exact host adapter without opening a game browser.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Browser functions execute in their own document globals, just as Page.evaluate does.
import { createContext, runInContext, runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { driveFloorGrid, stageFloorGrid, type FloorGridPlan, type FloorGridWitness } from '../scripts/frame-floor-grid.mjs';

const source = readFileSync('progress/memory/g226-platform-ledger/probe.mjs', 'utf8');
const routeSource = source.slice(source.indexOf('async function driveRoute'), source.indexOf('const [base, out]'));
const route = runInNewContext(`${routeSource}\ndriveRoute`, { stageFloorGrid, driveFloorGrid }) as
  (page: { evaluate: (expression: string) => Promise<unknown> }, plan: FloorGridPlan, origin: number) => Promise<FloorGridWitness>;

it('stages the first source before driving, and fences later probe legs to the same document without reseeding', async () => {
  const positions: { x: number; z: number }[] = [], hovers: boolean[] = [];
  const position = { x: 0, y: 0.55, z: 0 };
  const state = { inside: 'home', live: { crossing: { phase: 'idle' }, live: { current: 'home', worldFeet: position, residents: ['home'], gameplayReady: true } } };
  const context = createContext({ performance: { timeOrigin: 100, now: () => 10 }, setTimeout, clearTimeout,
    window: { __wildshard: { pose: (pose: { x: number; z: number }) => { Object.assign(position, pose); positions.push({ x: pose.x, z: pose.z }); },
      world: { player: { position, hover: false, hoverSpeedLimit: () => 15, setHover: (value: boolean) => { hovers.push(value); } },
        game: { app: { input: { clear: () => undefined } }, watchFrames: (tick: () => void) => { queueMicrotask(tick); return () => undefined; } } },
      shard: { grid: { state: () => state, residency: () => ({ claims: [] }) } } } } });
  const page = { evaluate: (expression: string): Promise<unknown> => Promise.resolve(runInContext(expression, context) as unknown) };
  const plan: FloorGridPlan = { name: 'source-proof', from: 'home', to: 'home', start: { x: 0, z: 230 }, waypoints: [], requiredResidents: ['home'] };
  expect((await route(page, plan, 100)).after.live.live.current).toBe('home');
  expect(positions).toEqual([{ x: 0, z: 230 }]); expect(hovers).toEqual([true, false]);
  const { start: _start, ...later } = plan;
  await route(page, later, 100);
  expect(positions).toHaveLength(1); expect(hovers).toEqual([true, false, true, false]);
  await expect(route(page, later, 99)).rejects.toThrow('document changed');
  expect(positions).toHaveLength(1); expect(hovers).toHaveLength(4);
});
