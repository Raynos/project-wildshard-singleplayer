// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real Vite preview with owned fixture files.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Allocate a disposable preview fixture.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the owned fixture paths.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Link installed packages to the fixture's own tree.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare the decompressed WASM transport byte for byte.
import { Buffer } from 'node:buffer';
import { expect, it } from 'vitest';
import { linkNodeModules } from '../scripts/link-node-modules.mjs';
import { serve } from '../scripts/parity/serve.mjs';

it('serves completed bytes and production headers without importing a generation config', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'parity-built-preview-')));
  let preview: Awaited<ReturnType<typeof serve>> | undefined;
  try {
    mkdirSync(join(root, 'dist'));
    writeFileSync(join(root, 'package.json'), '{"name":"parity-preview-fixture","type":"module"}\n');
    writeFileSync(join(root, 'dist', 'index.html'), '<!doctype html><title>Built fixture</title>');
    const version = '{"build":"exact-built-bytes"}\n';
    writeFileSync(join(root, 'dist', 'version.json'), version);
    writeFileSync(join(root, 'vercel.json'), JSON.stringify({headers:[{source:'/version.json',
      headers:[{key:'Cache-Control', value:'no-store'}]}]}));
    writeFileSync(join(root, 'vite.config.mjs'),
      "import {writeFileSync} from 'node:fs'; writeFileSync('build-config-imported','yes'); throw new Error('Generation config imported during built preview');\n");
    linkNodeModules(process.cwd(), root);
    preview = await serve(root, '', true);
    const response = await fetch(`${preview.url}/version.json`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(version);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await (await fetch(`${preview.url}/`)).text()).toContain('Built fixture');
    const wasm = await fetch(`${preview.url}/assets/physics/rapier.wasm`, {headers:{'accept-encoding':'br'}});
    expect(wasm.headers.get('content-encoding')).toBe('br');
    expect(wasm.headers.get('content-type')).toBe('application/wasm');
    expect(Buffer.from(await wasm.arrayBuffer()).equals(readFileSync(join(process.cwd(), 'public/assets/physics/rapier.wasm')))).toBe(true);
    expect(existsSync(join(root, 'build-config-imported'))).toBe(false);
  } finally { preview?.close(); rmSync(root, {recursive:true, force:true}); }
});
