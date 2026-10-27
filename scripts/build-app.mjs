#!/usr/bin/env node
// D24 phase 2 (G799: no Vite plugins): the app build as a plain script. Its own steps run around `vite build` (each
// former Vite plugin is one of them), so every caller builds the app through this file, never a bare `vite build`.
//
//   node scripts/build-app.mjs [vite build arguments…]       e.g. --mode native, --config <file>, --outDir <dir>
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { bakeAssetTables, writeAssetTables } from './app-build/assetTables.mjs';
import { writeChunkReport } from './app-build/chunkReport.mjs';
import { bakeGridSeams, writeGridSeams } from './app-build/gridSeams.mjs';
import { checkNoTopLevelAwait } from './app-build/noTopLevelAwait.mjs';
import { copyOutputProducts } from './app-build/outputProducts.mjs';
import { stampBuildDocuments } from './app-build/buildIdentity.mjs';

const args = process.argv.slice(2);
/** a `--name value` or `--name=value` argument's value
 * @param {string} name */
const option = (name) => {
  const at = args.indexOf(`--${name}`);
  if (at !== -1) return args[at + 1];
  return args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
};
// the folder the config builds into: native mode's own (vite.config.ts), else dist, unless the caller names one
const mode = option('mode') ?? 'production', outDir = resolve(option('outDir') ?? (mode === 'native' ? 'dist-native' : 'dist'));

/** a node step that must pass (the build stops with its exit code)
 * @param {string[]} nodeArgs */
const step = (nodeArgs) => {
  const run = spawnSync(process.execPath, nodeArgs, { stdio: 'inherit' });
  if (run.error !== undefined) throw run.error;
  if (run.status !== 0) { process.exitCode = run.status ?? 1; process.exit(); }
};

// before the bundle (was vite/genShards.ts): the shard list and discovery, the two optional bakes (a failed one keeps its
// analytic fallback), the boot tables, then the shard list again (the tables can add static imports to a manifest's closure)
step(['scripts/gen-shards.mjs']);
for (const baker of ['bake-chunk', 'bake-sky']) {
  const run = spawnSync(process.execPath, ['--import', './scripts/bake-loader.mjs', `scripts/${baker}.mjs`], { stdio: 'inherit' });
  if (run.status !== 0) console.warn(`[bake] ${baker} failed — launch retains its analytic fallback`);
}
step(['--import', './scripts/bake-loader.mjs', '--input-type=module', '-e', "(await import('./scripts/app-build/gen.ts')).generateBootTables();"]);
step(['scripts/gen-shards.mjs']);
// the certified grid seams over the generated catalogue (was vite/gridSeamPlans.ts): the config defines their address
try { bakeGridSeams(process.cwd()); }
catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); }
// the boot table banks (was vite/assetTables.ts) and the world map atlas over the built products (was
// vite/worldMapAtlas.ts): the config defines their addresses
try { bakeAssetTables(process.cwd()); }
catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); }
step(['--import', './scripts/bake-loader.mjs', '--input-type=module', '-e', "await (await import('./scripts/app-build/worldMapAtlas.ts')).writeWorldMapAtlas(process.cwd());"]);

const vite = resolve(import.meta.dirname, '../node_modules/vite/bin/vite.js');
const build = spawnSync(process.execPath, [vite, 'build', ...args], { stdio: 'inherit' });
if (build.error !== undefined) throw build.error;
if (build.status !== 0) { process.exitCode = build.status ?? 1; process.exit(); }

// the native page as dist-native's index.html, the WebView error page beside it, and no trailers (was vite.config.ts's
// native plugin; capacitor.config.ts names the error page)
if (mode === 'native') {
  renameSync(resolve(outDir, 'native.html'), resolve(outDir, 'index.html'));
  copyFileSync('native-unavailable.html', resolve(outDir, 'native-unavailable.html'));
  for (const trailer of ['trailer-15.mp4', 'trailer-30.mp4']) rmSync(resolve(outDir, trailer), { force: true });
}
// version.json (the build id the documents are stamped with), asset-index.json and asset-manifest.json
step(['--import', './scripts/bake-loader.mjs', '--input-type=module', '-e', "(await import('./scripts/app-build/versionFiles.ts')).writeVersionFiles(process.argv[1]);", outDir]);
// the seams', boot tables' and world map's exact bytes as their hashed assets, beside the bundle that names them
writeGridSeams(outDir, process.cwd());
writeAssetTables(outDir, process.cwd());
const atlas = JSON.parse(readFileSync('out/.app/world-map.json', 'utf8')).fileName;
mkdirSync(dirname(resolve(outDir, atlas)), { recursive: true });
copyFileSync('out/.app/world-map.webp', resolve(outDir, atlas));

// no emitted app JavaScript may suspend its module's evaluation (was vite/noTopLevelAwait.ts); inline workers are iife,
// where the bundler refuses top-level await itself
checkNoTopLevelAwait(outDir, resolve('public'));

// which modules land in which chunk, and the title and grid session budgets over the bytes as written (was
// vite/chunkReport.ts); then the boot module bank into index.html and each home's extra file table (was
// vite/bootModules.ts). The web build only, which writes the manifest and hidden source maps they read.
if (mode !== 'native') {
  try { writeChunkReport(outDir, process.cwd()); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); }
  step(['--import', './scripts/bake-loader.mjs', '--input-type=module', '-e',
    "(await import('./scripts/app-build/bootModules.ts')).writeBootModules(process.argv[1], process.cwd());", outDir]);
}

// HTML owns the deploy identity; hashed runtime code stays reusable across builds.
// Native and calibration documents need it too. The worker must see these final bytes.
stampBuildDocuments(outDir);

if (mode !== 'native') {
  // the crossroads phone rig beside the bundle (was vite/crossroadsRig.ts); before the worker, which counts its files
  step(['--import', './scripts/bake-loader.mjs', '--input-type=module', '-e',
    "(await import('./scripts/app-build/crossroadsRig.ts')).writeCrossroadsRig(process.argv[1], process.cwd());", outDir]);
  // the service worker over the bundle as written (was vite/pwa-plugin.ts): sw.js and its content-named core
  step(['--import', './scripts/bake-loader.mjs', '--input-type=module', '-e',
    "(await import('./scripts/app-build/serviceWorker.ts')).writeServiceWorker(process.argv[1], process.cwd());", outDir]);
}

// the compiled DEVSERVER mode, as a machine-readable artifact beside the bundle (scripts/check-devserver.mjs, sdk/dev.ts);
// the bundle itself takes it from the __DEVSERVER__ define (was vite/devserver.ts)
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'build-flags.json'), JSON.stringify({ devserver: mode === 'devserver' }));

// the data products beside the app (was vite/outputProducts.ts)
copyOutputProducts(process.cwd(), outDir);
