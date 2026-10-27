// oxlint-disable-next-line import/no-nodejs-modules -- Pin the complete predecessor alias/cost/byte inventory.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare every unchanged shipping recipe with its committed bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Observe the existing codec without replacing its behavior.
import { Buffer } from 'node:buffer';
import { expect, test, vi } from 'vitest';
import { Mesh, Texture, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { pineCabinMaterialFiles } from '../src/shards/pine-hollow/generators/cabinPropMaterials.mjs';
import { PINE_SOURCES } from './fixtures/pine-sources';

function materialMesh(node: Object3D): node is Mesh {
  return node instanceof Mesh;
}

function bytes(files: ReturnType<typeof pineCabinMaterialFiles>, path: string): Uint8Array {
  const value = files.outputs[`public${path}`];
  if (value === undefined) throw new Error('Missing material recipe bytes');
  return value;
}

test('the registered writer publishes all sixteen exact native recipes', () => {
  const files = pineCabinMaterialFiles(PINE_SOURCES);
  expect(Object.keys(files.aliases)).toHaveLength(16);
  expect(Object.values(files.outputs).reduce((size, row) => size + row.length, 0)).toBe(27048);
  for (const target of Object.values(files.aliases)) {
    const wire = bytes(files, target);
    expect(Buffer.from(wire).equals(readFileSync(`public${target}`))).toBe(true);
    expect(target).toBe(`/assets/pine-hollow/baked/cabin-materials/${createHash('sha256').update(wire).digest('hex')}.glb`);
  }
  const metadata: unknown = JSON.parse(readFileSync('src/shards/pine-hollow/data/timberWorld.generated.json', 'utf8'));
  if (metadata === null || typeof metadata !== 'object' || !('propMaterials' in metadata) || !('propMaterialCosts' in metadata))
    throw new Error('Missing registered material metadata');
  expect(metadata.propMaterials).toMatchObject(files.aliases);
  expect(metadata.propMaterialCosts).toEqual(expect.arrayContaining([...files.costs]));
});

test('every original material/image/sampler/accessor field and geometry byte stays exact', () => {
  const files = pineCabinMaterialFiles(PINE_SOURCES);
  const documents = Object.entries(files.aliases).map(([source, target]) => {
    const wire = bytes(files, target), view = new DataView(wire.buffer, wire.byteOffset, wire.byteLength);
    expect([view.getUint32(0, true), view.getUint32(4, true), view.getUint32(8, true)])
      .toEqual([0x46546c67, 2, wire.length]);
    const length = view.getUint32(12, true);
    expect(view.getUint32(16, true)).toBe(0x4e4f534a);
    expect([view.getUint32(20 + length, true), view.getUint32(24 + length, true)]).toEqual([96, 0x004e4942]);
    expect(Buffer.from(wire.subarray(28 + length)).equals(Buffer.alloc(96))).toBe(true);
    const document: unknown = JSON.parse(new TextDecoder().decode(wire.subarray(20, 20 + length)));
    return { source, document };
  });
  // Recorded from every predecessor glTF, removing only its buffer URI.
  expect(createHash('sha256').update(JSON.stringify(documents)).digest('hex'))
    .toBe('f213e25a223e214c58b3b6fc5c51232e576f7e76356d8158f892c5194a52c4b6');
  expect(createHash('sha256').update(JSON.stringify(files.costs.map(({ original, before }) => ({ original, before })))).digest('hex'))
    .toBe('ad04dfe3b8a81103e8c5570906f0f2bad7c618c113c190abf40eb8fe23777e72');
});

test('the producer never invokes a buffer encoder', () => {
  const encoding = vi.spyOn(Buffer.prototype, 'toString');
  try {
    pineCabinMaterialFiles(PINE_SOURCES);
    expect(encoding.mock.calls.filter(call => call[0] === 'base64')).toHaveLength(0);
  } finally { encoding.mockRestore(); }
});

test('the real GLTF decoder reads all native geometry without an external buffer request', async () => {
  const files = pineCabinMaterialFiles(PINE_SOURCES);
  for (const wire of Object.values(files.outputs)) {
    // Image identities are checked byte-for-byte above. Borrow inert textures
    // here to exercise the actual binary/attribute parser without a DOM decoder.
    const textures: Texture[] = [];
    const loader = new GLTFLoader().register(() => ({
      name: 'KHR_texture_basisu',
      loadTexture: () => { const texture = new Texture(); textures.push(texture); return Promise.resolve(texture); },
    }));
    const decoded = await loader.parseAsync(Uint8Array.from(wire).buffer, '');
    let meshes = 0;
    try {
      decoded.scene.traverse(node => {
        if (!materialMesh(node)) return;
        meshes++;
        for (const name of ['position', 'normal', 'uv']) {
          const attribute = node.geometry.getAttribute(name);
          expect(attribute.count).toBe(3);
          expect(attribute.itemSize).toBe(name === 'uv' ? 2 : 3);
          expect([...attribute.array].every(value => value === 0)).toBe(true);
        }
        expect(node.geometry.index).toBeNull();
      });
      expect(meshes).toBe(1);
    } finally {
      decoded.scene.traverse(node => {
        if (!materialMesh(node)) return;
        node.geometry.dispose();
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
      });
      for (const texture of textures) texture.dispose();
    }
  }
});
