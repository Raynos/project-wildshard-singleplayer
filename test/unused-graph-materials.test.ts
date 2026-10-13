import { expect, it } from 'vitest';
import { WebGLRenderer } from 'three';
import { Scope } from '../src/engine/app/scope';
import { emptyShardfile } from '../src/sdk/author';
import { clientMaterials } from '../src/game/shardfile/clientMaterials';
import type { Shardfile } from '../src/format/shardSchema';

it('keeps unused graph fallback programs and textures out of preparation until a view requests the ID', async () => {
  const base = emptyShardfile({ slug: 'unused-graphs', name: 'Unused graphs', author: 'Fixture', revision: 1, seed: 1 });
  const hash = 'a'.repeat(64);
  const source: Shardfile = { ...base, look: { ...base.look, materials: {
    first: { family: 'graph', graph: { version: 1, kind: 'material', model: 'unlit', params: { book: { type: 'texture', value: hash } }, nodes: {}, stages: { surface: { colour: [1, 0, 0] } } } },
    second: { family: 'graph', graph: { version: 1, kind: 'material', model: 'unlit', nodes: {}, stages: { surface: { colour: [0, 1, 0] } } } },
  } } };
  const renderer: unknown = Object.create(WebGLRenderer.prototype);
  if (!(renderer instanceof WebGLRenderer)) throw new Error('Missing renderer fixture');
  const scope = new Scope('unused-graph-materials');
  try {
    // No texture bytes are needed for a graph's plain fallback. An actual graph compile still requires them.
    const looks = await clientMaterials(source, new Map(), renderer, scope, { graphs: false });
    const count = scope.census.materials;
    expect(looks.graphs.readout.fallback).toBe(0); expect(looks.textures.size).toBe(0);
    expect(looks.materials.has('first')).toBe(true); expect([...looks.materials.keys()]).toContain('first');
    expect(scope.census.materials).toBe(count);
    const first = looks.materials.get('first'); expect(first).toBeDefined();
    expect(looks.graphs.readout.fallback).toBe(1); expect(scope.census.materials).toBe(count + 1);
    expect(looks.materials.get('first')).toBe(first); expect(looks.graphs.readout.fallback).toBe(1);
    // The complete ReadonlyMap contract still resolves every entry when explicitly iterated.
    expect([...looks.materials.entries()].map(([id]) => id)).toContain('second');
    expect(looks.graphs.readout.fallback).toBe(2); expect(looks.materials.get('missing')).toBeUndefined();
  } finally { scope.dispose(); }
});
