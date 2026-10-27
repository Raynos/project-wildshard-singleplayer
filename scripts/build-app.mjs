#!/usr/bin/env node
// D24 phase 2 (G799: no Vite plugins): the app build as a plain script. Its own steps run around `vite build` (each
// former Vite plugin is one of them), so every caller builds the app through this file, never a bare `vite build`.
//
//   node scripts/build-app.mjs [vite build arguments…]       e.g. --mode native, --config <file>, --outDir <dir>
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
/** a `--name value` or `--name=value` argument's value */
const option = (name) => {
  const at = args.indexOf(`--${name}`);
  if (at !== -1) return args[at + 1];
  return args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
};
// the folder the config builds into: native mode's own (vite.config.ts), else dist, unless the caller names one
const mode = option('mode') ?? 'production', outDir = resolve(option('outDir') ?? (mode === 'native' ? 'dist-native' : 'dist'));

const vite = resolve(import.meta.dirname, '../node_modules/vite/bin/vite.js');
const build = spawnSync(process.execPath, [vite, 'build', ...args], { stdio: 'inherit' });
if (build.error !== undefined) throw build.error;
if (build.status !== 0) { process.exitCode = build.status ?? 1; process.exit(); }

// the compiled DEVSERVER mode, as a machine-readable artifact beside the bundle (scripts/check-devserver.mjs, sdk/dev.ts);
// the bundle itself takes it from the __DEVSERVER__ define (was vite/devserver.ts)
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'build-flags.json'), JSON.stringify({ devserver: mode === 'devserver' }));
