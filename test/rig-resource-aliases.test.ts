import { DefaultLoadingManager } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, expect, it, vi } from 'vitest';
import { loadRigFile } from '@wildshard/engine/anim/rig';

afterEach(() => { DefaultLoadingManager.setURLModifier(undefined); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('keeps default tier routing for aliases and isolates each file from the shared loader', async () => {
  vi.stubGlobal('location', { href: 'https://game.example/play/' });
  DefaultLoadingManager.setURLModifier(path => `https://game.example${path}?tier=phone`);
  const file = await new GLTFLoader().parseAsync(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }], nodes: [] }), '');
  const reads: { shared: boolean; image: string; ordinary: string }[] = [];
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(function loadFixture(this: GLTFLoader) {
    reads.push({ shared: this.manager === DefaultLoadingManager,
      image: this.manager.resolveURL('/assets/scan/wood.png'), ordinary: this.manager.resolveURL('/assets/scan/metal.png') });
    return Promise.resolve(file);
  });
  await loadRigFile('/first.glb');
  await loadRigFile('/second.gltf', { '/assets/scan/wood.png': '/assets/packed/wood.webp' });
  await loadRigFile('/third.glb');
  expect(reads.map(row => row.shared)).toEqual([true, false, true]);
  expect(reads.map(row => row.image)).toEqual(['https://game.example/assets/scan/wood.png?tier=phone',
    'https://game.example/assets/packed/wood.webp?tier=phone', 'https://game.example/assets/scan/wood.png?tier=phone']);
  expect(reads.every(row => row.ordinary === 'https://game.example/assets/scan/metal.png?tier=phone')).toBe(true);
});
