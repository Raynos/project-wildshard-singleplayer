import { expect, test } from 'vitest';
import { DataTexture, DoubleSide } from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { bindGraphMeshMap } from '../src/engine/render/graphBackend';
import { Scope } from '../src/engine/app/scope';
import { validateGraph } from '../src/format/materialGraph';
import { UNDER_GRAPHS, UNDER_LOOK } from '../src/shards/pine-hollow/data/undergrowthLook';

test("Pine's undergrowth graph validates in its budget and compiles a swaying, cut, shadow-casting foliage material", () => {
  // every kind names a declared graph; each shadow-casting kind has a compile of its own
  for (const [, row] of UNDER_LOOK.kinds) expect(UNDER_GRAPHS[row.graph]).toBeDefined();
  const casting = UNDER_LOOK.kinds.filter(([, row]) => row.shadow).map(([, row]) => row.graph);
  expect(new Set(casting).size).toBe(casting.length);
  expect(Object.keys(UNDER_GRAPHS)).toHaveLength(casting.length + 1);
  const graph = UNDER_GRAPHS['pine-undergrowth'];
  if (graph === undefined) throw new Error('no undergrowth graph');
  const checked = validateGraph(graph, { trustedBudget: true });
  expect(checked.ok ? [] : checked.errors).toEqual([]);
  const compiled = compileGraph(graph, { trustedBudget: true }), scope = new Scope('undergrowth-test');
  const fern = new DataTexture(new Uint8Array([40, 90, 30, 255]), 1, 1), reed = new DataTexture(new Uint8Array([90, 100, 40, 255]), 1, 1);
  try {
    const m = compiled.material;
    expect(m.userData['graphShadowDepth']).toBe(true);
    expect(m.userData['graphMeshMap']).toBe(true);
    expect(m.side).toBe(DoubleSide);
    expect(m.transparent).toBe(false);
    // each kind wears the one program over its own texture, with its own cut
    const a = bindGraphMeshMap(m, fern, scope), b = bindGraphMeshMap(m, reed, scope);
    expect(a).not.toBe(b);
    expect(bindGraphMeshMap(m, fern, scope)).toBe(a);
    a.alphaTest = 0.5; b.alphaTest = 0.45;
    expect(a.alphaTest).not.toBe(b.alphaTest);
    expect(Reflect.get(a, 'positionNode')).toBe(Reflect.get(m, 'positionNode'));
    compiled.setParam('viewer', [1, 2, 3]);
    compiled.setParam('fade', [45, 13.5]);
  } finally { scope.dispose(); compiled.material.dispose(); fern.dispose(); reed.dispose(); }
});
