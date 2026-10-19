/** Real pinned input, independently decoded with THREE.GLTFLoader. No fallback or renderer. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { Mesh, MeshStandardMaterial, Object3D, Vector3, Vector4, Matrix4, Quaternion, ShaderChunk } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { packedCreatureBodies } from '../../../../src/game/plugin/geometry';

const folder = resolve('art/driftwood-isle/approved-conch/selected-native-normals');
const finite = v.pipe(v.number(), v.finite());
const triple = v.tuple([finite, finite, finite]);
const sourceSchema = v.object({ schema: v.literal('wildshard.conch.mesh.v1'),
  bones: v.array(v.object({ name: v.string(), parent: v.nullable(v.string()), pos: triple })),
  parts: v.array(v.object({ name: v.string(), positions: v.array(finite), normals: v.array(finite), colorsLinear: v.array(finite),
    skinIndices: v.array(v.pipe(finite, v.integer())), skinWeights: v.array(finite), furLen: v.array(finite) })) });
const source = v.parse(sourceSchema, JSON.parse(readFileSync(resolve(folder, 'native/conch-character-pass-native.json'), 'utf8')));
const mapping = v.parse(v.array(v.object({ node: v.number(), name: v.string(), joint: v.string(), vertexStart: v.number(), vertexCount: v.number() })),
  JSON.parse(readFileSync(resolve(folder, 'native/mesh-map.json'), 'utf8')));

test('all 15 parts survive the real packedCreatureBodies consumer with fresh geometry', async () => {
  const metadata: unknown = JSON.parse(readFileSync(resolve(folder, 'native/metadata.json'), 'utf8'));
  const bytes = new Uint8Array(readFileSync(resolve(folder, 'native/payload.bin')));
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
      ['position', 3, part.positions], ['normal', 3, part.normals], ['color', 3, part.colorsLinear],
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
  expect(count).toBe(6570);
});

test('independent GLTFLoader proves every ordered triangle, linear color and world transform unchanged', async () => {
  const bytes = readFileSync('art/driftwood-isle/approved-conch/selected-geometry-admission/conch-study.glb');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('21a6fd0d5e300c58952408913c69824228304141daab461fcb0122a388e27f1a');
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
        expect(part.normals.slice(cursor*3, cursor*3+3)).toEqual(new Vector3().fromBufferAttribute(normal, i).toArray());
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
  expect(vertices).toBe(6570);
  // All 21 legitimate non-opposed polygon/facet deviations are preserved.
  expect(inconsistentNormals).toEqual({});
  expect(degenerate).toBe(0);
  expect(deviations).toBe(21);
  expect(minimumCosine).toBeCloseTo(0.1021281717893707, 10);
});

test('actual THREE skin preserves rest and preserves rest and isolates every weighted joint influence', async () => {
  const { Bone, Skeleton, SkinnedMesh, MeshBasicMaterial } = await import('three');
  const metadata: unknown = JSON.parse(readFileSync(resolve(folder, 'native/metadata.json'), 'utf8'));
  const bytes = new Uint8Array(readFileSync(resolve(folder, 'native/payload.bin')));
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
  // CPU execution of the installed THREE skinnormal shader equation, using the
  // actual Skeleton Float32 palette and bind matrices. This is not a GPU render.
  expect(ShaderChunk.skinnormal_vertex).toContain('skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;');
  expect(ShaderChunk.skinnormal_vertex).toContain('objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;');
  const checkNormals = (restPose: boolean): void => {
    let maximumError = 0;
    let restError = 0;
    let changed = 0;
    for (const mesh of meshes) {
      const normals = mesh.geometry.getAttribute('normal');
      const indices = mesh.geometry.getAttribute('skinIndex');
      const weights = mesh.geometry.getAttribute('skinWeight');
      for (let vertex = 0; vertex < normals.count; vertex++) {
        const normal = new Vector3().fromBufferAttribute(normals, vertex);
        const skinMatrix = new Matrix4(); skinMatrix.elements.fill(0);
        const expected = new Vector3();
        for (let channel = 0; channel < 4; channel++) {
          const index = indices.getComponent(vertex, channel);
          const weight = weights.getComponent(vertex, channel);
          const matrix = new Matrix4().fromArray(skeleton.boneMatrices, index*16);
          matrix.elements.forEach((value, element) => {
            skinMatrix.elements[element] = (skinMatrix.elements[element] ?? 0) + value*weight;
          });
          const bone = skeleton.bones[index];
          if (bone === undefined) throw new Error('Missing normal transform bone');
          // Independent oracle: hierarchy world quaternion, no palette/bind math.
          const rotation = bone.getWorldQuaternion(new Quaternion());
          expected.addScaledVector(normal.clone().applyQuaternion(rotation), weight);
        }
        skinMatrix.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
        const actual4 = new Vector4(normal.x, normal.y, normal.z, 0).applyMatrix4(skinMatrix);
        const actual = new Vector3(actual4.x, actual4.y, actual4.z);
        maximumError = Math.max(maximumError, actual.distanceTo(expected));
        restError = Math.max(restError, actual.distanceTo(normal));
        if (actual.distanceTo(normal) > 1e-6) changed++;
      }
    }
    expect(maximumError).toBeLessThan(2e-7);
    if (restPose) expect(restError).toBeLessThan(2e-7);
    else expect(changed).toBeGreaterThan(0);
  };
  skeleton.update(); expect(movedParts()).toEqual([]); checkNormals(true);
  // Translation must never enter a normal (homogeneous w=0).
  root.position.x += 3; root.updateMatrixWorld(true); skeleton.update(); checkNormals(true);
  root.position.x -= 3; root.updateMatrixWorld(true); skeleton.update();

  for (const def of source.bones) {
    const name = def.name;
    const descendants = new Set([name]);
    for (const candidate of source.bones) {
      if (candidate.parent !== null && descendants.has(candidate.parent)) descendants.add(candidate.name);
    }
    const descendantIndices = new Set(source.bones.flatMap((row, i) => descendants.has(row.name) ? [i] : []));
    const expected = source.parts.filter(part => part.skinIndices.some((index, i) => descendantIndices.has(index) && (part.skinWeights[i] ?? 0) > 0)).map(part => part.name);
    const bone = bones.get(name);
    if (bone === undefined) throw new Error('Missing test joint');
    bone.rotation.x = .15; root.updateMatrixWorld(true); skeleton.update();
    expect(movedParts()).toEqual(expected); checkNormals(false);
    bone.rotation.x = 0; root.updateMatrixWorld(true); skeleton.update();
    expect(movedParts()).toEqual([]); checkNormals(true);
  }
  meshes.forEach(mesh => mesh.geometry.dispose());
  material.dispose(); skeleton.dispose();
});

test('real consumer refuses foreign creature identity, pre-load access and truncated payload', async () => {
  const metadata: unknown = JSON.parse(readFileSync(resolve(folder, 'native/metadata.json'), 'utf8'));
  const bytes = new Uint8Array(readFileSync(resolve(folder, 'native/payload.bin')));
  const bodies = packedCreatureBodies(metadata, undefined, () => Promise.resolve(bytes));
  expect(() => bodies.copy('conch-duelist', 'conch-duelist')).toThrow('not loaded');
  await bodies.preload();
  expect(() => bodies.copy('bellback', 'bellback')).toThrow('no baked creature body');
  expect(() => bodies.copy('brine-puffer', 'brine-puffer')).toThrow('no baked creature body');
  const truncated = packedCreatureBodies(metadata, undefined, () => Promise.resolve(bytes.slice(0, 20)));
  await truncated.preload();
  expect(() => truncated.copy('conch-duelist', 'conch-duelist')).toThrow();
});
