import { BoxGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, expect, it, vi } from 'vitest';
import { bakeKinds } from '../../src/sdk/bake/kinds';
import { bakedColliders, bakedKindsGroup, loadBakedKinds } from '../../src/game/shardfile/bakedKinds';

const instanced = (node: Object3D): node is InstancedMesh => node instanceof InstancedMesh;
afterEach(() => { vi.restoreAllMocks(); });

it('a baked piece whose GLB does not load is reported as an error (the boot smoke fails on it) and stands undrawn', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const nodes = await loadBakedKinds('/assets/nowhere/missing.glb', [], 'test-shard missing');
  expect(nodes.size).toBe(0);
  expect(error).toHaveBeenCalledTimes(1);
  expect(String(error.mock.calls[0]?.[0])).toContain('test-shard missing did not load');
  expect(bakedKindsGroup(nodes, []).children.length).toBe(0);
});

it('a kind round-trips: one instanced draw on its transforms, its row\'s material (or the shard\'s own), the extra fields and colliders kept', async () => {
  const material = new MeshStandardMaterial({ color: 0x336699, roughness: 0.7 }); material.userData['lit'] = true;
  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), material, 2);
  mesh.setMatrixAt(0, new Matrix4().makeTranslation(1, 2, 3)); mesh.setMatrixAt(1, new Matrix4().makeScale(2, 1, 1));
  const bake = bakeKinds('test.piece', [['crate', mesh]], [{ kind: 'box', x: 0, y: 1, z: 0, hx: 1, hy: 1, hz: 1, yaw: -0, surface: 'wood' }],
    { extra: (m) => m.userData['lit'] === true ? { lit: true } : {} });
  expect(bake.kinds).toEqual([{ name: 'crate', count: 2, color: 0x336699, roughness: 0.7, metalness: 0, flat: false, emissive: 0, emissiveIntensity: 1, vertexColors: false, doubleSided: false, lit: true }]);
  // the rows keep a `-0` yaw as `0`; the client takes the rows back as the registry's boxes and refuses an unknown surface
  const row = { kind: 'box', x: 0, y: 1, z: 0, hx: 1, hy: 1, hz: 1, yaw: 0, surface: 'wood' } as const;
  expect(bake.colliders).toEqual([row]);
  expect(bakedColliders([row])).toEqual([row]);
  expect(() => bakedColliders([{ ...row, surface: 'cheese' }])).toThrow(/unknown surface/);
  const gltf = await new GLTFLoader().parseAsync(new Uint8Array(bake.glb).buffer, '');
  const nodes: InstancedMesh[] = []; gltf.scene.traverse((n) => { if (instanced(n)) nodes.push(n); });
  const loaded = new Map(bake.kinds.map((k, i) => [k.name, nodes[i] ?? mesh]));
  const decorated: string[] = [];
  const group = bakedKindsGroup(loaded, bake.kinds, { decorate: (_m, kind) => { decorated.push(kind.name); } });
  const [drawn] = group.children; if (drawn === undefined || !instanced(drawn)) throw new Error('not instanced');
  const got = new Matrix4(); drawn.getMatrixAt(0, got);
  expect(got.elements[12]).toBeCloseTo(1); expect(got.elements[14]).toBeCloseTo(3);
  expect([drawn.count, drawn.castShadow, decorated]).toEqual([2, false, ['crate']]);
  const own = new MeshStandardMaterial();
  expect(bakedKindsGroup(loaded, bake.kinds, { material: () => own }).children[0]).toHaveProperty('material', own);
});
