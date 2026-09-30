// E306 / E315 M5: live models — the creatures the AnimalManager spawns, the people, the gear the player holds, the
// training dummy — are defined like every model but never placed: a shard lists its roster (`listModel` / `listRoster`,
// src/models/live.ts), one catalog entry per model whether or not a copy is alive, and the live system keeps drawing them.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WorldRegistry } from '../src/world/registry';
import type { Sky } from '../src/world/Sky';
import { defineModel, modelContext } from '../src/models/model';
import { listModel, listRoster, live } from '../src/models/live';
import { creature } from '../src/models/creature';
import { speciesDef } from '../src/entities/AnimalFactory'; // (the factory registers every species file)
import { checkModels } from '../scripts/check-models.mjs';

const sky = { setupMaterial(_m: THREE.Material): void { /* nothing to prepare */ } } as Sky;
const ctx = modelContext(sky);
const mat = new THREE.MeshBasicMaterial();

describe('live models (E315 M5)', () => {
  it('listModel: one catalog entry, no copies drawn, its facts and variants; listing again is a no-op', () => {
    const lantern = defineModel<{ tall: boolean }>({
      id: 'shared/test-live-lantern', name: 'Hand lantern', category: 'gear', pipeline: 'blender', file: 'test/models-live.test.ts', defaults: { tall: false },
      variants: [{ id: 'short', label: 'Short', params: { tall: false } }, { id: 'tall', label: 'Tall', params: { tall: true } }],
      build: (_c, p) => [{ geometry: new THREE.BoxGeometry(0.1, p.tall ? 0.4 : 0.2, 0.1), material: mat }],
    });
    const reg = new WorldRegistry();
    let held = 1;
    listModel(lantern, { ctx, copies: () => held, registry: reg });
    listModel(lantern, { ctx, copies: 7, registry: reg });
    expect(reg.pieces).toHaveLength(1);
    const piece = reg.pieces[0];
    expect(piece?.object).toBeUndefined(); // nothing drawn in the world
    expect(piece?.colliders).toBeUndefined();
    const [m] = reg.models();
    expect(m).toMatchObject({ id: 'shared/test-live-lantern', name: 'Hand lantern', category: 'gear', pipeline: 'blender', drawnAs: 'single', live: false, worldView: false });
    expect(m?.copies).toBe(1);
    held = 2;
    expect(reg.models()[0]?.copies).toBe(2); // read when the catalog is
    const specimen = m?.object();
    const size = (): number => new THREE.Box3().setFromObject(specimen ?? new THREE.Group()).getSize(new THREE.Vector3()).y;
    expect(size()).toBeCloseTo(0.2, 6);
    expect(m?.variants?.map((v) => v.id)).toEqual(['short', 'tall']);
    m?.rebuild?.('tall');
    expect(size()).toBeCloseTo(0.4, 6);
  });

  it('a creature is its species: the coats as variants, the rig names the species, skinned; its copies are the live animals of that kind', () => {
    const boar = defineModel({ id: 'shared/test-live-boar', file: 'test/models-live.test.ts', pipeline: 'code', ...creature('boar') });
    const sp = speciesDef('boar');
    expect(boar.name).toBe(sp.label);
    expect(boar.category).toBe('creatures');
    expect(boar.rig?.species).toBe('boar');
    expect(boar.rig?.clips).toEqual(['idle', 'walk', 'trot', 'charge', 'hit', 'die']);
    expect(boar.variants?.map((v) => v.id)).toEqual(sp.variants.map((v) => v.id));
    expect(boar.defaults.variant).toBe(sp.variants[0]?.id);
    const withThrall = creature('boar', { spawnOnly: true });
    expect(withThrall.variants?.map((v) => v.id)).toEqual([...sp.variants, ...(sp.spawnOnly ?? [])].map((v) => v.id));

    const king = defineModel({ id: 'shared/test-live-king', file: 'test/models-live.test.ts', pipeline: 'hunyuan', ...creature('bear', { name: 'A boss' }) });
    const reg = new WorldRegistry();
    const animals = [{ kind: 'boar' }, { kind: 'deer' }, { kind: 'boar' }];
    listRoster([live(boar, { pipeline: 'hunyuan' }), live(king, { planned: 1 })], ctx, () => animals, reg);
    const [b, k] = reg.models();
    expect(b).toMatchObject({ id: 'shared/test-live-boar', species: 'boar', drawnAs: 'skinned', pipeline: 'hunyuan', copies: 2 });
    expect(k).toMatchObject({ id: 'shared/test-live-king', name: 'A boss', species: 'bear', copies: 1 }); // none alive: its planned copy
  });

  it('check-models rule 8: a species rig with no model fails; creature(kind) or rig.species (a string constant too) is its model', () => {
    const species = { 'src/entities/species/newt.ts': "const NEWT = 'newt';\nregisterSpecies({ kind: NEWT, label: 'Newt' });" };
    expect(checkModels(species).violations.some((v) => v.includes("'newt' is no model"))).toBe(true);
    const model = { 'src/chunks/test-shard/models/newt.ts': "export const newt = defineModel({ id: 'test-shard/newt', file: 'x', pipeline: 'code', ...creature('newt') });" };
    expect(checkModels({ ...species, ...model }).violations).toEqual([]);
    const rig = { 'src/chunks/test-shard/models/newt.ts': "const NEWT = 'newt';\nexport const newt = defineModel({ id: 'test-shard/newt', rig: { clips: [], species: NEWT } });" };
    expect(checkModels({ ...species, ...rig }).violations).toEqual([]);
  });
});
