/** Real pinned input, independently decoded with THREE.GLTFLoader. No fallback or renderer. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { packedCreatureBodies } from '../../../../src/game/plugin/geometry';

const folder = resolve('art/driftwood-isle/lowpoly-colossus/complete-character-next');
const finite = v.pipe(v.number(), v.finite());
const triple = v.tuple([finite, finite, finite]);
const sourceSchema = v.object({ schema: v.literal('wildshard.colossus.mesh.v1'),
  bones: v.array(v.object({ name: v.string(), parent: v.nullable(v.string()), pos: triple })),
  parts: v.array(v.object({ name: v.string(), positions: v.array(finite), colorsLinear: v.array(finite),
    skinIndices: v.array(v.pipe(finite, v.integer())), skinWeights: v.array(finite), furLen: v.array(finite) })) });
const source = v.parse(sourceSchema, JSON.parse(readFileSync(resolve(folder, 'native-source.json'), 'utf8')));
const mapping = v.parse(v.array(v.object({ node: v.number(), name: v.string(), joint: v.string(), vertexStart: v.number(), vertexCount: v.number() })),
  JSON.parse(readFileSync(resolve(folder, 'mesh-map.json'), 'utf8')));

test('all 12 semantic batches survive the real packedCreatureBodies consumer with fresh geometry', async () => {
  const metadata: unknown = JSON.parse(readFileSync(resolve(folder, 'metadata.json'), 'utf8'));
  const bytes = new Uint8Array(readFileSync(resolve(folder, 'payload.bin')));
  const bodies = packedCreatureBodies(metadata, undefined, () => Promise.resolve(bytes));
  await bodies.preload();
  const first = bodies.copy('tideRootColossus', 'tide-root-colossus');
  const second = bodies.copy('tideRootColossus', 'tide-root-colossus');
  expect(first.bones).toEqual(source.bones);
  expect(first.dims.bodyY).toBe(source.bones[0]?.pos[1]);
  expect(first.hardParts).toHaveLength(source.parts.length);
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
  expect(count).toBe(18006);
});

test('independent GLTFLoader proves every ordered triangle, linear color and world transform unchanged', async () => {
  const bytes = readFileSync('art/driftwood-isle/lowpoly-colossus/complete-character-next/tide-root-colossus-complete-character-next.glb');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(JSON.parse(readFileSync(resolve(folder, 'validation.json'), 'utf8')).sha256);
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
  expect(vertices).toBe(18006);
  // Strict final triangle normals; no visual acceptance.
  expect(inconsistentNormals).toEqual({});
  expect(degenerate).toBe(0);
  expect(deviations).toBe(0);
  expect(minimumCosine).toBeGreaterThan(.99999);
});

test('actual THREE skin preserves rest and matches analytic LBS for every joint, all weighted descendants and all unaffected vertices', async () => {
  const { Bone, Skeleton, SkinnedMesh, MeshBasicMaterial } = await import('three');
  const metadata: unknown = JSON.parse(readFileSync(resolve(folder, 'metadata.json'), 'utf8'));
  const bytes = new Uint8Array(readFileSync(resolve(folder, 'payload.bin')));
  const bodies = packedCreatureBodies(metadata, undefined, () => Promise.resolve(bytes));
  await bodies.preload();
  const body = bodies.copy('tideRootColossus', 'tide-root-colossus');
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
  const maxRestError = (): number => {
    let maximum = 0;
    for (const mesh of meshes) {
      const positions = mesh.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const rest = new Vector3().fromBufferAttribute(positions, i);
        maximum = Math.max(maximum, mesh.applyBoneTransform(i, rest.clone()).distanceTo(rest));
      }
    }
    return maximum;
  };
  skeleton.update(); expect(maxRestError()).toBeLessThan(1e-6);
  // Independent analytic LBS oracle: a single local X rotation moves each
  // weighted descendant around that joint's absolute identity-oriented pivot.
  for (const def of source.bones) {
    const descendants = new Set([def.name]);
    for (const candidate of source.bones) {
      if (candidate.parent !== null && descendants.has(candidate.parent)) descendants.add(candidate.name);
    }
    const bone = bones.get(def.name);
    if (bone === undefined) throw new Error('Missing test joint');
    const pivot = new Vector3(...def.pos);
    bone.rotation.x = .15; root.updateMatrixWorld(true); skeleton.update();
    let maxError = 0, affected = 0, unaffected = 0;
    for (const mesh of meshes) {
      const positions = mesh.geometry.getAttribute('position');
      const indices = mesh.geometry.getAttribute('skinIndex');
      const weights = mesh.geometry.getAttribute('skinWeight');
      for (let i = 0; i < positions.count; i++) {
        const rest = new Vector3().fromBufferAttribute(positions, i);
        let influence = 0, total = 0;
        for (let component = 0; component < 4; component++) {
          const weight = weights.getComponent(i, component);
          const name = source.bones[indices.getComponent(i, component)]?.name;
          if (name === undefined) throw new Error('Invalid weighted bone');
          total += weight;
          if (descendants.has(name)) influence += weight;
        }
        const shifted = rest.clone().sub(pivot).applyAxisAngle(new Vector3(1, 0, 0), .15).add(pivot);
        const expected = rest.clone().multiplyScalar(total-influence).addScaledVector(shifted, influence);
        const actual = mesh.applyBoneTransform(i, rest.clone());
        maxError = Math.max(maxError, actual.distanceTo(expected));
        if (influence > 0) affected++; else unaffected++;
      }
    }
    expect(maxError).toBeLessThan(2e-6);
    expect(affected).toBeGreaterThan(0);
    if (def.name === 'body') expect(unaffected).toBe(0);
    else expect(unaffected).toBeGreaterThan(0);
    bone.rotation.x = 0; root.updateMatrixWorld(true); skeleton.update();
    expect(maxRestError()).toBeLessThan(1e-6);
  }
  meshes.forEach(mesh => mesh.geometry.dispose());
  material.dispose(); skeleton.dispose();
});

test('real consumer refuses foreign creature identity, pre-load access and truncated payload', async () => {
  const metadata: unknown = JSON.parse(readFileSync(resolve(folder, 'metadata.json'), 'utf8'));
  const bytes = new Uint8Array(readFileSync(resolve(folder, 'payload.bin')));
  const bodies = packedCreatureBodies(metadata, undefined, () => Promise.resolve(bytes));
  expect(() => bodies.copy('tideRootColossus', 'tide-root-colossus')).toThrow('not loaded');
  await bodies.preload();
  expect(() => bodies.copy('bellback', 'bellback')).toThrow('no baked creature body');
  expect(() => bodies.copy('brine-puffer', 'brine-puffer')).toThrow('no baked creature body');
  const truncated = packedCreatureBodies(metadata, undefined, () => Promise.resolve(bytes.slice(0, 20)));
  await truncated.preload();
  expect(() => truncated.copy('tideRootColossus', 'tide-root-colossus')).toThrow();
});
