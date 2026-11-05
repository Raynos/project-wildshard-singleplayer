// oxlint-disable-next-line import/no-nodejs-modules -- The fixture uses shipped Rapier bytes.
import { readFileSync } from 'node:fs';
import { afterEach, expect, test } from 'vitest';
import { CHUNK_HALF, CONTENT_CAPS, ROAD_WIDTH } from '@wildshard/engine/core/config';
import { createSimHost, type SimHost, type SimLevel } from '../src/engine/server/sim';
import { leadPlayer } from '../src/engine/shared/sim/leadPlayer';
import { loadRapier } from '../src/engine/shared/physics/rapier';
import { GridAssembly } from '../src/game/shared/grid/assembly';
import { GridSimulation } from '../src/game/server/grid/simulation';
import { SIM_LEVEL } from './fixtures/sim-level/level';

// P1-E5.3-A10: the server's board reads the grid's cap as the page does, from world feet, wherever the seat's host keeps them.
const level: SimLevel = { ...SIM_LEVEL, entities: [], ground: { size: 3000, height: 0 } };
const STRIP = (CONTENT_CAPS.pitch - CHUNK_HALF * 2 - ROAD_WIDTH) / 2, disposers: (() => void)[] = [];
afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); });

async function gridOn(hoverClass?: (slug: string) => 'shard' | 'road' | undefined): Promise<{ grid: GridSimulation; assembly: GridAssembly; highway: SimHost; instance: string }> {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const assembly = new GridAssembly({ developer: false, devserver: false }), cell = assembly.cells[0];
  if (cell === undefined) throw new Error('Missing cell');
  const highway = createSimHost(level, { rapier });
  const grid = new GridSimulation(assembly, { highway: { host: highway, dispose: () => { highway.dispose(); } },
    load: () => { const host = createSimHost(level, { rapier }); return Promise.resolve({ host, dispose: () => { host.dispose(); } }); },
    ...(hoverClass === undefined ? {} : { hoverClass }) });
  disposers.push(() => { grid.dispose(); });
  return { grid, assembly, highway, instance: cell.instance };
}
const limitAt = (host: SimHost): number => {
  const read = leadPlayer(host).hoverSpeedLimit;
  if (read === null) throw new Error('No board limit');
  return read();
};

test('a seat on the highway takes the cap from where it stands in the world', async () => {
  const { grid, assembly, highway } = await gridOn(), cell = assembly.cells[0], lead = leadPlayer(highway);
  if (cell === undefined) throw new Error('Missing cell');
  expect(lead.hoverSpeedLimit).toBeNull();
  grid.step();
  const stand = (x: number, y: number): void => { lead.position.set(cell.origin.x + x, y, cell.origin.z); };
  stand(0, 0); expect(limitAt(highway)).toBe(14);
  stand(CHUNK_HALF + STRIP + 1, 0); expect(limitAt(highway)).toBe(30);
  stand(CHUNK_HALF + STRIP + 1, 6); expect(limitAt(highway)).toBe(14); // over the deck, not on it
  stand(CHUNK_HALF + STRIP / 2, 0); expect(limitAt(highway)).toBeCloseTo(22, 5);
});

test('a resident seat finds its own cell from world feet: raw cell-local feet would name the cell at the origin', async () => {
  const assembly = new GridAssembly({ developer: false, devserver: false }), cell = assembly.cells.find(row => row.cell[0] !== 0 || row.cell[1] !== 0);
  if (cell === undefined) throw new Error('Need a cell away from the origin');
  const { grid } = await gridOn(slug => slug === cell.slug ? 'road' : 'shard');
  await grid.enter(cell.instance);
  grid.step();
  const host = grid.host(), lead = leadPlayer(host);
  lead.position.set(0, 0, 0);
  expect(limitAt(host)).toBe(30);
});

test('a road-class cell keeps 30 m/s across its interior', async () => {
  const { grid, assembly, highway } = await gridOn(() => 'road'), cell = assembly.cells[0], lead = leadPlayer(highway);
  if (cell === undefined) throw new Error('Missing cell');
  grid.step();
  lead.position.set(cell.origin.x, 0, cell.origin.z);
  expect(limitAt(highway)).toBe(30);
});
