#!/usr/bin/env node
// G508: normal generation job; reads only declared JSON, terrain and GLB data.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MapRaster, stylizeMap } from './map-painter.mjs';
import { MAP_METRES, mapPixelHash, mapSettingsPath, mapStampPath, mapShards, mapTilesHash } from './map-hash.mjs';
import { discoverGeneration, generateShardJob, verifiedPreparedGeneration } from './generate.mjs';
import { InputHashMemo } from './bake-input-hashes.mjs';

const sharp = createRequire(new URL('../src/sdk/package.json', import.meta.url))('sharp');
const json = file => JSON.parse(readFileSync(file, 'utf8'));

/** One build-scoped map fence. Every output raster is still verified by the
 * product build; source/output snapshot verification is shared within a report.
 * @param {string} root */
export function createDataMapPreparation(root) {
  /** @type {ReturnType<typeof discoverGeneration>['jobs']|undefined} */
  let phaseJobs;
  /** @type {InputHashMemo|undefined} */
  let sharedHashes;
  /** @type {boolean|undefined} */
  let localVerified;
  /** @param {readonly string[]|undefined} only */
  return async only=>{
  // Discovery stays inside the per-folder failure boundary in report mode.
  const jobs=phaseJobs ??= discoverGeneration(root).jobs;
  const selected=[];
  for (const { slug, dir } of mapShards(root)) {
    if (only !== undefined && !only.includes(slug)) continue;
    const settings = json(mapSettingsPath(dir));
    if (settings.painter === undefined) continue;
    for (const id of settings.painter.prerequisites ?? []) {
      const prerequisite = jobs.find(row => row.id === id);
      if (prerequisite === undefined) throw new Error(`${slug}: missing map prerequisite ${id}`);
      selected.push(prerequisite);
    }
    const job = jobs.find(row => row.id === settings.painter.job);
    if (job === undefined) throw new Error(`${slug}: data map generation job is missing`);
    selected.push(job);
  }
  if(selected.length===0)return;
  localVerified ??= verifiedPreparedGeneration(root);
  // A retained/non-admitted output may need restoration which the phase does
  // not promise. Keep the ordinary generator path for any such declaration.
  if(localVerified&&selected.every(job=>job.outputs.every(file=>(job.buildTimeOutputs??[]).includes(file)||Object.hasOwn(job.buildOutputs??{},file))))return;
  localVerified=false;
  const inputHashes=sharedHashes ??= new InputHashMemo(root,resolve(root,'.cache/generation-hashes.json'));
  try {for(const job of selected)(await generateShardJob(root,job,{restore:true,inputHashes})).release();}
  finally {inputHashes.flush();}
  };
}

/** A standalone shardfile build gets the same fresh generation fence.
 * @param {string} root @param {readonly string[]} [only] */
export async function prepareDataMaps(root,only) {await createDataMapPreparation(root)(only);}

/** Paint the exact render lattice and placed prop triangles. Each address is
 * already world-space in the authored products; no second placement law exists.
 * SF88g: `output` paints one declared output of the folder (scripts/shard-outputs.mjs) from its own `glbs`, into
 * public/assets/<output>/map/top.webp with its stamp at look/map.<output>.baked.json. */
export async function paintDataMap(root, slug, { output, glbs } = {}) {
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
  for (const file of glbs ?? painter.glbs ?? []) await raster.glb(input(file));
  if (painter.scenes !== undefined) {
    const { paintMapScenes } = await import('./map-scenes.mjs');
    await paintMapScenes(raster, painter.scenes, settings, { input, json: file => json(input(file)), bytes: file => readFileSync(input(file)) });
  }
  if (raster.triangles === 0) throw new Error(`${slug}: data map is empty`);
  const pixels = stylizeMap(raster, settings.style);
  const product = output ?? slug, image = resolve(root, 'public/assets', product, 'map/top.webp');
  mkdirSync(dirname(image), { recursive: true });
  // Lossless VP8L stores precisely the integer raster; no lossy SIMD rounding.
  const bytes = await sharp(pixels, { raw: { width: 1000, height: 1000, channels: 4 } }).webp({ lossless: true, effort: 6 }).toBuffer();
  if (mapTilesHash(dir) !== tilesHash) throw new Error(`${slug}: map inputs changed while painting`);
  writeFileSync(image, bytes);
  const stamp = { version: 1, tilesHash, pixelHash: await mapPixelHash(image), image: `/assets/${product}/map/top.webp`, size: 1000, metres: MAP_METRES, north: '+z', east: '-x', style: `data:${settings.style.kind}`, bytes: bytes.length };
  const stampPath = output === undefined ? mapStampPath(dir) : resolve(dir, `look/map.${output}.baked.json`); mkdirSync(dirname(stampPath), { recursive: true });
  writeFileSync(stampPath, `${JSON.stringify(stamp, null, 2)}\n`);
  if (output !== undefined) { console.info(`data-map: ${output}, ${raster.triangles} source triangles, ${bytes.length} bytes`); return { raster, stamp }; }
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
