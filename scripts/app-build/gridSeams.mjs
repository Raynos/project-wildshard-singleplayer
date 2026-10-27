import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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
  return gridSeamAsset(source);
}

/** Ship the baked seams' exact bytes as their hashed asset beside the bundle (before the service worker counts it). */
export function writeGridSeams(outDir, root) {
  const asset = readGridSeams(root);
  mkdirSync(dirname(join(outDir, asset.fileName)), { recursive: true });
  writeFileSync(join(outDir, asset.fileName), asset.source);
}
