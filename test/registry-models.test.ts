// ENGINE-FIT E1 / EXPLORE-WORLD X10: one registry. A built piece added once to the world registry with `model` is in
// Explore's catalog (registeredModels) — its object, its file, a catalog id of its own when asked — and a model-only
// entry (one palm out of a batch) sits in the same list; re-registering an id replaces it in place.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { activeRegistry } from '../src/world/registry';
import { registerModel, registerPick, registeredModels, registeredPicks } from '../src/explore/registry';

describe('one registry for the world and Explore', () => {
  it('lists built pieces marked as models, model-only entries, and taps, from the one registry', () => {
    const reg = activeRegistry();
    const hut = new THREE.Group(), jetty0 = new THREE.Group(), jetty1 = new THREE.Group(), trail = new THREE.Group();
    reg.add({ id: 't-hut', name: 'Hut', category: 'buildings', file: 'src/world/Hut.ts', object: hut, colliders: [], model: {} });
    reg.add({ id: 't-jetty-0', name: 'Jetty', category: 'buildings', file: 'src/world/Pier.ts', object: jetty0, model: { id: 't-jetty' } });
    reg.add({ id: 't-jetty-1', name: 'Jetty', category: 'buildings', file: 'src/world/Pier.ts', object: jetty1 }); // not in the catalog
    reg.add({ id: 't-trailside', name: 'Trailside', category: 'props', file: 'src/world/Trailside.ts', object: trail }); // not in the catalog
    registerModel({ id: 't-palm', name: 'Coconut palm', category: 'nature', file: 'src/world/Palms.ts', live: false, object: () => new THREE.Group() });
    registerModel({ id: 't-palm', name: 'Coconut palm 2', category: 'nature', file: 'src/world/Palms.ts', live: false, object: () => new THREE.Group() });
    const models = registeredModels().filter((m) => m.id.startsWith('t-'));
    expect(models.map((m) => m.id)).toEqual(['t-hut', 't-jetty', 't-palm']);
    const [h, j, p] = models;
    expect(h?.live).toBe(true);
    expect(h?.object()).toBe(hut);
    expect(h?.category).toBe('buildings');
    expect(j?.object()).toBe(jetty0);
    expect(p?.live).toBe(false);
    expect(p?.name).toBe('Coconut palm 2');
    const mesh = new THREE.Group();
    registerPick({ object: mesh, entry: 't-palm' });
    expect(registeredPicks().some((k) => k.object === mesh)).toBe(true);
    expect(reg.picks.some((k) => k.object === mesh)).toBe(true);
  });
});
