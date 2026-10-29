// Native IndexedDB controls: scripts/browser-lane.sh node scripts/test-home-build-cache.mjs
// This bundles one test fixture, not an app or product, and removes its own output on every exit.
import { build } from 'vite';
import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, webkit, devices } from 'playwright';

const directory = resolve(`tmp/home-build-cache-${process.pid}`);
try {
  await build({ configFile: false, logLevel: 'error', define: { __BUILD_ID__: 'globalThis.__homeProofBuild' },
    build: { outDir: directory, emptyOutDir: true, lib: { entry: 'test/fixtures/home-build-cache-browser.ts',
      name: 'NativeHomeCacheProof', formats: ['iife'], fileName: () => 'proof.js' } } });
  const code = await readFile(`${directory}/proof.js`, 'utf8');
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch({ headless: true, args: name === 'chromium' ? ['--mute-audio'] : [] });
    try {
      const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
      await context.route('**/home-cache-proof', route => route.fulfill({ contentType: 'text/html',
        body: '<!doctype html><title>Native cache proof</title>' }));
      const page = await context.newPage();
      await page.goto('http://127.0.0.1/home-cache-proof');
      await page.addScriptTag({ content: code });
      const result = await page.evaluate(async () => {
        const target = Reflect.get(window, 'NativeHomeCacheProof');
        const run = typeof target === 'object' && target !== null ? Reflect.get(target, 'proof') : undefined;
        if (typeof run !== 'function') throw new Error('Missing native cache fixture');
        return await Reflect.apply(run, target, []);
      });
      console.log(name, result);
      await context.close();
    } finally { await browser.close(); }
  }
} finally { await rm(directory, { recursive: true, force: true }); }
