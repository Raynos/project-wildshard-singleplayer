import { expect, test } from 'vitest';
import { BufferAttribute, type BufferGeometry } from 'three';
import { output } from './fixtures/nine-source-program';
import baseline from './fixtures/nine-jian-buffers.json' with { type: 'json' };
import pendantsBaseline from './fixtures/nine-jian-pendants.json' with { type: 'json' };
import { parseGraphArms } from '../src/format/graphArmsRows';
import { worldScenePool } from '../src/game/shardfile/scenePools';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';

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
function blobBytes(name: string): Uint8Array {
  const file = output.namedFiles.find(row => row.name === name), value = file === undefined ? undefined : output.assets.get(file.hash);
  if (value === undefined) throw new Error(`Missing admitted Jian blob ${name}`);
  return value;
}
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Expected original held object');
  return Object.fromEntries(Object.entries(value));
}
function body(): Record<string, unknown> { return record(JSON.parse(new TextDecoder().decode(blobBytes('weapons/jian-row.json')))); }

async function restChannels(geometry: BufferGeometry): Promise<unknown> {
  const attributes = Object.fromEntries(await Promise.all(Object.entries(geometry.attributes).map(async ([name, attribute]) => {
    if (!(attribute instanceof BufferAttribute)) throw new Error('Jian channels stay ordinary buffers');
    return [name, { type: attribute.array.constructor.name, itemSize: attribute.itemSize, normalized: attribute.normalized,
      bytes: await hash(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)) }] as const;
  })));
  const sphere = geometry.boundingSphere;
  return { attributes, index: geometry.index === null ? null : { type: geometry.index.array.constructor.name,
    bytes: await hash(new Uint8Array(geometry.index.array.buffer, geometry.index.array.byteOffset, geometry.index.array.byteLength)) },
    boundingBox: geometry.boundingBox, boundingSphere: sphere === null ? null : { center: sphere.center.toArray(), radius: sphere.radius },
    groups: geometry.groups, drawRange: { start: geometry.drawRange.start, count: geometry.drawRange.count === Infinity ? 'all' : geometry.drawRange.count } };
}

// Captured from the actual pre-GLB JSON reader, including signed-zero storage and native bounds.
test('verified Jian GLB pools preserve every original channel, index and bound', async () => {
  const row = parseGraphArms(body()['view']);
  const identity = { slug: 'jian-buffers', name: 'Jian buffers', author: 'Wildshard', revision: 1, seed: 1 };
  const product = createShardProduct({ slug: identity.slug, revision: 1, shardfile: emptyShardfile(identity), sections: new Map(),
    files: new Map(output.namedFiles.map(file => {
      if (file.name === undefined) throw new Error('Missing named Jian file');
      return [file.name, { ...file, url: `https://example.test/${file.path}` }];
    })), read: digest => { const value = output.assets.get(digest); if (value === undefined) throw new Error('Missing original output bytes'); return Promise.resolve(value); } });
  const cloth: Readonly<Record<string, unknown>> = pendantsBaseline.cloth;
  const seen: string[] = [];
  for (const pool of row.pendants.geometry) {
    const library = worldScenePool(product, pool);
    await library.preload();
    try {
      for (const name of pool.files.flatMap(file => file.parts)) {
        const geometry = library.geometry(name);
        if (geometry === null) throw new Error(`Missing native Jian part ${name}`);
        seen.push(name);
        try {
          if (name === 'edge') {
            expect(await channels(geometry)).toEqual(baseline.halo);
            expect(geometry.boundingSphere).toBeNull(); expect(geometry.boundingBox).toBeNull();
            expect(geometry.groups).toEqual([]); expect(geometry.drawRange).toEqual({ start: 0, count: Infinity });
          }
          else { expect(cloth[name]).toBeDefined(); expect(await restChannels(geometry)).toEqual(cloth[name]); }
        } finally { geometry.dispose(); }
      }
    } finally { for (const name of pool.files.flatMap(file => file.parts)) library.geometry(name, { borrow: true })?.dispose(); }
  }
  expect(seen).toEqual(['knot', 'tassel', 'sheet', 'silk-strands', 'thin-hulls', 'edge']);
  expect(row.additive).toContain('nine-vm-edge');
  for (const name of ['weapons/jian-support.json', 'weapons/jian-cloth.json', 'weapons/jian-halo.json']) expect(output.namedFiles.some(file => file.name === name)).toBe(false);
  for (const name of ['weapons/jian-cloth.glb', 'weapons/jian-halo.glb']) expect(new DataView(Uint8Array.from(blobBytes(name)).buffer).getUint32(0, true)).toBe(0x46546c67);
});

test('the held row changes only its geometry references', async () => {
  const original = body(), view = record(original['view']), pendants = record(view['pendants']);
  const normalized = { ...original, view: { ...view, pendants: { ...pendants, geometry: [] } } };
  expect(await hash(new TextEncoder().encode(JSON.stringify(normalized)))).toBe(pendantsBaseline.nonGeometryRowSHA256);
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
