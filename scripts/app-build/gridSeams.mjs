import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** The certified grid seams as the app build bakes them (gitignored, beside the title tables): the bundle defines only
 *  their small address (`__GRID_SEAM_ASSET__`, vite.config.ts) and ships the exact JSON bytes as one hashed asset. */
export const GRID_SEAMS = 'out/.app/grid-seams.json';

/** Keep the certifier's exact JSON bytes; only its small address enters JavaScript. */
export function gridSeamAsset(source) {
  const baked = JSON.parse(source);
  if (typeof baked !== 'object' || baked === null || !Array.isArray(Reflect.get(baked, 'plans'))
    || !Array.isArray(Reflect.get(baked, 'edges'))) throw new Error('Grid seam bake needs plans and edges');
  const bytes = Buffer.byteLength(source);
  if (bytes === 0 || bytes > 16 * 1024 * 1024) throw new Error('Grid seam bake exceeds its transport cap');
  const sha256 = createHash('sha256').update(source).digest('hex'), fileName = `assets/grid-seams-${sha256.slice(0, 8)}.json`;
  return { fileName, source, address: { url: `/${fileName}`, bytes, sha256 } };
}

/** Certify the generated catalogue's seam plans and each slug's edge source before the page is bundled (was
 *  vite/gridSeamPlans.ts's config hook): scripts/build-app.mjs runs it after the generators. */
export function bakeGridSeams(root) {
  const run = spawnSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', 'scripts/bake-grid-seams.mjs'],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
  if (run.error !== undefined) throw run.error;
  if (run.status !== 0) throw new Error(`Grid seam bake failed (${String(run.status)})`);
  gridSeamAsset(run.stdout);
  mkdirSync(dirname(join(root, GRID_SEAMS)), { recursive: true });
  writeFileSync(join(root, GRID_SEAMS), run.stdout);
}

/** The baked seams' asset; the app build bakes them first (vite.config.ts reads only its address). */
export function readGridSeams(root) {
  let source;
  try { source = readFileSync(join(root, GRID_SEAMS), 'utf8'); }
  catch { throw new Error(`Missing ${GRID_SEAMS}: build the app through scripts/build-app.mjs, which bakes the grid seams first`); }
  const asset = gridSeamAsset(source), index = join(root, 'out/.app/grid-strip-index.json');
  // Old isolated fixtures have no optional geometry capability. The normal
  // app bake writes its sealed index together with the producer's assets.
  if (!existsSync(index)) return asset;
  const metadata = JSON.parse(readFileSync(index, 'utf8'));
  if (metadata?.seams !== asset.address.sha256 || !Array.isArray(metadata.files) || metadata.files.length > 2048) throw new Error('Grid strip index differs from its seam source');
  const files = metadata.files.map(file => {
    if (typeof file?.url !== 'string' || !/^\/assets\/grid-strip-(?:(?:book|page)-[a-f0-9]{8}\.json|mesh-[a-f0-9]{8}\.bin)$/u.test(file.url)
      || typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(file.sha256) || !file.url.includes(file.sha256.slice(0, 8))
      || !Number.isSafeInteger(file.bytes) || file.bytes <= 0 || file.bytes > 16 * 1024 * 1024) throw new Error('Invalid grid strip artifact');
    return { url: file.url, bytes: file.bytes, sha256: file.sha256 };
  });
  if (metadata.geometry === undefined) {
    if (files.length > 0) throw new Error('Unowned grid strip artifacts');
    return asset;
  }
  const { directory, homes } = metadata.geometry;
  if (!Array.isArray(homes) || homes.length === 0 || homes.length > 256 || homes.some(home => typeof home !== 'string' || home.length === 0)
    || new Set(homes).size !== homes.length || !files.some(file => file.url === directory?.url && file.bytes === directory.bytes && file.sha256 === directory.sha256)) throw new Error('Invalid grid strip selector');
  return { ...asset, files, address: { ...asset.address, geometry: { directory, homes } } };
}

/** Ship the baked seams' exact bytes as their hashed asset beside the bundle (before the service worker counts it). */
export function writeGridSeams(outDir, root) {
  const asset = readGridSeams(root);
  mkdirSync(dirname(join(outDir, asset.fileName)), { recursive: true });
  writeFileSync(join(outDir, asset.fileName), asset.source);
  for (const file of asset.files ?? []) {
    const bytes = readFileSync(join(root, 'out/.app/grid-strip-pages', basename(file.url)));
    if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error('Grid strip artifact differs from its address');
    const target = join(outDir, file.url.slice(1)); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes);
  }
}
