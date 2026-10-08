#!/usr/bin/env node
// E357 F1: check committed outputs by baking them, including local GPU/encoder outputs where supported.
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve as pathResolve } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { toolVersion } from './bake-output.mjs';

const ROOT = pathResolve(import.meta.dirname, '..');
const nodeOnly = process.argv.includes('--node-only'); // builders queue the GPU/derived batch to the lead
const skipGpu = nodeOnly || process.argv.includes('--skip-gpu');
const state = { failed: false };
const run = (args, command = process.execPath) => {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) state.failed = true;
  return result.status === 0;
};
for (const baker of ['chunk', 'sky', 'navmesh', 'island-cover', 'voxel-ao', 'geometry']) run(['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', `scripts/bake-${baker}.mjs`, '--check']);

const metal = process.platform === 'darwin' && spawnSync('system_profiler', ['SPDisplaysDataType'], { encoding: 'utf8' }).stdout.includes('Metal');
if (!metal) console.log('bake-check: GPU bakers skipped (no Metal): bake-cards, bake-textures');
else if (skipGpu) console.log('bake-check: GPU bakers queued: bake-cards, bake-textures');
else if (!state.failed) {
  const scratch = mkdtempSync(join(tmpdir(), 'bake-check-'));
  let preview;
  try {
    const out = join(scratch, 'dist');
    if (run(['scripts/heavy-lane.py', 'build', '--', 'pnpm', 'exec', 'vite', 'build', '--outDir', out], 'python3')) {
      const server = createServer();
      server.listen(0, '127.0.0.1'); await once(server, 'listening');
      const address = server.address();
      if (address === null || typeof address === 'string') throw new Error('bake-check: no preview port');
      const port = address.port;
      await new Promise((resolve, reject) => { server.close((error) => { if (error) reject(error); else resolve(); }); });
      // Avoid loading vite.config.ts again: it runs the node bakers and writes generated tables.
      const config = join(scratch, 'preview.mjs');
      writeFileSync(config, 'export default {};\n');
      preview = spawn('pnpm', ['exec', 'vite', 'preview', '--config', config, '--outDir', out, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore', detached: true });
      const url = `http://127.0.0.1:${port}`;
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        try { const response = await fetch(url); if (response.ok) { ready = true; break; } } catch { /* preview is starting */ }
        await delay(100);
      }
      if (!ready) throw new Error('bake-check: preview did not start');
      const base = join(ROOT, 'public/assets/baked');
      for (const slug of readdirSync(base).sort()) for (const kind of ['cards', 'textures']) {
        if (existsSync(join(base, slug, `${kind}.json`))) run(['scripts/browser-lane.sh', '--max', '4', process.execPath, `scripts/bake-${kind}.mjs`, '--check', '--url', url, '--chunk', slug], 'bash');
      }
    }
  } finally {
    if (preview?.pid) { try { process.kill(-preview.pid, 'SIGTERM'); } catch { /* exited already */ } }
    rmSync(scratch, { recursive: true, force: true });
  }
}
if (nodeOnly) console.log('bake-check: derived copies queued (--node-only): tex-tiers, bake-ktx2');
else {
  if (toolVersion('magick', ['-version']) && toolVersion('cwebp', ['-version'])) run(['scripts/tex-tiers.mjs', '--check']);
  else console.log('bake-check: phone copies skipped (no magick/cwebp): tex-tiers');
  if (toolVersion('magick', ['-version']) && toolVersion('basisu', ['-version'])) run(['--import', './scripts/bake-loader.mjs', 'scripts/bake-ktx2.mjs', '--check']);
  else console.log('bake-check: KTX2 copies skipped (no magick/basisu): bake-ktx2');
}
if (state.failed) {
  const playwright = JSON.parse(readFileSync(join(ROOT, 'node_modules/playwright/package.json'), 'utf8'));
  console.log(`bake-check: tools node ${process.version}; playwright ${playwright.version}; ${['magick', 'cwebp', 'basisu'].map((command) => `${command} ${toolVersion(command, ['-version']) ?? 'unavailable'}`).join('; ')}`);
  process.exitCode = 1;
}
