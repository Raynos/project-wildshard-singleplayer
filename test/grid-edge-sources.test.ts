// oxlint-disable-next-line import/no-nodejs-modules -- Node test serves the committed public/ bakes to the edge reader.
import { existsSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Node test resolves the public/ bake paths.
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import skySource from '../src/shards/far-reach/shard.config';
import { generatePlatform } from '../src/engine/sim/strips';
import { GridAssembly } from '../src/game/grid/assembly';
import { loadGridEdgeProfiles } from '../src/game/grid/edgeProfiles';
import { readGridEdges } from '../src/game/grid/edgeSources';
import { findShard } from '../src/game/shard/registry';
import { bakesTerrain } from '../src/game/shard/terrainBake';

// C4-R1-C13 (SF49): every grid cell's edges open from its own data, with no edge fallback. The reader fetches a terrain
// bake only for the shards that ship one (bakesTerrain, the baker's rule), and each of those bakes is on disk: in the push
// gate's export only committed files exist, so a bake that was never committed fails here as well as in bake-check.
const ROOT = join(import.meta.dirname, '..');
const fetchPublic = (fetched: string[]) => (url: string): Promise<Response> => {
  const path = join(ROOT, 'public', new URL(url, 'http://grid.test').pathname);
  fetched.push(path);
  return Promise.resolve(existsSync(path) ? new Response(readFileSync(path)) : new Response(null, { status: 404 }));
};

it('opens every Developer and DEVSERVER cell\'s legacy edges without a fallback, fetching only committed bakes', async () => {
  const assembly = new GridAssembly({ developer: true, devserver: true });
  const legacy = assembly.cells.filter(cell => { const manifest = findShard(cell.slug); return manifest?.shardfile === undefined && manifest?.gridShardfile === undefined; });
  expect(legacy.map(cell => cell.slug)).not.toContain('far-reach');
  expect(legacy.map(cell => cell.slug)).not.toContain('nine-dragon-stack');
  const fetched: string[] = [];
  // SF51-g converts the final legacy cell. The reader correctly refuses an empty assembly; there is then no bake to read.
  const cells = legacy.length === 0 ? [] : await loadGridEdgeProfiles(legacy, cell => readGridEdges(cell, { product: () => null, fetch: fetchPublic(fetched) }));
  expect(cells).toHaveLength(legacy.length);
  for (const cell of legacy) {
    const manifest = findShard(cell.slug); if (manifest === undefined) throw new Error(`Unregistered grid shard ${cell.slug}`);
    const bake = join(ROOT, 'public/assets/baked', cell.slug, 'terrain.bin');
    expect(fetched.includes(bake), cell.slug).toBe(bakesTerrain(manifest.ground));
    if (bakesTerrain(manifest.ground)) expect(existsSync(bake), `${cell.slug}'s committed terrain.bin`).toBe(true);
  }
});

it('reads Sky Reach (islands over the void, no terrain) as void edges at road level, never a fetched bake', async () => {
  const cell = new GridAssembly({ developer: true, devserver: false }).cells.find(row => row.slug === 'far-reach');
  if (cell === undefined) throw new Error('Sky Reach is the Developer catalogue\'s south cell');
  const source = await readGridEdges(cell, { product: () => null, fetch: () => Promise.reject(new Error('A structures world has no bake to fetch')) });
  expect(Object.values(source.observations).map(row => row.geometry)).toEqual(['void', 'void', 'void', 'void']);
  // the one platform generation admits them: G99's road wall and guard rail along every Sky Reach seam
  const assembly = new GridAssembly({ developer: true, devserver: false }), empty = assembly.emptyNeighbour.edge;
  const cells = await loadGridEdgeProfiles(assembly.cells, row => readGridEdges(row, { product: () => null, fetch: fetchPublic([]) }));
  const strips = generatePlatform(cells, empty);
  const [cx, cz] = cell.cell, seams = [`gap.x.${String(cx - 1)}.${String(cz)}`, `gap.x.${String(cx)}.${String(cz)}`, `gap.z.${String(cx)}.${String(cz - 1)}`, `gap.z.${String(cx)}.${String(cz)}`];
  for (const id of seams) {
    const rails = strips.find(strip => strip.id === id)?.features.filter(feature => feature.kind === 'guard-rail') ?? [];
    // a structures world's legacy edges declare no entry, so the rail runs the whole 500 m; the Rising Islet sockets open
    // only through its declared entryways (a shardfile product)
    expect(rails.map(rail => [rail.from, rail.to]), id).toEqual([[-250, 250]]);
  }
  if (source.kind !== 'declared') throw new Error('Sky Reach reads as declared rows');
  for (const row of Object.values(source.profiles)) { expect(row.heights).toHaveLength(256); expect(new Set(row.heights)).toEqual(new Set([0])); }
}, 90_000); // the one 3 × 3 platform generation takes ~5 s alone and ~20 s under the full parallel suite

it('keeps the declared Rising Islet product void outside its exact eight-metre midpoint entries', async () => {
  const cell = new GridAssembly({ developer: true, devserver: false }).cells.find(row => row.slug === 'far-reach');
  if (cell === undefined) throw new Error('Missing Sky Reach catalogue cell');
  const release = vi.fn(), fetch = vi.fn(() => Promise.reject(new Error('A declared product has no terrain transport')));
  const source = await readGridEdges(cell, { product: () => Promise.resolve({ admitted: { source: skySource }, release }), fetch });
  expect(source.kind).toBe('declared');
  expect(Object.values(source.observations).map(row => [row.geometry, row.entryWidth])).toEqual(Array.from({ length: 4 }, () => ['void', 8]));
  if (source.kind !== 'declared') throw new Error('Declared product was not admitted');
  expect(source.profiles).toEqual(skySource.edge);
  expect(source.profiles).not.toBe(skySource.edge);
  expect(release).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
});
