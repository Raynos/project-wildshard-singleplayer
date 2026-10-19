/** Real pinned input, independently decoded with THREE.GLTFLoader. No fallback or renderer. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { packedCreatureBodies } from '../../../../src/game/plugin/geometry';

const folder = resolve('art/driftwood-isle/approved-conch/runtime-admission/character-pass-native1');
const finite = v.pipe(v.number(), v.finite());
const triple = v.tuple([finite, finite, finite]);
const sourceSchema = v.object({ schema: v.literal('wildshard.conch.mesh.v1'),
  bones: v.array(v.object({ name: v.string(), parent: v.nullable(v.string()), pos: triple })),
  parts: v.array(v.object({ name: v.string(), positions: v.array(finite), colorsLinear: v.array(finite),
    skinIndices: v.array(v.pipe(finite, v.integer())), skinWeights: v.array(finite), furLen: v.array(finite) })) });
const source = v.parse(sourceSchema, JSON.parse(readFileSync(resolve(folder, 'conch-character-pass-native.json'), 'utf8')));
const mapping = v.parse(v.array(v.object({ node: v.number(), name: v.string(), joint: v.string(), vertexStart: v.number(), vertexCount: v.number() })),
  JSON.parse(readFileSync(resolve(folder, 'mesh-map.json'), 'utf8')));

test('all 15 parts survive the real packedCreatureBodies consumer with fresh geometry', async () => {
  const metadata: unknown = JSON.parse(readFileSync(resolve(folder, 'metadata.json'), 'utf8'));
  const bytes = new Uint8Array(readFileSync(resolve(folder, 'payload.bin')));
  const bodies = packedCreatureBodies(metadata, undefined, () => Promise.resolve(bytes));
  await bodies.preload();
  const first = bodies.copy('conch-duelist', 'conch-duelist');
  const second = bodies.copy('conch-duelist', 'conch-duelist');
  expect(first.bones).toEqual(source.bones);
  expect(first.dims.bodyY).toBe(source.bones[0]?.pos[1]);
  expect(first.hardParts).toHaveLength(15);
  expect(first.eyeParts).toHaveLength(0); expect(first.furParts).toHaveLength(0);
  let count = 0;
  source.parts.forEach((part, index) => {
    const mesh = first.hardParts[index];
    if (mesh === undefined) throw new Error('Missing rigid part');
    expect(mesh).not.toBe(second.hardParts[index]);
    expect(mesh.index).toBeNull();
    for (const [name, width, values] of [
      ['position', 3, part.positions], ['color', 3, part.colorsLinear],
      ['skinIndex', 4, part.skinIndices], ['skinWeight', 4, part.skinWeights], ['furLen', 1, part.furLen],
    ] as const) {
      const attr = mesh.getAttribute(name);
      const expected = name === 'skinIndex' ? Uint16Array.from(values) : Float32Array.from(values);
      expect(attr.itemSize).toBe(width); expect(attr.normalized).toBe(false);
      expect(attr.array.constructor).toBe(expected.constructor);
      expect(Array.from(attr.array)).toEqual(Array.from(expected));
    }
    count += mesh.getAttribute('position').count;
    mesh.dispose(); second.hardParts[index]?.dispose();
  });
  expect(count).toBe(7338);
});

test('independent GLTFLoader proves every ordered triangle, linear color and world transform unchanged', async () => {
  const bytes = readFileSync('art/driftwood-isle/approved-conch/conch-character-pass-study.glb');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('214617350694ee61e43127eecf2ffe11ae484cff9ee1edfd86e3574ce4252c5d');
  const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
  gltf.scene.updateMatrixWorld(true);
  let vertices = 0;
  const inconsistentNormals: Record<string, number> = {};
  let degenerate = 0;
  let deviations = 0;
  let minimumCosine = 1;
  for (const row of mapping) {
    const part = source.parts.find(p => p.name === row.joint);
    if (part === undefined) throw new Error('Missing mapped native part');
    // GLTFLoader sanitizes names; node associations preserve the exact original index.
    const candidates = [...gltf.parser.associations.entries()].filter(([, value]) => value.nodes === row.node);
    const entry = candidates.find(([object]) => object instanceof Object3D && object.parent !== null);
    if (entry === undefined || !(entry[0] instanceof Object3D)) throw new Error(`Missing GLB node ${row.node}`);
    let cursor = row.vertexStart;
    entry[0].traverse(object => {
      if (!(object instanceof Mesh)) return;
      if (Array.isArray(object.material)) throw new Error('Unexpected material array');
      const material = object.material;
      if (!(material instanceof MeshStandardMaterial)) throw new Error('Missing standard GLB material');
      const color = material.color.toArray();
      const geometry = object.geometry;
      const position = geometry.getAttribute('position');
      const normal = geometry.getAttribute('normal');
      const indices = geometry.index;
      const count = indices?.count ?? position.count;
      const triangle: Vector3[] = [];
      for (let index = 0; index < count; index++) {
        const i = indices?.getX(index) ?? index;
        const point = new Vector3().fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
        const expected = part.positions.slice(cursor*3, cursor*3+3);
        point.toArray().forEach((value, axis) => expect(value).toBeCloseTo(expected[axis] ?? NaN, 10));
        expect(part.colorsLinear.slice(cursor*3, cursor*3+3)).toEqual(color);
        triangle.push(point);
        if (triangle.length === 3) {
          const [a, b, c] = triangle;
          if (a === undefined || b === undefined || c === undefined) throw new Error('Missing triangle');
          const face = b.clone().sub(a).cross(c.clone().sub(a));
          if (face.lengthSq() < 1e-20) degenerate++;
          else {
            const cosine = face.normalize().dot(new Vector3().fromBufferAttribute(normal, i));
            minimumCosine = Math.min(minimumCosine, cosine);
            if (cosine < .999) deviations++;
            if (cosine < -1e-7) inconsistentNormals[row.name] = (inconsistentNormals[row.name] ?? 0) + 1;
          }
          triangle.length = 0;
        }
        cursor++; vertices++;
      }
      geometry.dispose(); material.dispose();
    });
    expect(cursor-row.vertexStart).toBe(row.vertexCount);
  }
  expect(vertices).toBe(7338);
  // No opposed triangles in this pinned GLB. Flat facet shading/sidedness still
  // require matched native visual proof; this is not appearance acceptance.
  expect(inconsistentNormals).toEqual({});
  expect(degenerate).toBe(0);
  expect(deviations).toBe(63);
  expect(minimumCosine).toBeCloseTo(0.13694908417625526, 10);
});

test('actual THREE skin preserves rest and isolates every joint and its explicit descendants', async () => {
  const { Bone, Skeleton, SkinnedMesh, MeshBasicMaterial } = await import('three');
  const metadata: unknown = JSON.parse(readFileSync(resolve(folder, 'metadata.json'), 'utf8'));
  const bytes = new Uint8Array(readFileSync(resolve(folder, 'payload.bin')));
  const bodies = packedCreatureBodies(metadata, undefined, () => Promise.resolve(bytes));
  await bodies.preload();
  const body = bodies.copy('conch-duelist', 'conch-duelist');
  const bones = new Map<string, InstanceType<typeof Bone>>();
  for (const def of body.bones) {
    const bone = new Bone(); bone.name = def.name;
    const parent = def.parent === null ? undefined : bones.get(def.parent);
    const parentDef = body.bones.find(row => row.name === def.parent);
    bone.position.fromArray(def.pos);
    if (parentDef !== undefined) bone.position.sub(new Vector3(...parentDef.pos));
    if (parent !== undefined) parent.add(bone);
    bones.set(def.name, bone);
  }
  const root = bones.get('body');
  if (root === undefined) throw new Error('Missing body');
  root.updateMatrixWorld(true);
  const skeleton = new Skeleton([...bones.values()]);
  const material = new MeshBasicMaterial();
  const meshes = body.hardParts.map(geometry => {
    const mesh = new SkinnedMesh(geometry, material);
    mesh.bind(skeleton);
    return mesh;
  });
  const movedParts = (): string[] => meshes.flatMap((mesh, partIndex) => {
    let moved = false;
    const positions = mesh.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const rest = new Vector3().fromBufferAttribute(positions, i);
      if (mesh.applyBoneTransform(i, rest.clone()).distanceTo(rest) > 1e-6) moved = true;
    }
    const name = source.parts[partIndex]?.name;
    if (name === undefined) throw new Error('Missing part name');
    return moved ? [name] : [];
  });
  skeleton.update(); expect(movedParts()).toEqual([]);
  for (const def of source.bones) {
    const name = def.name;
    const descendants = new Set([name]);
    for (const candidate of source.bones) {
      if (candidate.parent !== null && descendants.has(candidate.parent)) descendants.add(candidate.name);
    }
    const expected = source.parts.filter(part => part.skinIndices.some((index, at) => {
      const name = source.bones[index]?.name;
      return name !== undefined && descendants.has(name) && (part.skinWeights[at] ?? 0) > 0;
    })).map(part => part.name);
    const bone = bones.get(name);
    if (bone === undefined) throw new Error('Missing test joint');
    for (const axis of ['x', 'y', 'z'] as const) {
      bone.rotation[axis] = .15; root.updateMatrixWorld(true); skeleton.update();
      expect(movedParts()).toEqual(expected);
      bone.rotation[axis] = 0; root.updateMatrixWorld(true); skeleton.update();
      expect(movedParts()).toEqual([]);
    }
  }
  meshes.forEach(mesh => mesh.geometry.dispose());
  material.dispose(); skeleton.dispose();
});

test('real consumer refuses foreign creature identity, pre-load access and truncated payload', async () => {
  const metadata: unknown = JSON.parse(readFileSync(resolve(folder, 'metadata.json'), 'utf8'));
  const bytes = new Uint8Array(readFileSync(resolve(folder, 'payload.bin')));
  const bodies = packedCreatureBodies(metadata, undefined, () => Promise.resolve(bytes));
  expect(() => bodies.copy('conch-duelist', 'conch-duelist')).toThrow('not loaded');
  await bodies.preload();
  expect(() => bodies.copy('bellback', 'bellback')).toThrow('no baked creature body');
  expect(() => bodies.copy('brine-puffer', 'brine-puffer')).toThrow('no baked creature body');
  const truncated = packedCreatureBodies(metadata, undefined, () => Promise.resolve(bytes.slice(0, 20)));
  await truncated.preload();
  expect(() => truncated.copy('conch-duelist', 'conch-duelist')).toThrow();
});
