import { BufferAttribute, BufferGeometry, DataTexture, Group, InstancedMesh, Line, MeshBasicMaterial, LineBasicMaterial, Points, PointsMaterial } from 'three';
import { afterEach, expect, it } from 'vitest';
import { labelAsset, labelClone, labelledCreation, labelObjectTree } from '../../src/engine/render/gpuLabels';

const originalWindow: unknown = Reflect.get(globalThis, 'window');
afterEach(() => { Reflect.set(globalThis, 'window', originalWindow); });
it('labels actual geometry, instance and texture upload sources with their file or registered piece identity', () => {
  const sources = new Map<object, { owner: string; asset: string }>(), identities = new Map<object, object>();
  Reflect.set(globalThis, 'window', {
    __sc_label_gl: () => undefined,
    __sc_label_source: (source: object, owner: string, asset: string, identity?: object) => { sources.set(source, { owner, asset }); if (identity !== undefined) identities.set(source, identity); },
  });
  const positions = new Float32Array(9), pixels = new Uint8Array(16);
  const geometry = labelAsset(new BufferGeometry().setAttribute('position', new BufferAttribute(positions, 3)), 'file-loader', '/assets/tree.glb#trunk');
  const texture = labelAsset(new DataTexture(pixels, 2, 2), 'texture-loader', '/assets/bark.ktx2');
  const mesh = new InstancedMesh(geometry, new MeshBasicMaterial({ map: texture }), 2);
  mesh.name = 'trees';
  const root = new Group(); root.add(mesh);
  labelObjectTree(root, 'pine/tree-stand', 'forest.ts#Tree stand');
  expect(identities.get(positions)).toBe(geometry.getAttribute('position'));
  expect(sources.get(positions)).toEqual({ owner: 'file-loader', asset: '/assets/tree.glb#trunk/position' });
  expect(sources.get(pixels)).toEqual({ owner: 'texture-loader', asset: '/assets/bark.ktx2' });
  expect(sources.get(mesh.instanceMatrix.array)).toEqual({ owner: 'pine/tree-stand', asset: 'forest.ts#Tree stand/trees/instanceMatrix' });
});
it('includes line uploads and keeps embedded texture names within their GLB path', () => {
  const sources = new Map<object, string>();
  Reflect.set(globalThis, 'window', { __sc_label_gl: () => undefined,
    __sc_label_source: (source: object, _owner: string, asset: string) => { sources.set(source, asset); } });
  const pixels = new Uint8Array(16), positions = new Float32Array(6);
  const texture = new DataTexture(pixels, 2, 2); texture.name = 'Image_0';
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(positions, 3));
  const line = new Line(geometry, new LineBasicMaterial()); line.name = 'line';
  const points = new Points(new BufferGeometry(), new PointsMaterial({ map: texture })); points.name = 'points';
  const root = new Group(); root.add(line, points);
  labelObjectTree(root, 'file-loader', '/assets/animal.glb');
  expect(sources.get(positions)).toBe('/assets/animal.glb/line/position');
  expect(sources.get(pixels)).toBe('/assets/animal.glb/points/map/Image_0');
});
it('normal gameplay does not inspect a registered tree or wrap its creation', () => {
  Reflect.set(globalThis, 'window', {});
  const root = new Group();
  Object.defineProperty(root, 'children', { get: () => { throw new Error('Unexpected census walk'); } });
  labelObjectTree(root, 'piece', 'world.ts');
  const object = {};
  expect(labelAsset(object, 'piece', 'world.ts')).toBe(object);
  expect(labelledCreation('piece', 'world.ts', () => object)).toBe(object);
});
it('preserves a resolved texture URL through cloning and attributes bone uploads to their model', () => {
  const sources = new Map<object, string>();
  Reflect.set(globalThis, 'window', { __sc_label_gl: () => undefined,
    __sc_label_source: (source: object, _owner: string, asset: string) => { sources.set(source, asset); } });
  const pixels = new Uint8Array(16), bones = new Float32Array(16);
  const source = labelAsset(new DataTexture(pixels, 2, 2), 'texture-loader', '/assets/sky.astc.ktx2');
  const clone = labelClone(source.clone(), source, 'baked-loader', '/assets/sky.jpg');
  const ordinaryClone = source.clone();
  const geo = labelAsset(new BufferGeometry(), 'file-loader', '/assets/horse.glb#body');
  const root = new Group();
  Object.assign(root, { geometry: geo, material: new MeshBasicMaterial({ map: clone }), skeleton: { boneTexture: new DataTexture(bones, 2, 2) } });
  labelObjectTree(root, 'piece', 'horse.ts');
  const ordinaryRoot = new Group(); Object.assign(ordinaryRoot, { material: new MeshBasicMaterial({ map: ordinaryClone }) });
  labelObjectTree(ordinaryRoot, 'piece', 'ordinary-clone.ts');
  expect(sources.get(pixels)).toBe('/assets/sky.astc.ktx2');
  expect(sources.get(bones)).toBe('/assets/horse.glb#body/skeleton/bones');
});
it('a repeated census walk keeps every label and emits nothing new until a source changes (SF57)', () => {
  const emitted: { source: object; owner: string; asset: string }[] = [];
  Reflect.set(globalThis, 'window', { __sc_label_gl: () => undefined,
    __sc_label_source: (source: object, owner: string, asset: string) => { emitted.push({ source, owner, asset }); } });
  const positions = new Float32Array(9), pixels = new Uint8Array(16), shared = new ArrayBuffer(64);
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(positions, 3)).setAttribute('uv', new BufferAttribute(new Float32Array(shared, 0, 6), 2));
  const texture = new DataTexture(pixels, 2, 2); texture.name = 'Image_0';
  const mesh = new InstancedMesh(geometry, new MeshBasicMaterial({ map: texture }), 2); mesh.name = 'trees';
  const root = new Group(); root.add(mesh);
  labelObjectTree(root, 'pine/tree-stand', 'forest.ts');
  const first = emitted.map((row) => `${row.owner} ${row.asset}`).sort();
  expect(first).toContain('pine/tree-stand forest.ts/trees/position');
  expect(first).toContain('pine/tree-stand forest.ts/trees/map/Image_0');
  expect(first).toContain('pine/tree-stand forest.ts/trees/instanceMatrix');
  emitted.length = 0;
  for (let walk = 0; walk < 5; walk++) labelObjectTree(root, 'pine/tree-stand', 'forest.ts');
  expect(emitted).toEqual([]);
  // A new attribute is labelled on the next walk, with the same path the first walk would have given it.
  const normals = new Float32Array(9);
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  labelObjectTree(root, 'pine/tree-stand', 'forest.ts');
  expect(emitted.map((row) => [row.source, row.asset])).toEqual([[normals, 'forest.ts/trees/normal']]);
});
