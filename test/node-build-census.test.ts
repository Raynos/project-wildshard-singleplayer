import { expect, test } from 'vitest';
import { NodeUniform, UniformNode } from 'three/webgpu';
import { buildCensus, GraphNodeOwner, recordBuild, type BuildOutput } from '../src/engine/render/nodes/nodeBuildReuse';

const uniform = (value: number): UniformNode<unknown, unknown> => new UniformNode(value);
const output = (nodes: UniformNode<unknown, unknown>[], update: UniformNode<unknown, unknown>[] = []): BuildOutput => ({
  vertexShader: '', fragmentShader: '', uniforms: { vertex: nodes.map((node, i) => new NodeUniform(`u${String(i)}`, 'float', node)), fragment: [] },
  uniformGroups: {}, updateNodes: update,
});

test('a build census splits uniform and update nodes into compile, build-made and older shared nodes', () => {
  const shared = uniform(0);
  const owner = new GraphNodeOwner();
  const compiled = owner.run(() => uniform(1));
  owner.seal();
  let fresh = shared;
  const made = recordBuild(() => { fresh = uniform(2); });
  expect(made).toContain(fresh);
  expect(made).not.toContain(compiled);
  const census = buildCensus(output([compiled, fresh, shared], [fresh]), { nodes: owner.compiled, signature: '' }, made);
  expect([census.compile, census.made, census.other]).toEqual([1, 1, ['UniformNode']]);
  expect(census.shape).toMatch(/^[0-9a-f]+$/u);
});

test('recording nests with an owner run and leaves node ids as plain fields afterwards', () => {
  const owner = new GraphNodeOwner();
  let inner = uniform(0);
  const made = recordBuild(() => { owner.run(() => { inner = uniform(3); }); });
  expect(made).toContain(inner);
  expect(owner.owns(inner)).toBe(true);
  const after = uniform(4), before = uniform(5);
  expect(after.id).toBeLessThan(before.id);
  expect(Object.hasOwn(after, 'id')).toBe(true);
});
