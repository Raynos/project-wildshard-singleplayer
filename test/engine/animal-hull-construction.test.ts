import { afterEach, expect, it, vi } from 'vitest';
import { BoxGeometry, MeshLambertMaterial, Texture } from 'three';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { AnimalFactory } from '../../src/engine/entities/AnimalFactory';
import { registeredSpecies, type SpeciesDef } from '../../src/engine/entities/species/registry';
import type { CreatureHull, SpeciesLook } from '../../src/engine/entities/species/look';
import * as geometryMerge from '../../src/engine/models/animalGeometry';
import { fakeWorld } from '../fake/world';

afterEach(() => { vi.restoreAllMocks(); });

function fixture(material: boolean, lowPoly = false) {
  const world = fakeWorld();
  const owner = new Scope('hull.construction'), previous = app.levelScope;
  app.levelScope = owner;
  const base = registeredSpecies('boar'), bodies: ReturnType<SpeciesDef['build']>[] = [];
  const disposers: ReturnType<typeof vi.spyOn>[] = [];
  const geometry = new BoxGeometry(), map = new Texture(), mat = new MeshLambertMaterial();
  const hulls: CreatureHull[] = [];
  const skin: NonNullable<SpeciesLook['skin']> = (_variant, bones) => {
    const hull = { geometry, map, normalMap: null, bones: [...bones], overgrown: false };
    hulls.push(hull); return hull;
  };
  const look: SpeciesLook = { kind: base.kind, rigContract: base.rigContract, fur: base.fur,
    id: 'fixture.hull', species: 'fixture.boar', variants: {},
    build: (variant, rng) => {
      const body = base.build(variant, rng); bodies.push(body);
      for (const part of [...body.furParts, ...body.hardParts, ...body.eyeParts]) disposers.push(vi.spyOn(part, 'dispose'));
      return body;
    }, skin, ...(material ? { material: () => mat } : {}) };
  app.species.registerRow({ id: 'fixture.boar', kind: base.kind, label: base.label, variants: base.variants }, owner);
  app.species.registerLook(look, owner);
  const factory = owner.run(() => new AnimalFactory(world.sky, { render: { lowPoly, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true } }));
  const done = (): void => { owner.dispose(); app.levelScope = previous; geometry.dispose(); map.dispose(); mat.dispose(); };
  return { factory, look, bodies, disposers, hulls, geometry, map, mat, done };
}

it.each([false, true])('uses the exact replacement hull without merging discarded source geometry (custom material=%s)', material => {
  const f = fixture(material), merge = vi.spyOn(geometryMerge, 'mergeAnimalGeometry');
  try {
    const groups = f.geometry.groups.map(group => ({ ...group }));
    const model = f.factory.model('boar', 'boar');
    expect(merge).not.toHaveBeenCalled(); expect(f.bodies).toHaveLength(1); expect(f.hulls).toHaveLength(1);
    expect(model.geometry).toBe(f.geometry); expect(model.geometry.groups).toEqual(groups);
    expect(model.bones).toBe(f.hulls[0]?.bones); expect(model.dims).toBe(f.bodies[0]?.dims);
    expect(f.disposers.length).toBeGreaterThan(0);
    for (const dispose of f.disposers) expect(dispose).toHaveBeenCalledTimes(1);
    expect(f.factory.model('boar', 'boar')).toBe(model); expect(f.bodies).toHaveLength(1);
    if (material) { expect(model.fur).toBe(f.mat); expect(model.map).toBe(f.map); }
    else expect(model.fur.map).toBe(f.map);
  } finally { f.done(); }
});

it('retains the ordinary merged fallback buffers and single-material groups when the hull is not ready', () => {
  const f = fixture(true), merge = vi.spyOn(geometryMerge, 'mergeAnimalGeometry');
  f.look.skin = () => null;
  try {
    const model = f.factory.model('boar', 'boar'), body = f.bodies[0];
    if (body === undefined) throw new Error('Species body was not built');
    expect(merge).toHaveBeenCalledTimes(1);
    const expected = geometryMerge.mergeAnimalGeometry(body.furParts.map(p => p.clone()), body.hardParts.map(p => p.clone()), body.eyeParts.map(p => p.clone()));
    try {
      for (const [key, value] of Object.entries(expected.attributes)) expect(Array.from(model.geometry.getAttribute(key).array)).toEqual(Array.from(value.array));
      expect(Array.from(model.geometry.index?.array ?? [])).toEqual(Array.from(expected.index?.array ?? []));
      expect(model.geometry.groups).toEqual([{ start: 0, count: model.geometry.index?.count ?? model.geometry.getAttribute('position').count, materialIndex: 0 }]);
      expect(model.fur).toBe(f.mat); expect(model.bones).toBe(body.bones); expect(model.dims).toBe(body.dims);
      for (const dispose of f.disposers) expect(dispose).toHaveBeenCalledTimes(1);
    } finally { expected.dispose(); }
  } finally { f.done(); }
});

it('keeps the low-poly path independent of a replacement skin callback', () => {
  const f = fixture(false, true), skin = vi.fn<NonNullable<SpeciesLook['skin']>>(() => { throw new Error('not selected'); });
  f.look.skin = skin;
  try { expect(f.factory.model('boar', 'boar').style).toBe('toon'); expect(skin).not.toHaveBeenCalled(); }
  finally { f.done(); }
});

it.each([false, true])('releases all source parts when a replacement callback fails (custom material=%s)', material => {
  const f = fixture(material);
  f.look.skin = () => { throw new Error('hull failure'); };
  try {
    expect(() => f.factory.model('boar', 'boar')).toThrow('hull failure');
    for (const dispose of f.disposers) expect(dispose).toHaveBeenCalledTimes(1);
    expect(() => f.factory.model('boar', 'boar')).toThrow('hull failure'); expect(f.bodies).toHaveLength(2);
    for (const dispose of f.disposers) expect(dispose).toHaveBeenCalledTimes(1);
  } finally { f.done(); }
});
