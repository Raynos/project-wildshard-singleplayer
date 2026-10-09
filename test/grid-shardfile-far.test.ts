import { expect, it } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial, ShaderLib, type IUniform } from 'three';
import { emptyShardfile } from '../src/sdk/author';
import { staticGlb } from '../src/sdk/bake/glb';
import { assetCost } from '../src/sdk/assets';
import { loadShardfileFar } from '../src/game/grid/shardfileFar';
import { farProxyMaterial } from '../src/game/grid/farView';
import type { Shardfile } from '../src/game/shardfile/schema';

it('loads the declared authored far GLB without a baked-folder asset or UV channel, charging its actual row', async () => {
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([-200, 0, -200, 200, 0, -200, 0, 20, 200], 3))
    .setAttribute('color', new Float32BufferAttribute([0.4, 0.4, 0.4, 0.5, 0.5, 0.5, 0.6, 0.6, 0.6], 3));
  geometry.computeVertexNormals();
  const material = new MeshStandardMaterial({ vertexColors: true });
  const wire = staticGlb([{ geometry, material }]), ref = 'a'.repeat(64), cost = assetCost('glb', wire);
  geometry.dispose(); material.dispose();
  const base = emptyShardfile({ slug: 'authored-far-fixture', name: 'Authored far', author: 'Fixture', revision: 1, seed: 1 });
  const source: Shardfile = { ...base,
    far: { bounds: { min: [-200, 0, -200], max: [200, 20, 200] }, files: [ref], compressed: wire.length, ...cost },
    props: { version: 1, family: 'pbr', tiles: [], panels: [], models: [], textures: [], colliders: [], far: ref },
  };
  const reads: string[] = [];
  const result = await loadShardfileFar(source, hash => { reads.push(hash); return Promise.resolve(wire); });
  try {
    expect(reads).toEqual([ref]); expect(result.bytes).toBe(cost.decoded + cost.gpu);
    expect(result.prepared.positionalMask).toBe(true);
    expect(result.prepared.geometry.hasAttribute('uv')).toBe(false);
    expect(result.prepared.geometry.getAttribute('color').count).toBe(3);
  } finally { result.prepared.geometry.dispose(); }
  await expect(loadShardfileFar(base, () => Promise.resolve(wire))).rejects.toThrow('no declared far GLB');
});

it('masks authored triangles by fragment position across L1 boundaries without requiring legacy region UVs', () => {
  const look = { family: 'pbr' as const, haze: { colour: [1, 1, 1] as const, near: 160, far: 700, max: 1 } };
  const authored = farProxyMaterial(look, true), legacy = farProxyMaterial(look);
  const compile = (material: MeshStandardMaterial | ReturnType<typeof farProxyMaterial>['material']) => {
    const shader = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader, uniforms: {} as Record<string, IUniform> };
    Reflect.apply(material.onBeforeCompile.bind(material), undefined, [shader, null]);
    return shader;
  };
  try {
    const shader = compile(authored.material);
    expect(shader.vertexShader).not.toContain('uv.x'); expect(shader.vertexShader).not.toContain('uv.y');
    expect(shader.fragmentShader).toContain('farCell.x + 4.0 * farCell.y');
    expect(shader.fragmentShader).toContain('discard;');
    authored.setMask(new Set([6]));
    const mask: unknown = shader.uniforms['farMask']?.value;
    if (!(mask instanceof Float32Array)) throw new Error('Missing far region mask');
    expect(mask[6]).toBe(1);
    expect(compile(legacy.material).vertexShader).toContain('farMask[int(uv.x + 0.5)]');
    expect(authored.material.customProgramCacheKey()).not.toBe(legacy.material.customProgramCacheKey());
  } finally { authored.material.dispose(); legacy.material.dispose(); }
});
