// oxlint-disable-next-line import/no-nodejs-modules -- The preview fixture writes and removes only its owned ./tmp directory.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Paths for the owned static HTTP fixture.
import { dirname, join, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { preview } from 'vite';
import { previewHeadersPlugin } from '../vite/preview';

// iPhone downloads I6: a product blob is content-addressed (`blobs/<kind>/<hash>.<ext>`), so it never revalidates;
// sections keep fixed paths and Rapier keeps its fixed name (the boot lists name it), so both revalidate.
test('product blobs are immutable; sections and Rapier revalidate', async () => {
  mkdirSync(resolve('tmp'), { recursive: true });
  const root = mkdtempSync(resolve('tmp/vercel-headers-'));
  writeFileSync(join(root, 'vercel.json'), readFileSync('vercel.json'));
  const hash = 'a'.repeat(64), files = [`shardfiles/driftwood-isle/blobs/glb/${hash}.glb`,
    'shardfiles/driftwood-isle/sections/world/tiles.json', 'shardfiles/driftwood-isle/shard.json', 'assets/physics/rapier.wasm'];
  for (const file of files) { mkdirSync(dirname(join(root, 'dist', file)), { recursive: true }); writeFileSync(join(root, 'dist', file), 'x'); }
  const server = await preview({ root, configFile: false, logLevel: 'silent',
    plugins: [previewHeadersPlugin()], preview: { host: '127.0.0.1', port: 0 }, build: { outDir: 'dist' } });
  try {
    const base = server.resolvedUrls?.local[0];
    if (base === undefined) throw new Error('Preview did not bind its fixture');
    const control = await Promise.all(files.map(async file => (await fetch(new URL(file, base))).headers.get('cache-control')));
    expect(control).toEqual(['public, max-age=31536000, immutable', 'public, max-age=0, must-revalidate',
      'public, max-age=0, must-revalidate', 'public, max-age=0, must-revalidate']);
  } finally {
    await server.close(); rmSync(root, { recursive: true, force: true });
  }
}, 20_000);
