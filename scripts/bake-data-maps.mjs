#!/usr/bin/env node
// G508: normal generation job; reads only declared JSON, terrain and GLB data.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MapRaster, stylizeMap } from './map-painter.mjs';
import { MAP_METRES, mapPixelHash, mapSettingsPath, mapStampPath, mapShards, mapTilesHash } from './map-hash.mjs';
import { discoverGeneration, generateShardJob } from './generate.mjs';

const sharp = createRequire(new URL('../src/sdk/package.json', import.meta.url))('sharp');
const json = file => JSON.parse(readFileSync(file, 'utf8'));

/** A direct shardfile build has the same map generation fence as pnpm gen. */
export async function prepareDataMaps(root, only) {
  const jobs = discoverGeneration(root).jobs;
  for (const { slug, dir } of mapShards(root)) {
    if (only !== undefined && !only.includes(slug)) continue;
    const settings = json(mapSettingsPath(dir));
    if (settings.painter === undefined) continue;
    const job = jobs.find(row => row.id === settings.painter.job);
    if (job === undefined) throw new Error(`${slug}: data map generation job is missing`);
    await generateShardJob(root, job, { restore: true });
  }
}

/** Paint the exact render lattice and placed prop triangles. Each address is
 * already world-space in the authored products; no second placement law exists. */
export async function paintDataMap(root, slug) {
  const { decodeTerrainTile } = await import('../src/format/terrainTileBytes.ts');
  const dir = resolve(root, 'src/shards', slug), settings = json(mapSettingsPath(dir));
  const tilesHash = mapTilesHash(dir);
  const painter = settings.painter;
  if (painter?.version !== 1 || settings.style === undefined) throw new Error(`${slug}: missing data map painter declaration`);
  const raster = new MapRaster(1000, settings);
  const declared = settings.inputs.map(file => resolve(dir, file));
  const input = file => {
    const path = resolve(dir, file);
    if (!declared.some(source => path === source || path.startsWith(source + sep))) throw new Error(`${slug}: undeclared map input ${file}`);
    return path;
  };
  for (const file of painter.terrain ?? []) {
    const row = json(input(file));
    for (const tile of row.terrain.tiles.filter(entry => entry.lod === 0)) raster.terrain(decodeTerrainTile(readFileSync(input(`assets/${tile.file}`))));
  }
  for (const file of painter.props ?? []) {
    const { props } = json(input(file));
    if (props.wholeLibrary !== undefined) throw new Error(`${slug}: whole-library props need an explicit map assembly`);
    for (const tile of props.tiles.filter(entry => entry.lod === 0)) for (const ref of [tile.file, ...tile.additionalFiles ?? []]) await raster.glb(input(`assets/${ref}`));
    for (const panel of props.panels.filter(entry => entry.visible !== false)) await raster.glb(input(`assets/${panel.file}`));
  }
  for (const file of painter.glbs ?? []) await raster.glb(input(file));
  if (raster.triangles === 0) throw new Error(`${slug}: data map is empty`);
  const pixels = stylizeMap(raster, settings.style);
  const image = resolve(root, 'public/assets', slug, 'map/top.webp');
  mkdirSync(dirname(image), { recursive: true });
  // Lossless VP8L stores precisely the integer raster; no lossy SIMD rounding.
  const bytes = await sharp(pixels, { raw: { width: 1000, height: 1000, channels: 4 } }).webp({ lossless: true, effort: 6 }).toBuffer();
  if (mapTilesHash(dir) !== tilesHash) throw new Error(`${slug}: map inputs changed while painting`);
  writeFileSync(image, bytes);
  const stamp = { version: 1, tilesHash, pixelHash: await mapPixelHash(image), image: `/assets/${slug}/map/top.webp`, size: 1000, metres: MAP_METRES, north: '+z', east: '-x', style: `data:${settings.style.kind}`, bytes: bytes.length };
  const stampPath = mapStampPath(dir); mkdirSync(dirname(stampPath), { recursive: true });
  writeFileSync(stampPath, `${JSON.stringify(stamp, null, 2)}\n`);
  const companion = resolve(dir, 'data/productMap.json');
  if (companion !== stampPath && (painter.authored === true || existsSync(companion))) writeFileSync(companion, `${JSON.stringify(stamp, null, 2)}\n`);
  if (painter.authored === true) writeFileSync(resolve(dir, 'assets/map.webp'), bytes);
  console.info(`data-map: ${slug}, ${raster.triangles} source triangles, ${bytes.length} bytes`);
  return { raster, stamp };
}

const entry = process.argv.at(1);
if (entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href) {
  const root = resolve(import.meta.dirname, '..'), only = process.argv.find(arg => arg.startsWith('--shards='))?.slice(9).split(',');
  for (const { slug, dir } of mapShards(root)) if ((only === undefined || only.includes(slug)) && json(mapSettingsPath(dir)).painter !== undefined) await paintDataMap(root, slug);
}
