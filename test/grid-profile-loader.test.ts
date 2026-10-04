import { expect, it } from 'vitest';
import { loadGridEdgeProfiles, type GridEdgeSource } from '../src/game/grid/edgeProfiles';
import { GridAssembly } from '../src/game/grid/assembly';
import { generatePlatform } from '../src/engine/sim/strips';

const assembly = new GridAssembly({ developer: false, devserver: false });
const rows = { ...assembly.emptyNeighbour.edge, heights: Array.from({ length: 257 }, (_, i) => i === 0 || i === 256 || Math.abs(i - 128) < 4 ? 0 : Math.sin(i / 7)) };
const source: GridEdgeSource = { kind: 'declared', profiles: { north: rows, east: rows, south: rows, west: rows }, observations: { north: { entryWidth: 6 }, east: { entryWidth: 6 }, south: { entryWidth: 6 }, west: { entryWidth: 6 } } };
it('waits for every true profile once per slug, then generates exactly one deterministic deck', async () => {
  const calls: string[] = []; let release: (() => void) | undefined;
  const fence = new Promise<void>((resolve) => { release = resolve; });
  let ready = false;
  const task = loadGridEdgeProfiles(assembly.cells, async (cell) => { calls.push(cell.slug); await fence; return source; }).then((cells) => { ready = true; return cells; });
  await Promise.resolve(); expect(ready).toBe(false);
  expect(calls.length).toBe(new Set(assembly.cells.map((cell) => cell.slug)).size);
  if (release === undefined) throw new Error('Missing profile fence'); release();
  const cells = await task;
  expect(cells.map((cell) => cell.instance)).toEqual(assembly.cells.map((cell) => cell.instance));
  expect(cells[0]?.edges.north.heights).toEqual(rows.heights); expect(cells[0]?.edges.north.heights).not.toBe(rows.heights);
  expect(Object.isFrozen(cells[0]?.cell)).toBe(true);
  expect(cells[0]?.observations?.north).not.toBe(source.observations.north);
  expect(Object.isFrozen(cells[0]?.observations?.north)).toBe(true);
  const platform = generatePlatform(cells, assembly.emptyNeighbour.edge);
  expect(platform).toHaveLength(40); expect(platform).toEqual(generatePlatform(cells, assembly.emptyNeighbour.edge));
}, 60_000); // Two complete native-profile platform generations exceed 20 s under coverage on the GitHub runner.
it('refuses missing or decimated neighbour data instead of installing a temporary zero deck', async () => {
  await expect(loadGridEdgeProfiles(assembly.cells, () => Promise.reject(new Error('Missing admitted bake')))).rejects.toThrow('Missing admitted bake');
  const old = { ...rows, heights: rows.heights.slice(0, 129), colours: rows.colours.slice(0, 129) };
  await expect(loadGridEdgeProfiles(assembly.cells, () => Promise.resolve({ ...source, kind: 'declared', profiles: { north: old, east: old, south: old, west: old } }))).rejects.toThrow('256 or 257');
});
