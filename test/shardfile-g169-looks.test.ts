// SF59 / G169: the two stress looks as whole shardfile looks through admission: the pastel alien plain (a lit material
// graph, a preset-referenced ground and a soft pastel grade pass) and the ink / cel valley (its cel graph with the outline
// stage, the toon preset ground and its (2b) edge post reading colour, depth and normal), each stack within budget v1 and
// the two summed where their frames blend. Not yet the playable fixture shards the row asks for.
import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile, shardfileRules } from '@wildshard/game/shardfile/schema';
import type { GraphIr } from '../src/engine/core/materialGraph';
import { POST_NORMAL_PREPASS_COST, POST_STACK_BUDGET, postPairRefusal, postStackCost } from '../src/game/shardfile/postStack';
import { inkGraph, inkPostGraph, pastelGraph } from '../scripts/tsl-spike/stress.js';

/** the pastel plain's grade: a lifted, desaturated-toward-lilac screen with a soft vignette */
const pastelGrade: GraphIr = {
  version: 1, kind: 'post', params: { lilac: { type: 'colour', value: [0.86, 0.8, 0.94] }, lift: { type: 'float', value: 0.18, min: 0, max: 0.5 } },
  nodes: {
    c: { op: 'sceneColour' }, rgb: { op: 'swizzle', in: ['c'], mask: 'xyz' }, t1: { op: 'add', in: ['rgb', 1] }, tone: { op: 'div', in: ['rgb', 't1'] },
    l: { op: 'dot', in: ['tone', [0.2126, 0.7152, 0.0722]] }, lilac: { op: 'param', param: 'lilac' }, wash: { op: 'mul', in: ['lilac', 'l'] },
    soft: { op: 'mix', in: ['tone', 'wash', 0.35] }, lift: { op: 'param', param: 'lift' }, lifted: { op: 'mix', in: ['soft', [1, 1, 1], 'lift'] },
    uv: { op: 'screenUV' }, d: { op: 'sub', in: ['uv', 0.5] }, r: { op: 'dot', in: ['d', 'd'] }, v0: { op: 'smoothstep', in: [0.15, 0.6, 'r'] }, v1: { op: 'mul', in: ['v0', 0.2] }, v: { op: 'oneMinus', in: ['v1'] },
    out: { op: 'mul', in: ['lifted', 'v'] },
  },
  stages: { post: { colour: 'out' } },
};
function look(slug: string, materials: Record<string, unknown>, post: unknown[]) {
  const base = emptyShardfile({ slug, name: slug, author: 'Local', seed: 1, revision: 1 });
  return parseShardfile({ ...base, look: { ...base.look, families: ['toon'], materials, post } });
}

it('admits both G169 looks as shard looks, their stacks within budget v1 and their blend summed', () => {
  const pastel = look('pastel-plain', { plain: { family: 'graph', graph: pastelGraph() }, ground: { family: 'graph', preset: { family: 'painterly', colour: [0.82, 0.74, 0.9] }, version: 1 } }, [{ graph: pastelGrade }]);
  const ink = look('ink-valley', { rock: { family: 'graph', graph: inkGraph() }, ground: { family: 'graph', preset: { family: 'toon', colour: [0.93, 0.89, 0.78] }, version: 1 } }, [{ graph: inkPostGraph() }]);
  expect(shardfileRules(pastel)).toEqual([]);
  expect(shardfileRules(ink)).toEqual([]);
  const a = postStackCost(pastel, () => undefined), b = postStackCost(ink, () => undefined);
  expect([a.errors, b.errors]).toEqual([[], []]);
  expect(b.cost.inputs).toEqual({ colour: true, depth: true, normal: true });
  expect(b.cost.instructions).toBeGreaterThan(POST_NORMAL_PREPASS_COST);
  expect(a.cost.instructions + b.cost.instructions).toBeLessThanOrEqual(POST_STACK_BUDGET.instructions);
  expect(postPairRefusal(a.cost, b.cost)).toBeNull();
});
