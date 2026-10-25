#!/usr/bin/env node
// G508: normal generation job; reads only declared JSON, terrain and GLB data.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MapRaster } from '../src/sdk/bake/mapRaster.ts';
import { readMapGeometry, stylizeMap } from './map-painter.mjs';
import { MAP_METRES, mapPixelHash, mapSettingsPath, mapStampPath, mapShards, mapTilesHash } from './map-hash.mjs';
import { InputHashMemo } from './bake-input-hashes.mjs';

const sharp = createRequire(new URL('../src/sdk/package.json', import.meta.url))('sharp');
const json = file => JSON.parse(readFileSync(file, 'utf8'));

/** One build-scoped map fence. Every output raster is still verified by the
 * product build; source/output snapshot verification is shared within a report.
 * @param {string} root */
export function createDataMapPreparation(root) {
  /** @type {import('./generate.mjs').ShardGenerationJob[]|undefined} */
  let phaseJobs;
  /** @type {InputHashMemo|undefined} */
  let sharedHashes;
  /** @type {boolean|undefined} */
  let localVerified;
  /** @param {readonly string[]|undefined} only */
  return async only=>{
  // Discovery stays inside the per-folder failure boundary in report mode.
  const requested=[];
  for (const { slug, dir } of mapShards(root)) {
    if (only !== undefined && !only.includes(slug)) continue;
    const settings = json(mapSettingsPath(dir));
    if (settings.painter === undefined || settings.painter.program === true) continue;
    for (const id of settings.painter.prerequisites ?? []) requested.push({slug,id,prerequisite:true});
    requested.push({slug,id:settings.painter.job,prerequisite:false});
  }
  if(requested.length===0)return;
  const { discoverGeneration, generateShardJob, verifiedPreparedGeneration } = await import('./generate.mjs');
  const jobs=phaseJobs ??= discoverGeneration(root).jobs;
  const selected=requested.map(({slug,id,prerequisite})=>{
    const job=jobs.find(row=>row.id===id);
    if(job===undefined)throw new Error(prerequisite?`${slug}: missing map prerequisite ${id}`:`${slug}: data map generation job is missing`);
    return job;
  });
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

/** Rasterize declared map geometry into owned RGBA without publishing an image or stamp.
 * Readers retain input authority; both source-owned and validated file inputs use this same algorithm. */
export async function rasterDataMap(settings, data, { output, glbs, label = 'map' } = {}) {
  const painter = settings.painter;
  if (painter?.version !== 1 || settings.style === undefined) throw new Error(`${label}: missing data map painter declaration`);
  const raster = new MapRaster(1000, settings, readMapGeometry);
  const { paintMapGeometry } = await import('../src/sdk/bake/mapScenes.ts');
  const source = data.input;
  await paintMapGeometry(raster, settings, { input: source, model: url => source(`../../../public${url}`), json: data.json, bytes: data.bytes }, { output, glbs, label });
  const own = output === undefined ? undefined : settings.outputs?.[output];
  const style = own?.style ?? settings.style;
  const pixels = stylizeMap(raster, style);
  return { raster, pixels };
}

/** Paint the exact render lattice and placed prop triangles. Each address is
 * already world-space in the authored products; no second placement law exists.
 * SF88g: `output` paints one declared output of the folder (scripts/shard-outputs.mjs) from its own `glbs`, into
 * public/assets/<output>/map/top.webp with its stamp at look/map.<output>.baked.json. An output's own row in the map
 * settings' `outputs` (G633: a tiled open plot) gives its `style` (else the folder's) and `exclude`, node-name prefixes
 * its glbs leave out (its collision boxes stand over its roofs; its additive light pools are no ground). */
export async function paintDataMap(root, slug, { output, glbs, sources } = {}) {
  const dir = resolve(root, 'src/shards', slug), settings = json(mapSettingsPath(dir));
  const tilesHash = mapTilesHash(dir);
  const declared = settings.inputs.map(file => resolve(dir, file));
  const input = file => {
    const path = resolve(dir, file);
    if (!declared.some(source => path === source || path.startsWith(source + sep))) throw new Error(`${slug}: undeclared map input ${file}`);
    return path;
  };
  const source = file => sources?.get(file) ?? input(file);
  const readBytes = file => { const value = source(file); return value instanceof Uint8Array ? value : readFileSync(value); };
  const rows = file => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(readBytes(file)));
  const { raster, pixels } = await rasterDataMap(settings, { input: source, json: rows, bytes: readBytes }, { output, glbs, label: slug });
  const own = output === undefined ? undefined : settings.outputs?.[output], style = own?.style ?? settings.style, painter = settings.painter;
  const product = output ?? slug, image = resolve(root, 'public/assets', product, 'map/top.webp');
  mkdirSync(dirname(image), { recursive: true });
  // Lossless VP8L stores precisely the integer raster; no lossy SIMD rounding.
  const bytes = await sharp(pixels, { raw: { width: 1000, height: 1000, channels: 4 } }).webp({ lossless: true, effort: 6 }).toBuffer();
  if (mapTilesHash(dir) !== tilesHash) throw new Error(`${slug}: map inputs changed while painting`);
  writeFileSync(image, bytes);
  const stamp = { version: 1, tilesHash, pixelHash: await mapPixelHash(image), image: `/assets/${product}/map/top.webp`, size: 1000, metres: MAP_METRES, north: '+z', east: '-x', style: `data:${style.kind}`, bytes: bytes.length };
  const stampPath = output === undefined ? mapStampPath(dir) : resolve(dir, `look/map.${output}.baked.json`); mkdirSync(dirname(stampPath), { recursive: true });
  writeFileSync(stampPath, `${JSON.stringify(stamp, null, 2)}\n`);
  if (output !== undefined) { console.info(`data-map: ${output}, ${raster.triangles} source triangles, ${bytes.length} bytes`); return { raster, stamp }; }
  const companion = resolve(dir, 'data/productMap.json');
  if (companion !== stampPath && (painter.authored === true || existsSync(companion))) writeFileSync(companion, `${JSON.stringify(stamp, null, 2)}\n`);
  if (painter.authored === true) { mkdirSync(resolve(dir, 'assets'), { recursive: true }); writeFileSync(resolve(dir, 'assets/map.webp'), bytes); }
  console.info(`data-map: ${slug}, ${raster.triangles} source triangles, ${bytes.length} bytes`);
  return { raster, stamp };
}

const entry = process.argv.at(1);
if (entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href) {
  const root = resolve(import.meta.dirname, '..'), only = process.argv.find(arg => arg.startsWith('--shards='))?.slice(9).split(',');
  for (const { slug, dir } of mapShards(root)) if ((only === undefined || only.includes(slug)) && json(mapSettingsPath(dir)).painter !== undefined) await paintDataMap(root, slug);
}
