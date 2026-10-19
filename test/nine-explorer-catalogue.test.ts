import { expect, test, vi } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, ShaderMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import { Rng } from '../src/engine/core/rng';
import { modelContext, type ModelPart } from '../src/engine/models/model';
import { createOwnedGeometryBatch, type OwnedGeometry } from '../src/engine/models/ownedGeometry';
import { SkyRig } from '../src/engine/world/skyRig';
import { bindLowPolyMaterial } from '../src/engine/world/lowpolyKit';
import { nativeSpecimen, type NdLook } from '../src/shards/nine-dragon-stack/world/modelLook';
import data from '../src/shards/nine-dragon-stack/data/explorerModels.json' with { type: 'json' };
import original from './fixtures/nine-explorer-models.json' with { type: 'json' };

function shape(key: string): BufferGeometry {
  const n = key.split('').reduce((sum, character) => sum + (character.codePointAt(0) ?? 0), 0) / 100;
  return new BufferGeometry().setAttribute('position', new Float32BufferAttribute([n, 2, 3, 4, n, 6, 7, 8, n], 3));
}
function fixture(resident: boolean, owner: Scope) {
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing fixture sky');
  const ctx = modelContext(sky, null), batch = createOwnedGeometryBatch(), specimens = new Map<string, OwnedGeometry>();
  const materials = ['kit', 'facade', 'small'].map(name => Object.assign(new ShaderMaterial(), { name }));
  const [mat, facade, small] = materials;
  if (mat === undefined || facade === undefined || small === undefined) throw new Error('Missing fixture looks');
  const unbind = bindLowPolyMaterial(sky, 'nine-architecture', mat, owner);
  const geometry: BufferGeometry[] = [];
  for (const key of new Set(data.sources.map(row => row.key))) {
    const handle = batch.geometry(key), source = shape(key); geometry.push(source); handle.adopt(source); specimens.set(key, handle);
  }
  const panel = shape('resident-panel'); geometry.push(panel);
  const look: NdLook = { owner, facade: { mat: facade, small }, lantern: null, neon: null, canLod: false,
    geo: new Map(resident ? [['set:balustrade-panel', panel]] : []), hookMat: null, canopy: null, specimens, explorer: new Map() };
  ctx.once('nine-dragon-stack:look', () => look);
  return { ctx, look, mat, dispose: () => { unbind(); for (const source of geometry) source.dispose(); for (const material of materials) material.dispose(); } };
}
const signature = (parts: readonly ModelPart[]) => parts.map(part => ({ position: Array.from(part.geometry.getAttribute('position').array),
  material: part.material.name, castShadow: part.castShadow ?? false, receiveShadow: part.receiveShadow ?? false, renderOrder: part.renderOrder ?? 0 }));

test.each(original)('$key retains native metadata, variants, colliders and every draw on both source paths', row => {
  const model = nativeSpecimen(row.key), owner = new Scope(row.key);
  try {
    expect(Object.fromEntries(Object.keys(row.model).map(key => [key, Reflect.get(model, key)]))).toEqual(row.model);
    expect(model.colliders !== undefined).toBe(row.colliding);
    expect(model.specimenLifetime).toBeUndefined();
    expect(model.lods?.map(level => ({ from: level.from })) ?? []).toEqual(row.lods);
    const states = [];
    for (const resident of [false, true]) {
      const source = fixture(resident, owner);
      try {
        for (const choice of row.choices) {
          expect(model.colliders?.(choice.params, source.ctx) ?? []).toEqual(choice.colliders);
          const builds = [{ level: 'near', build: model.build }, ...(model.lods ?? []).map((level, i) => ({ level: String(i), build: level.build }))];
          for (const entry of builds) {
            const built = withOwner(owner, () => entry.build(source.ctx, choice.params, new Rng(0)));
            if (!Array.isArray(built)) throw new Error('Prepared native models require their original parts');
            states.push({ resident, params: choice.params, level: entry.level, parts: signature(built as readonly ModelPart[]) });
          }
        }
      } finally { source.dispose(); }
    }
    expect(states).toEqual(row.states);
  } finally { owner.dispose(); }
});

test('a missing native specimen refuses without substituting another asset', () => {
  const owner = new Scope('missing-specimen'), source = fixture(false, owner);
  try {
    source.look.specimens?.delete('kit:plant');
    expect(() => withOwner(owner, () => nativeSpecimen('galleryPlant').build(source.ctx, {}, new Rng(0)))).toThrow('specimen kit:plant');
  } finally { owner.dispose(); source.dispose(); }
});

test('unvisited lazy variants stay in the native template pool', () => {
  const owner = new Scope('unvisited-variants'), source = fixture(false, owner);
  try {
    const boot = source.look.specimens, explorer = source.look.explorer;
    if (boot === null || !(explorer instanceof Map)) throw new Error('Missing native template pools');
    for (const key of ['paifang:square', 'paifang:stair', 'paifang:well']) {
      const handle = boot.get(key);
      if (handle === undefined) throw new Error('Missing variant template');
      explorer.set(key, handle); boot.delete(key);
    }
    const unvisited = explorer.get('paifang:stair');
    if (unvisited === undefined) throw new Error('Missing unvisited template');
    const copy = vi.spyOn(unvisited, 'copy'), model = nativeSpecimen('paifang');
    const built = withOwner(owner, () => model.build(source.ctx, model.defaults, new Rng(0)));
    expect(copy).not.toHaveBeenCalled();
    if (!Array.isArray(built)) throw new Error('Prepared native card requires parts');
    for (const part of built as readonly ModelPart[]) part.geometry.dispose();
  } finally { owner.dispose(); source.dispose(); }
});

test.each(['marketBooth', 'parasolTable', 'diningPavilion', 'guardianLion'])('%s uses authored draws and collider choices', key => {
  const row = data.catalogue.models.find(model => model.key === key);
  if (row === undefined) throw new Error('Missing authored model');
  const model = nativeSpecimen(key), owner = new Scope(key), source = fixture(false, owner);
  try {
    for (const choice of row.choices) {
      const built = withOwner(owner, () => model.build(source.ctx, choice.params, new Rng(0)));
      if (!Array.isArray(built)) throw new Error('Prepared catalogue needs its native parts');
      expect(built).toHaveLength(1);
      expect((built as readonly ModelPart[])[0]?.material).toBe(source.mat);
      expect(model.colliders?.(choice.params, source.ctx) ?? []).toEqual(choice.colliders);
    }
    if (key === 'guardianLion') expect(model.lods?.map(level => level.from)).toEqual([10, 30]);
    if (key === 'diningPavilion') {
      expect(row.choices).toHaveLength(4);
      for (const choice of row.choices) {
        expect(choice.colliders).toHaveLength(5);
        const turn: unknown = Reflect.get(choice.params, 'turn');
        if (typeof turn !== 'number') throw new Error('Pavilion needs its turn');
        for (const collider of choice.colliders) expect(Reflect.get(collider, 'yaw')).toBeCloseTo(-turn, 12);
      }
    }
  } finally { owner.dispose(); source.dispose(); }
});
