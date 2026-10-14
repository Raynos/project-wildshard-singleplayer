import { expect, test } from 'vitest';
import { Material, Vector3 } from 'three';
import { MeshBasicNodeMaterial, UniformNode } from 'three/webgpu';
import { compileGraph, attachOutline } from '../src/engine/render/graph/compile';
import { clientGraphs } from '../src/game/shardfile/clientGraphs';
import { emptyShardfile } from '../src/sdk/author';

test('runtime graph uniforms move in place and refuse invalid writes atomically', () => {
  const source = emptyShardfile({ slug: 'param-fixture', name: 'Param', author: 'Test', seed: 1, revision: 1 });
  const graphs = clientGraphs(source, { compiler: { compileGraph, attachOutline },
    fallback: () => { throw new Error('Unexpected fallback'); }, textures: () => { throw new Error('Unexpected texture'); } });
  const material = graphs.compile({ family: 'graph', graph: { version: 1, kind: 'material', model: 'unlit',
    params: { tint: { type: 'vec3', value: [0.2, 0.3, 0.4], min: 0, max: 1 } },
    nodes: { tint: { op: 'param', param: 'tint' } }, stages: { surface: { colour: 'tint' } } } });
  const foreign = new Material();
  try {
    if (!(material instanceof MeshBasicNodeMaterial) || material.colorNode === null) throw new Error('Missing graph material');
    const uniform: unknown = Reflect.get(material.colorNode, 'node');
    if (!(uniform instanceof UniformNode) || !(uniform.value instanceof Vector3)) throw new Error('Missing live uniform');
    const before = material.version, value = [0.6, 0.7, 0.8];
    graphs.setParam(material, 'tint', value); value.fill(9);
    expect(uniform.value.toArray()).toEqual([0.6, 0.7, 0.8]);
    expect(material.version).toBe(before);
    const sparse: number[] = []; sparse.length = 3;
    for (const invalid of [0.5, [1, 2], [0, Number.NaN, 0], [-1, 0, 0], [0, 0, 2], sparse]) {
      expect(() => graphs.setParam(material, 'tint', invalid)).toThrow();
      expect(uniform.value.toArray()).toEqual([0.6, 0.7, 0.8]);
    }
    expect(() => graphs.setParam(material, 'absent', 1)).toThrow('no param');
    expect(() => graphs.setParam(foreign, 'tint', [0, 0, 0])).toThrow('no compiled graph');
  } finally { material.dispose(); foreign.dispose(); }
});
