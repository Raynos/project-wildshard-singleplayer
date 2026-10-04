import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { AnimalFactory, DEFAULT_CREATURE_RENDER } from '../../src/engine/entities/AnimalFactory';
import { registeredSpecies } from '../../src/engine/entities/species/registry';
import type { SpeciesLook, CreatureHull } from '../../src/engine/entities/species/look';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { fakeWorld } from '../fake/world';

/**
 * E357 R1: Pine's creatures are one rigged hull per variant (one group, no fur shells, no shadow caster, one far-herd batch
 * per model). The hull strategy is a speciesLook row the plugin registers in its level.kit hook, so the boot must build the
 * animals after that hook. Built before it (S2.3), every Pine creature fell back to the procedural body: 337 skinned
 * meshes instead of 170, +24 geometries and the coats' atlases gone.
 */
const session = Object.values(import.meta.glob<string>('../../src/game/session/session.ts', { query: '?raw', import: 'default', eager: true }))[0] ?? '';

describe('creature hulls follow the kit rows', () => {
  it('builds the animals in the loadout section, after the plugin kit hook registered its rows', () => {
    const stages = session;
    const kit = stages.indexOf("yield 'kit'"), loadout = stages.indexOf("yield 'loadout'"), animals = stages.indexOf('await loadoutStage(');
    expect(kit).toBeGreaterThan(-1); expect(animals).toBeGreaterThan(-1);
    // The engine completes the plugin kit hook at the loadout yield before advancing the session adapter.
    expect(loadout).toBeGreaterThan(kit);
    expect(animals).toBeGreaterThan(loadout);
  });

  it('preloads the scoped hulls and shares one hull model, geometry and far material per variant', async () => {
    const f = fakeWorld(), scope = new Scope('r1-level'), previous = app.levelScope;
    const preload = vi.fn(() => Promise.resolve());
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.computeBoundingSphere();
    const map = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const skin = vi.fn((_v: unknown, bones: CreatureHull['bones']): CreatureHull => ({ geometry, map, normalMap: null, bones: [...bones], overgrown: false }));
    const look: SpeciesLook = { ...registeredSpecies('deer'), variants: {}, id: 'r1.look.deer', species: 'r1.deer', kind: 'deer', preload, skin: (v, bones) => skin(v, [...bones]) };
    app.levelScope = scope;
    try {
      app.species.registerLook(look, scope);
      const factory = new AnimalFactory(f.sky, { style: 'pbr', render: DEFAULT_CREATURE_RENDER });
      await factory.ready;
      expect(preload).toHaveBeenCalledTimes(1);
      const model = factory.model('deer', 'hind');
      expect(model.hull).toEqual({ overgrown: false });
      expect(model.shells).toEqual([]);
      expect(model.geometry).toBe(geometry);
      expect(factory.model('deer', 'hind')).toBe(model);
      expect(skin).toHaveBeenCalledTimes(1);
      const a = factory.instantiate(model, 0.2), b = factory.instantiate(model, 0.8);
      expect(a.mesh.geometry).toBe(b.mesh.geometry);
      expect(Array.isArray(a.mesh.material) ? a.mesh.material.length : 1).toBe(1);
      expect(factory.farMaterial(model)).not.toBeNull();
    } finally {
      app.levelScope = previous;
      scope.dispose();
      geometry.dispose(); map.dispose();
    }
  });
});
