import { expect, test } from 'vitest';
import { DataTexture, Material } from 'three';
import { compileGraph, attachOutline } from '../src/engine/render/graph/compile';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';
import { materialTextureRefs } from '../src/format/materials';
import { clientGraphs } from '../src/game/shardfile/clientGraphs';
import { emptyShardfile } from '../src/sdk/author';
import { SKY_GRAPHS } from '../src/shards/pine-hollow/data/skyLook';

const LENT: GraphIr = { version: 1, kind: 'material', model: 'unlit',
  params: { key: { type: 'texture', value: 'slot', role: 'lent' } },
  nodes: { uv: { op: 'uv' }, tap: { op: 'texture', param: 'key', in: ['uv'] }, rgb: { op: 'swizzle', in: ['tap'], mask: 'xyz' } },
  stages: { surface: { colour: 'rgb' } } };

/** the texture every sample node of `material`'s colour reads (walks the node tree for `.value` textures) */
function sampled(material: Material): DataTexture[] {
  const out: DataTexture[] = [], seen = new Set<object>();
  const walk = (node: unknown): void => {
    if (typeof node !== 'object' || node === null || seen.has(node)) return;
    seen.add(node);
    const value: unknown = Reflect.get(node, 'value');
    if (value instanceof DataTexture && Reflect.get(node, 'isTextureNode') === true) out.push(value);
    for (const key of ['node', 'nodes', 'uvNode', 'aNode', 'bNode', 'cNode', 'colorNode', 'convertTo']) {
      const child: unknown = Reflect.get(node, key);
      if (Array.isArray(child)) child.forEach(walk); else walk(child);
    }
  };
  walk(Reflect.get(material, 'colorNode'));
  return out;
}

test('a lent texture param names no admitted file and is swapped in place by setTexture', () => {
  expect(validateGraph(LENT).ok).toBe(true);
  expect(materialTextureRefs({ m: { family: 'graph', graph: LENT } })).toEqual([]);
  const source = emptyShardfile({ slug: 'lent-fixture', name: 'Lent', author: 'Test', seed: 1, revision: 1 });
  const graphs = clientGraphs(source, { compiler: { compileGraph, attachOutline },
    fallback: () => { throw new Error('Unexpected fallback'); }, textures: () => { throw new Error('A lent texture is never resolved'); } });
  const material = graphs.compile({ family: 'graph', graph: LENT }), foreign = new Material();
  const key = new DataTexture(new Uint8Array([1, 2, 3, 255]), 1, 1);
  try {
    const before = material.version, [standIn] = sampled(material);
    expect(standIn?.image.width).toBe(1);
    graphs.setTexture(material, 'key', key);
    expect(sampled(material)).toEqual([key]);
    expect(material.version).toBe(before);
    expect(() => graphs.setTexture(material, 'absent', key)).toThrow('no sampled lent texture');
    expect(() => graphs.setTexture(foreign, 'key', key)).toThrow('no compiled graph');
  } finally { material.dispose(); foreign.dispose(); key.dispose(); }
});

test('a lent role is a texture param role only', () => {
  const bad = { ...LENT, params: { key: { type: 'float', value: 0, role: 'lent' } } };
  expect(validateGraph(bad).ok).toBe(false);
});

test("Pine's sky graphs validate under their own budget and compile", () => {
  for (const graph of Object.values(SKY_GRAPHS)) {
    const checked = validateGraph(graph, { trustedBudget: true });
    expect(checked.ok ? [] : checked.errors).toEqual([]);
    const compiled = compileGraph(graph, { trustedBudget: true });
    compiled.setTexture('keyA', new DataTexture(new Uint8Array(4), 1, 1));
    compiled.material.dispose();
  }
});
