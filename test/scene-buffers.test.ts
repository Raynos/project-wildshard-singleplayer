// oxlint-disable-next-line import/no-nodejs-modules -- Native byte comparison checks complete geometry storage without per-element assertion overhead.
import { Buffer } from 'node:buffer';
// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { unzlibSync } from 'fflate';
import { BufferAttribute, BufferGeometry, Group, Matrix4, InstancedBufferGeometry, InterleavedBufferAttribute, LOD, Mesh, MeshBasicMaterial, Points, ShaderMaterial, Vector3, type Object3D } from 'three';
import { Scope } from '../src/engine/app/scope';
import { parseSceneBuffers } from '../src/format/sceneBuffers';
import { admitSceneBuffers, createSceneBuffers } from '../src/game/shardfile/sceneBuffers';
import { skyMeadowScene } from '../src/shards/far-reach/generators/meadowScene';
import { bakeMeadowBlades } from '../src/shards/far-reach/generators/meadowBlades';
import { signalEmberBuffer, SIGNAL_EMBER_BLOBS } from '../src/shards/sunscar-dunes/generators/emberBuffers';
import { meadow } from './fixtures/sky-meadow-native';
import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';
import { skyIsleProps } from '../src/shards/far-reach/generators/isleProps';
import { SKY_ISLAND_BLOBS, SKY_ISLAND_LIBRARY, SKY_ISLE_TILES } from '../src/shards/far-reach/generators/islandScenes';
import { scenePartSpecimen } from '../src/game/models/scenePartSpecimen';
import { drawSceneRows } from '../src/game/shardfile/sceneDraws';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { emitNamedBlobs, nameBlob } from '../src/sdk/blobs';
import { parseWorldScenes } from '../src/format/worldScenes';
import { parseWorldScene } from '../src/format/clientChannels';
import { bindWorldSceneParts, createWorldScene } from '../src/game/plugin/ui';
import { SKY_SCENE_BLOBS, SKY_WORLD_SCENES } from '../src/shards/far-reach/generators/worldScenes';

const plumbing = (blades: number) => ({ namespace: 'far', input: [], debug: [], knobs: [{ id: 'far.meadowBlades' as const, phone: blades, desktop: blades }] });
const raw = (attribute: BufferAttribute | InterleavedBufferAttribute): Uint8Array => {
  const array = attribute.array; return new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
};
const mesh3 = (node: Object3D): node is Mesh => node instanceof Mesh;
const points3 = (node: Object3D | undefined): node is Points => node instanceof Points;
const drawMeshes = (root: Object3D): Mesh[] => { const result: Mesh[] = []; root.traverse(node => { if (mesh3(node)) result.push(node); }); return result; };

test('Sky native meadow retains every byte, shared attribute, count, LOD and transform', () => {
  const row = skyMeadowScene(), bytes = unzlibSync(bakeMeadowBlades()), material = new MeshBasicMaterial();
  for (const blades of [1600, 3199, 3200, 4000]) {
    const scope = new Scope('buffer-parity'), native = meadow(bytes, material, blades), candidate = createSceneBuffers(row, material, scope, plumbing(blades));
    try {
      expect(candidate.name).toBe(native.group.name); expect(candidate.children.length).toBe(native.group.children.length);
      const originals = drawMeshes(native.group), copies = drawMeshes(candidate);
      expect(copies.length).toBe(originals.length);
      const sharing = new Map<object, object>();
      for (const [index, original] of originals.entries()) {
        const copy = copies[index]; if (copy === undefined) throw new Error('Missing meadow draw');
        expect(copy.geometry).toBeInstanceOf(InstancedBufferGeometry);
        if (!(copy.geometry instanceof InstancedBufferGeometry) || !(original.geometry instanceof InstancedBufferGeometry)) throw new Error('Missing native instance geometry');
        expect(copy.geometry.instanceCount).toBe(original.geometry.instanceCount);
        expect(copy.position.toArray()).toEqual(original.position.toArray());
        expect(copy.geometry.boundingSphere).toEqual(original.geometry.boundingSphere);
        expect(Buffer.compare(raw(copy.geometry.index ?? new BufferAttribute(new Uint8Array(), 1)), raw(original.geometry.index ?? new BufferAttribute(new Uint8Array(), 1)))).toBe(0);
        for (const name of Object.keys(original.geometry.attributes)) {
          const a = original.geometry.getAttribute(name), b = copy.geometry.getAttribute(name);
          expect(b.constructor).toBe(a.constructor); expect(b.itemSize).toBe(a.itemSize); expect(b.normalized).toBe(a.normalized); expect(Buffer.compare(raw(b), raw(a))).toBe(0);
          const source = a instanceof InterleavedBufferAttribute ? a.data : a, target = b instanceof InterleavedBufferAttribute ? b.data : b;
          if (sharing.has(source)) expect(target).toBe(sharing.get(source)); else sharing.set(source, target);
          if (a instanceof InterleavedBufferAttribute && b instanceof InterleavedBufferAttribute) { expect(b.offset).toBe(a.offset); expect(b.data.stride).toBe(a.data.stride); }
        }
      }
      for (const [index, original] of native.group.children.entries()) {
        const copy = candidate.children[index]; if (!(copy instanceof LOD) || !(original instanceof LOD)) throw new Error('Missing native LOD');
        expect(copy.position.toArray()).toEqual(original.position.toArray()); expect(copy.levels.map(level => level.distance)).toEqual(original.levels.map(level => level.distance));
        for (const distance of [0, 13.99, 14, 30.99, 31, 40]) {
          const a = copy.getObjectForDistance(distance), b = original.getObjectForDistance(distance);
          if (a === null || b === null) throw new Error('Missing native LOD band');
          expect(a.type).toBe(b.type);
        }
      }
    } finally { scope.dispose(); native.dispose(); }
  }
  material.dispose();
});

test('Signal current ember Points retain native golden-ratio float32 bytes and disposal', () => {
  const file = signalEmberBuffer(260, 'fire.embers'), blob = SIGNAL_EMBER_BLOBS.find(value => value.file.name === file);
  if (blob === undefined) throw new Error('Missing ember data');
  const scope = new Scope('ember-buffer'), material = new MeshBasicMaterial();
  const group = createSceneBuffers(JSON.parse(new TextDecoder().decode(blob.bytes)), material, scope);
  const points = group.children[0]; if (!points3(points)) throw new Error('Missing current ember Points');
  const index = new Float32Array(260), seed = new Float32Array(260);
  for (let i = 0; i < 260; i++) { index[i] = i; seed[i] = (i * 0.618034) % 1; }
  expect(points.name).toBe('fire.embers'); expect(points.frustumCulled).toBe(false);
  expect(points.geometry.getAttribute('aIndex').array).toEqual(index); expect(points.geometry.getAttribute('aSeed').array).toEqual(seed);
  expect(points.geometry.getAttribute('position').array).toEqual(new Float32Array(780));
  const dispose = vi.spyOn(points.geometry, 'dispose'); scope.dispose(); expect(dispose).toHaveBeenCalledTimes(1); material.dispose();
});

test('Sky moving islets publish the original painted mesh identities for motion', () => {
  const step = SKY_WORLD_SCENES.steps.find(row => row.id === 'moving-islets');
  const blob = SKY_SCENE_BLOBS.find(row => row.file.name === step?.scene);
  if (step === undefined || blob === undefined) throw new Error('Missing actual moving-islet scene');
  const recipe = parseWorldScene(JSON.parse(new TextDecoder().decode(blob.bytes)));
  const geometry = new BufferGeometry(), paint = new ShaderMaterial();
  const ports = new Map(recipe.scene.materials.flatMap(row => row.kind === 'port' ? [[row.source, paint] as const] : []));
  const made = createWorldScene(recipe, { geometry: () => geometry, materials: ports,
    model: () => { throw new Error('Unexpected islet model import'); }, baked: () => { throw new Error('Unexpected islet bake import'); } });
  try {
    const kinds = Object.fromEntries(Object.entries(step.publish).map(([id, row]) => [id, row.kind]));
    const bound = bindWorldSceneParts(made, kinds, step.publish);
    const painted = recipe.scene.nodes.filter(row => row.kind === 'mesh' && row.material === 'isle-paint');
    expect(painted).toHaveLength(4);
    for (const row of painted) {
      const original = made.parts.get(row.id);
      expect(original).toBeInstanceOf(Mesh);
      expect(bound[row.id]).toBe(original);
    }
  } finally { made.dispose(); paint.dispose(); geometry.dispose(); }
});

test('cold Explorer preparation admits buffered effects and refuses missing files', async () => {
  const file = signalEmberBuffer(260, 'fire.embers'), blob = SIGNAL_EMBER_BLOBS.find(value => value.file.name === file);
  if (blob === undefined) throw new Error('Missing ember source');
  const recipe = { scene: { version: 1, root: 'root', nodes: [{ id: 'root', kind: 'group', children: [] }], materials: [] }, imports: [] };
  const scenes = parseWorldScenes({ version: 1, libraries: [], materials: [], steps: [{ id: 'fire', scene: 'scene.json' }] });
  const product = (include: boolean) => {
    const data = emitNamedBlobs([nameBlob('scene.json', 'json', new TextEncoder().encode(JSON.stringify(recipe))), ...(include ? [blob] : [])]);
    return createShardProduct({ slug: 'fixture-cold-effects', revision: 1,
      shardfile: emptyShardfile({ slug: 'fixture-cold-effects', name: 'Cold effects', author: 'Fixture', revision: 1, seed: 1 }),
      sections: new Map([['world/scenes', scenes]]),
      files: new Map(data.files.flatMap(row => row.name === undefined ? [] : [[row.name, { hash: row.hash, url: row.hash }]])),
      read: hash => { const bytes = data.assets.get(hash); if (bytes === undefined) throw new Error('Missing fixture bytes'); return Promise.resolve(bytes); } });
  };
  const draws = [{ kind: 'buffered' as const, file, material: 'paint', scale: 1, y: 0 }];
  const row = { part: 'fire.root', step: 'fire', definition: { model: { id: 'fixture/fire', name: 'Fire', file: 'scene.json', category: 'props' as const, pipeline: 'code' as const }, builder: 'fire' }, effects: [{ part: 'root', draws }] };
  const admitted = product(true), model = scenePartSpecimen(admitted, row);
  await model.prepare?.();
  const scope = new Scope('cold-effects'), root = new Group(), material = new MeshBasicMaterial();
  try { drawSceneRows(admitted, draws, root, scope, new Map([['paint', material]])); expect(root.children[0]?.children[0]).toBeInstanceOf(Points); }
  finally { scope.dispose(); material.dispose(); }
  await expect(scenePartSpecimen(product(false), row).prepare?.()).rejects.toThrow('Missing scene draw buffer file');
});

test('static islands draw from their baked props tiles in their own frame; only the islets stay owned GLBs', async () => {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const native = skyIsleProps(), nodes = new Map<string, { files: string[]; mesh: Mesh }>();
  for (const row of native.props.tiles) {
    const bytes = native.assets.get(row.file); if (bytes === undefined) throw new Error('Missing original island tile');
    const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
    gltf.scene.traverse(node => { if (!mesh3(node)) return; const id = v.parse(v.object({ id: v.string() }), node.userData['wholePartition']).id;
      const known = nodes.get(id); if (known === undefined) nodes.set(id, { files: [row.file], mesh: node }); else known.files.push(row.file); });
  }
  try {
    expect(nodes.size).toBe(12); expect(SKY_ISLE_TILES.models).toHaveLength(12);
    for (const model of SKY_ISLE_TILES.models) {
      const node = nodes.get(model.part); if (node === undefined) throw new Error(`Missing baked island ${model.part}`);
      for (const file of node.files) expect(model.files).toContain(file);
      expect(model.matrix.slice(12, 15)).toEqual(new Matrix4().fromArray(v.parse(v.array(v.number()), node.mesh.userData['matrix64'])).elements.slice(12, 15).map(value => 0 - value));
      expect(SKY_ISLAND_LIBRARY.models.some(row => row.id === model.id)).toBe(false);
    }
    const fall = SKY_ISLAND_BLOBS.find(row => row.file.name === 'world/geometry/fall.glb');
    if (fall === undefined) throw new Error('Missing waterfall geometry');
    const owned = createOwnedGeometry('fall'); await owned.load(fall.bytes); const geometry = owned.take();
    expect(geometry.index).toBeNull(); geometry.dispose();
  } finally {
    for (const { mesh } of nodes.values()) { mesh.geometry.dispose(); for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose(); }
  }
});

test('buffer admission refuses crossed ids, malformed storage and executable rows', () => {
  const base = { version: 1, buffers: [{ id: 'x', storage: 'f32', bytes: 'AAAAAAAAAAAAAAAA' }], attributes: [{ id: 'a', buffer: 'x', size: 3 }], geometries: [{ id: 'g', attributes: { position: 'a' } }], draws: [{ id: 'd', draw: { kind: 'points', geometry: 'g' } }] };
  expect(() => admitSceneBuffers(base)).not.toThrow();
  expect(() => parseSceneBuffers({ ...base, draws: [{ id: 'd', draw: { kind: 'mesh', geometry: 'absent' } }] })).toThrow();
  expect(() => admitSceneBuffers({ ...base, buffers: [{ id: 'x', storage: 'f32', bytes: 'AA==' }] })).toThrow('Misaligned');
  expect(() => parseSceneBuffers({ ...base, update: () => new Vector3() })).toThrow();
});
