// oxlint-disable-next-line import/no-nodejs-modules -- Exercise a dropped HTTP body with a real loopback server.
import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { retryProxy, retryChunks } from '../scripts/ios-retry-check.mjs';

describe('iOS dropped-module proxy', () => {
  it('arms cuts after precache, cuts one selected response and forwards the retry completely', async () => {
    const body = 'export const loaded = true;'.repeat(100);
    const origin = createServer((_req, res) => { res.end(body); });
    await new Promise<void>((resolve) => { origin.listen(0, '127.0.0.1', resolve); });
    const address = origin.address();
    if (address === null || typeof address === 'string') throw new Error('Missing fixture port');
    const proxy = await retryProxy(`http://127.0.0.1:${address.port}`, ['/engine.js'], false);
    try {
      expect(await (await fetch(`${proxy.url}engine.js`)).text()).toBe(body);
      proxy.arm();
      const first = await fetch(`${proxy.url}engine.js`);
      await expect(first.text()).rejects.toThrow();
      expect(await (await fetch(`${proxy.url}engine.js`)).text()).toBe(body);
      expect(await (await fetch(`${proxy.url}other.js`)).text()).toBe(body);
      expect(proxy.log.filter((row: { cut?: boolean }) => row.cut === true)).toEqual([{ path: '/engine.js', attempt: 1, cut: true, bytes: body.length }]);
      expect(proxy.log).toContainEqual({ path: '/engine.js', attempt: 2, cut: false, status: 200, bytes: body.length });
    } finally {
      await proxy.close(); origin.closeAllConnections();
      await new Promise<void>((resolve, reject) => { origin.close((error) => { if (error) reject(error); else resolve(); }); });
    }
  });
  it('finds emitted files from exact names or actual module ownership', () => {
    const moduleIds = { 'wrong-three.js': { name: 'three', moduleIds: ['node_modules/navcat/dist/three.js'] }, 'addons.js': { name: 'engine', moduleIds: ['node_modules/three/examples/jsm/loaders/GLTFLoader.js'] }, 'wrong-engine.js': { name: 'engine', moduleIds: ['src/engine/index.ts'] }, 'vendor.js': { name: 'vendor', moduleIds: ['node_modules/three/build/three.module.js'] },
      'main.js': { name: 'main', moduleIds: ['src/engine/core/Game.ts'] },
      'plugin.js': { name: 'plugin', moduleIds: ['src/shards/pine-hollow/plugin.ts'] } };
    expect(retryChunks(moduleIds)).toEqual(['/vendor.js', '/main.js', '/plugin.js']);
    expect(() => retryChunks({})).toThrow('No actual chunk for three');
  });
});
