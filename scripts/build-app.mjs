#!/usr/bin/env node
// D24 phase 2 (G799: no Vite plugins): the app build as a plain script. Its own steps run around `vite build` (none yet:
// each Vite plugin moves into one, a commit at a time), so every caller builds the app through this file, never a bare
// `vite build`.
//
//   node scripts/build-app.mjs [vite build arguments…]       e.g. --mode native, --config <file>, --outDir <dir>
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const vite = resolve(import.meta.dirname, '../node_modules/vite/bin/vite.js');
const build = spawnSync(process.execPath, [vite, 'build', ...process.argv.slice(2)], { stdio: 'inherit' });
if (build.error !== undefined) throw build.error;
process.exitCode = build.status ?? 1;
