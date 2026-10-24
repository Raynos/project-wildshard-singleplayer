// oxlint-disable-next-line import/no-nodejs-modules -- Compare large actual pixel banks without a per-byte assertion report.
import { Buffer } from 'node:buffer';
// oxlint-disable-next-line import/no-nodejs-modules -- Only resolve the actual author module for its one-chunk boundary proof.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { MapRaster, stylizeMap } from '../scripts/map-painter.mjs';
import { rasterGroundMap } from '../src/sdk/bake/groundMap';
import { decodeTerrainTile } from '../src/format/terrainTileBytes';
import { templateTerrain } from '../src/shards/_template/generators/terrain';
import { templatePropRows } from '../src/shards/_template/generators/props';
import { pastelTerrain } from '../src/shards/pastel-plain/generators/terrain';
import { pastelProps } from '../src/shards/pastel-plain/generators/props';
import { bakeProps, type BakedProps } from '../src/sdk/bake/props';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import templateSettings from '../src/shards/_template/data/map.json' with { type: 'json' };
import pastelSettings from '../src/shards/pastel-plain/data/map.json' with { type: 'json' };

function bytes(assets: ReadonlyMap<string, Uint8Array>, hash: string): Uint8Array {
  const value = assets.get(hash); if (value === undefined) throw new Error('Missing map source geometry'); return value;
}
async function compare(terrain: ReturnType<typeof templateTerrain>, props: BakedProps, settings: { style: { kind: string } & Record<string, unknown> }): Promise<void> {
  const tiles = terrain.terrain.tiles.filter(row => row.lod === 0).map(row => bytes(terrain.assets, row.file));
  const refs: string[] = [];
  for (const row of props.props.tiles) if (row.lod === 0) refs.push(row.file, ...row.additionalFiles ?? []);
  for (const row of props.props.panels) if (row.visible) refs.push(row.file);
  const glbs = refs.map(hash => bytes(props.assets, hash));
  const old = new MapRaster(1000);
  for (const tile of tiles) old.terrain(decodeTerrainTile(tile));
  for (const glb of glbs) await old.glb(glb);
  const actual = await rasterGroundMap(terrain, props, settings.style);
  expect(actual.triangles).toBe(old.triangles);
  expect(Buffer.compare(actual.pixels, stylizeMap(old, settings.style))).toBe(0);
}

test('source-only Template and Pastel ground maps preserve every original RGBA pixel and triangle', async () => {
  await compare(templateTerrain(), templatePropRows(), templateSettings);
  const fixture = pastelProps(20);
  try { await compare(pastelTerrain(), bakeProps(fixture.source), pastelSettings); }
  finally { fixture.dispose(); }
});

test('the pure ground map baker fits the unchanged author config import boundary', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/sdk/bake/groundMap.ts'), formats: ['es'], fileName: 'map' }, rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing ground map bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  const chunk = chunks[0]; if (chunk === undefined) throw new Error('Missing ground map chunk');
  expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});
