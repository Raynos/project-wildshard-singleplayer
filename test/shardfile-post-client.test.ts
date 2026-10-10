// SF59 step 4: a shard's admitted post stack on the client: compiled into composer passes before the engine's colour
// pass, a normal pre-pass once when a pass reads sceneNormal, the depth texture asked for, faded by the owner weight,
// default off, removed with the scope.
import { expect, it } from 'vitest';
import * as THREE from 'three';
import { Pass } from 'postprocessing';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/game/shardfile/schema';
import { Scope } from '@wildshard/engine/app/scope';
import { attachOutline, compileGraph, GraphNormalPrepass, GraphPostPass } from '../src/engine/render/graph/compile';
import type { GraphCompiler } from '../src/engine/render/graphBackend';
import { clientPostStack } from '../src/game/shardfile/clientPost';
import { inkPostGraph } from '../scripts/tsl-spike/stress.js';

const grade = { version: 1, kind: 'post', nodes: { c: { op: 'sceneColour' }, rgb: { op: 'swizzle', in: ['c'], mask: 'xyz' }, out: { op: 'mul', in: ['rgb', [1, 0.95, 0.9]] } }, stages: { post: { colour: 'out' } } };
function shard(post: unknown[]) {
  const base = emptyShardfile({ slug: 'post-client', name: 'Post client', author: 'Local', seed: 1, revision: 1 });
  return parseShardfile({ ...base, look: { ...base.look, post } });
}
const compiler: GraphCompiler = { compileGraph, attachOutline, GraphPostPass, GraphNormalPrepass };
function composer() {
  const passes: Pass[] = [new Pass('RenderPass'), new Pass('EffectPass'), new Pass('EffectPass')];
  return { passes, addPass: (pass: Pass, index?: number) => { passes.splice(index ?? passes.length, 0, pass); }, removePass: (pass: Pass) => { const i = passes.indexOf(pass); if (i !== -1) passes.splice(i, 1); } };
}
const page = (c: ReturnType<typeof composer> | null) => ({ compiler: () => Promise.resolve(compiler), composer: () => { if (c === null) throw new Error('Game.composer read before buildComposer()'); return c; }, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera() });

it('builds nothing while the Debug row is off or the shard has no stack', async () => {
  expect(await clientPostStack(shard([{ graph: grade }]), new Map(), page(composer()), new Scope('t'), { enabled: false })).toBeNull();
  expect(await clientPostStack(shard([]), new Map(), page(composer()), new Scope('t'), { enabled: true })).toBeNull();
});

it('inserts the passes before the colour pass once the composer exists, the normal pre-pass once, the depth asked for', async () => {
  const c = composer(), late = { ready: false };
  const scope = new Scope('post');
  const post = await clientPostStack(shard([{ graph: inkPostGraph() }, { graph: grade }]), new Map(), { ...page(c), composer: () => { if (!late.ready) throw new Error('not built'); return c; } }, scope, { enabled: true });
  if (post === null) throw new Error('expected a stack');
  expect(post.install()).toBe(false);
  late.ready = true;
  expect(post.install()).toBe(true);
  expect(c.passes.map((pass) => pass.name)).toEqual(['RenderPass', 'GraphNormalPrepass', 'GraphPostPass', 'GraphPostPass', 'EffectPass', 'EffectPass']);
  const [, normal, ink, tint] = c.passes;
  expect(normal).toBeInstanceOf(GraphNormalPrepass);
  expect(ink?.needsDepthTexture).toBe(true);
  expect(tint?.needsDepthTexture).toBe(false);
  expect(post.state()).toEqual({ passes: 3, weight: 1, normal: true });
  // the owner weight: 0 on the road disables every pass (no cost), a blend keeps them on
  post.weight(0);
  expect([normal, ink, tint].map((pass) => pass?.enabled)).toEqual([false, false, false]);
  post.weight(0.4);
  expect([normal, ink, tint].map((pass) => pass?.enabled)).toEqual([true, true, true]);
  scope.dispose();
  expect(c.passes.map((pass) => pass.name)).toEqual(['RenderPass', 'EffectPass', 'EffectPass']);
});

it('refuses a pass whose graph file is missing', async () => {
  const hash = 'e'.repeat(64);
  const base = emptyShardfile({ slug: 'post-client', name: 'Post client', author: 'Local', seed: 1, revision: 1 });
  const source = parseShardfile({ ...base, files: [{ hash, kind: 'json', compressed: 1, decoded: 1, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false }], library: [hash], look: { ...base.look, post: [{ file: hash }] } });
  await expect(clientPostStack(source, new Map(), page(composer()), new Scope('t'), { enabled: true })).rejects.toThrow('is not an admitted file');
  const bytes = new TextEncoder().encode(JSON.stringify(grade));
  const post = await clientPostStack(source, new Map([[hash, bytes]]), page(composer()), new Scope('t'), { enabled: true });
  expect(post?.install()).toBe(true);
});
