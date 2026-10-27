#!/usr/bin/env node
// D24 phase 2 (G799: no Vite plugins): the app build as a plain script. Its own steps run around `vite build` (each
// former Vite plugin is one of them), so every caller builds the app through this file, never a bare `vite build`.
//
//   node scripts/build-app.mjs [vite build arguments…]       e.g. --mode native, --config <file>, --outDir <dir>
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkNoTopLevelAwait } from './app-build/noTopLevelAwait.mjs';
import { copyOutputProducts } from './app-build/outputProducts.mjs';

const args = process.argv.slice(2);
/** a `--name value` or `--name=value` argument's value */
const option = (name) => {
  const at = args.indexOf(`--${name}`);
  if (at !== -1) return args[at + 1];
  return args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
};
// the folder the config builds into: native mode's own (vite.config.ts), else dist, unless the caller names one
const mode = option('mode') ?? 'production', outDir = resolve(option('outDir') ?? (mode === 'native' ? 'dist-native' : 'dist'));

/** a node step that must pass (the build stops with its exit code) */
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

const vite = resolve(import.meta.dirname, '../node_modules/vite/bin/vite.js');
const build = spawnSync(process.execPath, [vite, 'build', ...args], { stdio: 'inherit' });
if (build.error !== undefined) throw build.error;
if (build.status !== 0) { process.exitCode = build.status ?? 1; process.exit(); }

// no emitted app JavaScript may suspend its module's evaluation (was vite/noTopLevelAwait.ts); inline workers are iife,
// where the bundler refuses top-level await itself
checkNoTopLevelAwait(outDir, resolve('public'));

// the compiled DEVSERVER mode, as a machine-readable artifact beside the bundle (scripts/check-devserver.mjs, sdk/dev.ts);
// the bundle itself takes it from the __DEVSERVER__ define (was vite/devserver.ts)
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'build-flags.json'), JSON.stringify({ devserver: mode === 'devserver' }));

// the data products beside the app (was vite/outputProducts.ts)
copyOutputProducts(process.cwd(), outDir);
