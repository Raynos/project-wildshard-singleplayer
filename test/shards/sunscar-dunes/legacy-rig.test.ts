// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real frozen rig bytes through the shipping GLTF loader.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Pin the restored historical asset independently of its URL.
import { createHash } from 'node:crypto';
import { FileLoader } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { expect, it, vi } from 'vitest';
import { bootFiles, duneRigUrl } from '../../../src/shards/sunscar-dunes-legacy/boot/files';
import { duneRig, preloadDuneMeshes } from '../../../src/shards/sunscar-dunes-legacy/world/meshes';

it('boots the legacy skitterer from its original custom skin channels without replacing the primary rig', async () => {
  const url = duneRigUrl('skitterer'), original = readFileSync(`public${url}`);
  expect(createHash('sha256').update(original).digest('hex')).toBe('4671fc2fb52c5df9b5fe22de63c13d51471588fa9b101e950bf0330dcc1f27a7');
  expect(url).toBe('/assets/sunscar-dunes-legacy/rigs/skitterer.glb');
  expect(bootFiles()).toContain(url);
  expect(bootFiles()).not.toContain('/assets/sunscar-dunes/rigs/skitterer.glb');
  const parser = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const loaded = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(path => {
    const bytes = readFileSync(`public${path}`);
    return parser.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  });
  const files = vi.spyOn(FileLoader.prototype, 'loadAsync').mockImplementation(path => {
    const bytes = readFileSync(`public${path}`);
    return Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  });
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    await preloadDuneMeshes();
    // Textured hero models need browser image APIs; this renderer-free proof exercises the frozen rig intake.
    expect(errors.mock.calls.filter(([message]) => String(message).includes('baked rig'))).toEqual([]);
    const geometry = duneRig('skitterer');
    if (geometry === null) throw new Error('Frozen skitterer did not load');
    expect(geometry.getAttribute('skinIndex').count).toBe(geometry.getAttribute('position').count);
    expect(geometry.getAttribute('skinWeight').count).toBe(geometry.getAttribute('position').count);
    expect(geometry.getAttribute('normal').count).toBe(geometry.getAttribute('position').count);
    geometry.dispose();
  } finally { loaded.mockRestore(); files.mockRestore(); errors.mockRestore(); }
});
