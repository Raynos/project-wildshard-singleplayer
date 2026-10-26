// oxlint-disable-next-line import/no-nodejs-modules -- Pin the complete predecessor alias/cost/byte inventory.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare every unchanged shipping recipe with its committed bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Observe the existing codec without replacing its behavior.
import { Buffer } from 'node:buffer';
import { expect, test, vi } from 'vitest';
import { Mesh, Texture, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { pineCabinMaterialFiles, pineCabinMaterialGlbs } from '../src/shards/pine-hollow/generators/cabinPropMaterials.mjs';

function materialMesh(node: Object3D): node is Mesh {
  return node instanceof Mesh;
}

function bytes(files: ReturnType<typeof pineCabinMaterialFiles>, path: string): Uint8Array {
  const value = files.outputs[`public${path}`];
  if (value === undefined) throw new Error('Missing material recipe bytes');
  return value;
}

test('the live writer retains all sixteen complete original aliases, costs and files', () => {
  const files = pineCabinMaterialFiles();
  const rows = Object.entries(files.aliases).map(([source, target]) => {
    const wire = bytes(files, target);
    expect(Buffer.from(wire).equals(readFileSync(`public${target}`))).toBe(true);
    return { source, target, bytes: wire.length, sha: createHash('sha256').update(wire).digest('hex') };
  });
  expect(rows).toHaveLength(16);
  expect(rows.reduce((size, row) => size + row.bytes, 0)).toBe(27824);
  expect(createHash('sha256').update(JSON.stringify({ rows, costs: files.costs })).digest('hex'))
    .toBe('680597af0f9d5b4601864897b68998a4dc2a8c34bc9de87340199b980a4e402d');
});

test('binary recipes preserve every material/image/sampler/accessor field and all geometry bytes', () => {
  const before = pineCabinMaterialFiles(), after = pineCabinMaterialGlbs();
  expect(Object.keys(after.aliases)).toEqual(Object.keys(before.aliases));
  for (const [source, target] of Object.entries(after.aliases)) {
    const oldTarget = before.aliases[source];
    if (oldTarget === undefined) throw new Error('Missing predecessor recipe');
    const old = bytes(before, oldTarget), wire = bytes(after, target);
    const view = new DataView(wire.buffer, wire.byteOffset, wire.byteLength);
    expect([view.getUint32(0, true), view.getUint32(4, true), view.getUint32(8, true)])
      .toEqual([0x46546c67, 2, wire.length]);
    const length = view.getUint32(12, true), binary = wire.subarray(28 + length);
    expect(view.getUint32(16, true)).toBe(0x4e4f534a);
    expect([view.getUint32(20 + length, true), view.getUint32(24 + length, true)]).toEqual([96, 0x004e4942]);
    expect(Buffer.from(binary).equals(Buffer.alloc(96))).toBe(true);
    const original: unknown = JSON.parse(new TextDecoder().decode(old));
    if (original === null || typeof original !== 'object') throw new Error('Invalid predecessor recipe');
    const document: unknown = JSON.parse(new TextDecoder().decode(wire.subarray(20, 20 + length)));
    expect(document).toEqual({ ...original, buffers: [{ byteLength: 96 }] });
    expect(target).toBe(`/assets/pine-hollow/baked/cabin-materials/${createHash('sha256').update(wire).digest('hex')}.glb`);
    expect(wire.byteLength).toBeLessThan(old.byteLength);
    expect(after.costs.find(row => row.original === source)).toEqual({
      original: source, before: before.costs.find(row => row.original === source)?.before, after: wire.byteLength,
    });
  }
});

test('the binary producer never invokes the old buffer encoder', () => {
  const encoding = vi.spyOn(Buffer.prototype, 'toString');
  try {
    pineCabinMaterialFiles();
    expect(encoding.mock.calls.filter(call => call[0] === 'base64')).toHaveLength(16);
    encoding.mockClear();
    pineCabinMaterialGlbs();
    expect(encoding.mock.calls.filter(call => call[0] === 'base64')).toHaveLength(0);
  } finally { encoding.mockRestore(); }
});

test('the real GLTF decoder reads all native geometry without an external buffer request', async () => {
  const files = pineCabinMaterialGlbs();
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
