// oxlint-disable-next-line import/no-nodejs-modules -- Verify the emitted GLB against its original authoring geometry.
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { MeshBasicMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildSabre as authorSabre, SABRE_PROFILE as authorProfile, PASS_LEFT, PASS_RIGHT } from '../src/shards/nalati-grasslands/generators/sabre';
import { buildSabre, prepareSabre, sabreProfile } from '../src/shards/nalati-grasslands/runtime/weapons/mountedSword';
import { emptyShardfile } from '../src/sdk/author';
import { parseItems } from '../src/format/items';
import items from '../src/shards/nalati-grasslands/data/items.json' with { type: 'json' };
import rows from '../src/shards/nalati-grasslands/data/sabre.generated.json' with { type: 'json' };

test('baked sabre preserves every move, contact, mounted coefficient and mutable geometry channel', async () => {
  const key = (row: typeof PASS_LEFT.keys[number]) => ({ t: row.t, pos: row.pos.toArray(), q: row.q.toArray() });
  for (const [name, move] of [['left', PASS_LEFT], ['right', PASS_RIGHT]] as const) {
    expect(rows.moves.passes[name]).toEqual({ ...move, keys: move.keys.map(key), trail: { ...move.trail, color: move.trail.color.toArray() } });
  }
  const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(readFileSync(`public${rows.pool.url}`)).buffer, '');
  const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
  const material = new MeshBasicMaterial();
  try {
    await prepareSabre({ shardfile: { ...emptyShardfile({ slug: 'sabre-test', name: 'Sabre', author: 'Wildshard', revision: 1, seed: 1 }), items: parseItems(items) }, file: () => Promise.resolve(new TextEncoder().encode(JSON.stringify(rows))) });
    expect(sabreProfile()).toEqual(authorProfile);
    const before = authorSabre(material, material), after = buildSabre(material, material), second = buildSabre(material, material);
    expect({ tipY: after.tipY, baseY: after.baseY, tipX: after.tipX }).toEqual({ tipY: before.tipY, baseY: before.baseY, tipX: before.tipX });
    const oldParts = [before.sword, before.arms, ...(before.extras ?? []).map(part => part.geometry)];
    const parts = [after.sword, after.arms, ...(after.extras ?? []).map(part => part.geometry)];
    for (const [index, part] of parts.entries()) {
      const original = oldParts[index];
      if (original === undefined) throw new Error('Missing authored part');
      expect(Object.keys(part.attributes).sort()).toEqual(Object.keys(original.attributes).sort());
      for (const name of Object.keys(original.attributes)) expect(part.getAttribute(name).array).toEqual(original.getAttribute(name).array);
      expect(part.index?.array).toEqual(original.index?.array); expect(part.groups).toEqual(original.groups);
      part.dispose(); original.dispose();
    }
    expect(second.sword).not.toBe(after.sword);
    expect(second.sword.getAttribute('color').array).not.toBe(after.sword.getAttribute('color').array);
    second.sword.dispose(); second.arms.dispose(); for (const part of second.extras ?? []) part.geometry.dispose();
  } finally { load.mockRestore(); material.dispose(); }
});
