import { expect, test } from 'vitest';
import * as v from 'valibot';
import { BufferAttribute, BufferGeometryLoader, MaterialLoader, ShaderMaterial, type BufferGeometry } from 'three';
import { output } from '../src/shards/nine-dragon-stack/generators/output';
import baseline from './fixtures/nine-jian-buffers.json' with { type: 'json' };

async function hash(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}
async function channels(geometry: BufferGeometry): Promise<unknown> {
  return { attributes: Object.fromEntries(await Promise.all(Object.entries(geometry.attributes).map(async ([key, attribute]) => {
    if (!(attribute instanceof BufferAttribute)) throw new Error('Jian channels stay ordinary buffers');
    return [key, {
    type: attribute.array.constructor.name, size: attribute.itemSize, normalized: attribute.normalized,
    hash: await hash(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)),
  }] as const; }))), index: geometry.index === null ? null : { type: geometry.index.array.constructor.name,
    hash: await hash(new Uint8Array(geometry.index.array.buffer, geometry.index.array.byteOffset, geometry.index.array.byteLength)) } };
}
function blob(name: string): unknown {
  const file = output.namedFiles.find(row => row.name === name), bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error(`Missing admitted Jian blob ${name}`);
  return JSON.parse(new TextDecoder().decode(bytes), (_key, value: unknown) => value === '-0' ? -0 : value);
}

// Captured from the original live halo before deleting its runtime producer.
test('named Jian halo preserves every original vertex and index byte', async () => {
  const halo = v.parse(v.strictObject({ geometry: v.unknown(), material: v.unknown() }), blob('weapons/jian-halo.json'));
  expect(output.namedFiles.some(row => row.name === 'weapons/jian-support.json')).toBe(false);
  const loader = new BufferGeometryLoader();
  expect(await channels(loader.parse(halo.geometry))).toEqual(baseline.halo);
  const material = new MaterialLoader().parse(halo.material);
  expect(material).toBeInstanceOf(ShaderMaterial);
  expect(material).toMatchObject({ transparent: true, depthWrite: false, blending: 5, blendSrc: 201, blendDst: 201, blendSrcAlpha: 200, blendDstAlpha: 201,
    uniforms: { uRes: { value: { x: 1, y: 1 } }, uPx: { value: 14 }, uTime: { value: 0 }, uGain: { value: 1 } } });
});

test('held effects are admitted graph rows with independent frame params', async () => {
  const { heldEffects } = await import('../src/shards/nine-dragon-stack/generators/heldEffects');
  const { compileGraph } = await import('../src/engine/render/graph/compile');
  for (const [id, row] of Object.entries(heldEffects())) {
    const graph = compileGraph(row, { trustedBudget: true });
    try {
      expect(graph.cost.nodes).toBeGreaterThan(0);
      if (id === 'nine-vm-edge') {
        expect(row.stages['vertex.clip']).toBeDefined();
        graph.setParam('resolution', [1206, 2622]); graph.setParam('pixels', 21);
        graph.setParam('time', 1); graph.setParam('projection', [1, 1, -1, -.2]);
      } else {
        expect(Object.values(row.nodes).some(node => node.op === 'attribute' && node.name === 'aAge')).toBe(true);
        graph.setParam('seed', 17);
      }
    } finally { graph.material.dispose(); }
  }
});
