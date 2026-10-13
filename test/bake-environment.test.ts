// oxlint-disable-next-line import/no-nodejs-modules -- An isolated filesystem fixture exercises verified product reads.
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the test runner temporary root, cleaned in finally.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine the test transport to its owned public folder.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare the host bytes against an independently computed digest.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The owned bake adapter reads the repository's committed assets.
import { cwd } from 'node:process';
import { expect, it, vi } from 'vitest';
import { installBakeEnvironment } from '../scripts/bake/environment.mjs';
import { browserShardfileOptions } from '../src/game/plugin/ui';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { emptyShardfile } from '../src/sdk/author';

it('installs the existing non-drawing bake DOM and local fetch only for its owned lifetime', async () => {
  const documentBefore = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const external = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('external'));
  const environment = installBakeEnvironment(cwd());
  try {
    expect(() => installBakeEnvironment(cwd())).toThrow('already installed');
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
    if (context === null) throw new Error('Missing bake canvas context');
    expect(context.createImageData(3, 2).data).toHaveLength(24);
    const image = document.createElement('img'); let loaded = false;
    image.addEventListener('load', () => { loaded = true; }); image.src = '/image-not-drawn.png';
    await Promise.resolve(); expect(loaded).toBe(true);
    const response = await fetch(new Request('/assets/baked/pine-hollow/terrain.bin'));
    expect(response.ok).toBe(true);
    expect([...new Uint8Array(await response.arrayBuffer()).subarray(0, 4)]).toEqual([87, 83, 84, 82]);
    expect((await fetch('/missing-bake-file')).status).toBe(404);
    expect(await (await fetch('https://example.invalid/asset')).text()).toBe('external');
    expect(external).toHaveBeenCalledTimes(1);
  } finally { environment.dispose(); environment.dispose(); external.mockRestore(); }
  expect(Object.getOwnPropertyDescriptor(globalThis, 'document')).toEqual(documentBefore);
});

it('keeps offline refusal and verifies filesystem transport size and hash', async () => {
  const root = mkdtempSync(join(tmpdir(), 'bake-product-')), bytes = new Uint8Array([91, 49, 93]);
  const hash = createHash('sha256').update(bytes).digest('hex'), directory = join(root, 'public', 'shardfiles', 'fixture');
  mkdirSync(directory, { recursive: true }); const file = join(directory, hash); writeFileSync(file, bytes);
  const source = { ...emptyShardfile({ slug: 'fixture', name: 'Fixture', author: 'test', revision: 1, seed: 0 }),
    files: [{ hash, kind: 'json' as const, compressed: bytes.length, decoded: bytes.length, gpu: 0, draws: 0, triangles: 0, dependencies: [], critical: false }] };
  const environment = installBakeEnvironment(root);
  try {
    expect(navigator.onLine).toBe(true);
    const options = browserShardfileOptions('http://localhost/shardfiles/fixture/');
    const reader = new ClientAssets(source, new Map(), options);
    await expect(reader.read(hash)).resolves.toEqual(bytes);
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    await expect(new ClientAssets(source, new Map(), browserShardfileOptions(options.base)).read(hash)).rejects.toThrow('Missing cached resident tile');
    writeFileSync(file, new Uint8Array([91, 50, 93]));
    await expect(reader.read(hash)).rejects.toThrow('hash or size mismatch');
    writeFileSync(file, new Uint8Array([91]));
    await expect(reader.read(hash)).rejects.toThrow('hash or size mismatch');
  } finally { environment.dispose(); rmSync(root, { recursive: true, force: true }); }
});
