// ENGINE-FIT E1 / EXPLORE-WORLD X10 / E306 M6: one registry. A model's catalog entry rides the piece `place` / `listModel`
// register (src/engine/models/): the catalog lists every piece with one, once per model id (a later registration replaces an
// earlier one in place), and a piece without one is not in it; Explore's taps on batch meshes are the same registry's.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WorldRegistry, type ModelEntry } from '#engine-internal/world/registry';

const entry = (id: string, object: THREE.Object3D, live = true): ModelEntry => ({ id, category: 'buildings', live, object: () => object });

describe('one registry for the world and Explore', () => {
  it('lists pieces carrying a model entry, once per model id; taps are the same registry\'s', () => {
    const reg = new WorldRegistry();
    const hut = new THREE.Group(), jetty0 = new THREE.Group(), jetty1 = new THREE.Group(), trail = new THREE.Group(), palm = new THREE.Group();
    reg.add({ id: 't-hut', name: 'Hut', category: 'buildings', file: 'src/shards/driftwood-isle/world/Hut.ts', object: hut, colliders: [], model: entry('t-hut', hut) });
    reg.add({ id: 't-jetty-0', name: 'Jetty', category: 'buildings', file: 'src/shards/driftwood-isle/world/Pier.ts', object: jetty0, model: entry('t-jetty', jetty0) });
    reg.add({ id: 't-jetty-1', name: 'Jetty', category: 'buildings', file: 'src/shards/driftwood-isle/world/Pier.ts', object: jetty1 }); // not in the catalog
    reg.add({ id: 't-trailside', name: 'Trailside', category: 'props', file: 'src/shards/driftwood-isle/world/Trailside.ts', object: trail }); // not in the catalog
    reg.add({ id: 'model:t-palm', name: 'Coconut palm', category: 'nature', file: 'src/shards/driftwood-isle/world/Palms.ts', model: { ...entry('t-palm', palm, false), category: 'nature' } });
    reg.add({ id: 'model:t-palm', name: 'Coconut palm 2', category: 'nature', file: 'src/shards/driftwood-isle/world/Palms.ts', model: { ...entry('t-palm', palm, false), category: 'nature' } });
    const models = reg.models();
    expect(models.map((m) => m.id)).toEqual(['t-hut', 't-jetty', 't-palm']);
    const [h, j, p] = models;
    expect(h?.live).toBe(true);
    expect(h?.object()).toBe(hut);
    expect(h?.category).toBe('buildings');
    expect(j?.object()).toBe(jetty0);
    expect(p?.live).toBe(false);
    expect(p?.name).toBe('Coconut palm 2');
    expect(p?.category).toBe('nature');
    const mesh = new THREE.Group();
    reg.addPick({ object: mesh, entry: 't-palm' });
    expect(reg.picks.some((k) => k.object === mesh)).toBe(true);
  });
});
