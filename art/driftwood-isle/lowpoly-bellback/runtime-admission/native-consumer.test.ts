/** Real pinned input, independently decoded with THREE.GLTFLoader. No fallback or renderer. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { packedCreatureBodies } from '../../../../src/game/plugin/geometry';

const folder = resolve('art/driftwood-isle/lowpoly-bellback/runtime-admission/v6-rigid1');
const finite = v.pipe(v.number(), v.finite());
const triple = v.tuple([finite, finite, finite]);
const sourceSchema = v.object({ schema: v.literal('wildshard.bellback.mesh.v1'),
  bones: v.array(v.object({ name: v.string(), parent: v.nullable(v.string()), pos: triple })),
  parts: v.array(v.object({ name: v.string(), positions: v.array(finite), colorsLinear: v.array(finite),
    skinIndices: v.array(v.pipe(finite, v.integer())), skinWeights: v.array(finite), furLen: v.array(finite) })) });
const source = v.parse(sourceSchema, JSON.parse(readFileSync(resolve(folder, 'bellback-v6-native.json'), 'utf8')));
const mapping = v.parse(v.array(v.object({ node: v.number(), name: v.string(), joint: v.string(), vertexStart: v.number(), vertexCount: v.number() })),
  JSON.parse(readFileSync(resolve(folder, 'mesh-map.json'), 'utf8')));

test('all eight rigid parts survive the real packedCreatureBodies consumer with fresh geometry', async () => {
  const metadata: unknown = JSON.parse(readFileSync(resolve(folder, 'metadata.json'), 'utf8'));
  const bytes = new Uint8Array(readFileSync(resolve(folder, 'payload.bin')));
  const bodies = packedCreatureBodies(metadata, undefined, () => Promise.resolve(bytes));
  await bodies.preload();
  const first = bodies.copy('bellback', 'bellback');
  const second = bodies.copy('bellback', 'bellback');
  expect(first.bones).toEqual(source.bones);
  expect(first.dims.bodyY).toBe(source.bones[0]?.pos[1]);
  expect(first.hardParts).toHaveLength(8);
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
  expect(count).toBe(13374);
});

test('independent GLTFLoader proves every ordered triangle, linear color and world transform unchanged', async () => {
  const bytes = readFileSync('tmp/bellback-v6-review/bellback-study-v6.glb');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('ec5850fda8a97e7eef064098fdb212d4e2be2f5dc4699548de0430f812b8e7b0');
  const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
  gltf.scene.updateMatrixWorld(true);
  let vertices = 0;
  const inconsistentNormals: Record<string, number> = {};
  let degenerate = 0;
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
          else if (face.dot(new Vector3().fromBufferAttribute(normal, i)) < -1e-9)
            inconsistentNormals[row.name] = (inconsistentNormals[row.name] ?? 0) + 1;
          triangle.length = 0;
        }
        cursor++; vertices++;
      }
      geometry.dispose(); material.dispose();
    });
    expect(cursor-row.vertexStart).toBe(row.vertexCount);
  }
  expect(vertices).toBe(13374);
  // These are defects already in the approved GLB. This is an exact preservation test,
  // NOT a normal/culling acceptance: native flat shading needs separate visual proof.
  expect(inconsistentNormals).toEqual({ 'Barrel timber hull': 8, 'Crown tie': 1, 'Lower timber jaw': 5 });
  expect(degenerate).toBe(0);
});

test('actual THREE skin preserves rest vertices and isolates head, four legs, bell and clapper', async () => {
  const { Bone, Skeleton, SkinnedMesh, MeshBasicMaterial } = await import('three');
  const metadata: unknown = JSON.parse(readFileSync(resolve(folder, 'metadata.json'), 'utf8'));
  const bytes = new Uint8Array(readFileSync(resolve(folder, 'payload.bin')));
  const bodies = packedCreatureBodies(metadata, undefined, () => Promise.resolve(bytes));
  await bodies.preload();
  const body = bodies.copy('bellback', 'bellback');
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
  for (const [name, expected] of [
    ['head', ['head']], ['leg0', ['leg0']], ['leg1', ['leg1']], ['leg2', ['leg2']], ['leg3', ['leg3']],
    ['clapper', ['clapper']], ['bell', ['bell', 'clapper']],
    ['body', ['body', 'head', 'bell', 'clapper', 'leg0', 'leg1', 'leg2', 'leg3']],
  ] as const) {
    const bone = bones.get(name);
    if (bone === undefined) throw new Error('Missing test joint');
    bone.rotation.x = .15; root.updateMatrixWorld(true); skeleton.update();
    expect(movedParts()).toEqual(expected);
    bone.rotation.x = 0; root.updateMatrixWorld(true); skeleton.update();
    expect(movedParts()).toEqual([]);
  }
  meshes.forEach(mesh => mesh.geometry.dispose());
  material.dispose(); skeleton.dispose();
});
