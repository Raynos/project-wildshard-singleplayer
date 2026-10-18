// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { BufferGeometry, Material, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { SkyRig } from '@wildshard/engine/world/skyRig';
import { live } from '@wildshard/engine/models/live';
import { modelContext, seedOf, type ModelDef, type ModelPart } from '@wildshard/engine/models/model';
import * as lowPolyKit from '@wildshard/engine/world/lowpolyKit';
import { driftwoodFixedProduct } from './fixtures/driftwoodFixedProduct';
import * as runtimeProduct from '../src/game/shardfile/runtimeProduct';
import { loadFixedGeometry, fixedGeometryReady, fixedDraw, fixedGeometryGroups, COLLECTIONS } from '../src/shards/driftwood-isle/runtime/boot/blobAssets';
import { sites } from '../src/shards/driftwood-isle/models/catalogue';
import { bindWorldSceneModelSources } from '../src/game/models/worldSceneCatalogue';
import { parseWorldSceneModels } from '../src/format/worldSceneModels';
import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';
import { Scope } from '../src/engine/app/scope';
import cargo from '../src/shards/driftwood-isle/data/cargoScenes.generated.json' with { type: 'json' };
import boot from '../src/shards/driftwood-isle/boot/modelCatalogue.generated.json' with { type: 'json' };
import { captainHat, sailclothCape } from '../src/shards/driftwood-isle/runtime/models/captainHat';
import { castaway } from '../src/shards/driftwood-isle/runtime/models/people';
import { trader, tradeCounter } from '../src/shards/driftwood-isle/runtime/models/trader';

const barrel = sites.model('barrel'), crate = sites.model('crate'), ropeCoil = sites.model('ropeCoil');
const entries = [live(captainHat), live(sailclothCape), live(castaway), live(trader), live(tradeCounter)];

it('forwards cold fixed preparation to the existing live roster', () => {
  expect(fixedGeometryReady()).toBe(false);
  for (const entry of entries) expect(entry.prepare).toBe(loadFixedGeometry);
  expect(() => captainHat.build(modelContext(SkyRig.prototype), captainHat.defaults, new Rng(1))).toThrow('not loaded');
  for (const def of [barrel, crate, ropeCoil]) expect(live(def).prepare).toBeUndefined();
});

async function geometryHash(geometry: BufferGeometry): Promise<string> {
  const values: string[] = [];
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    values.push(name, JSON.stringify([attribute.itemSize, attribute.normalized, Array.from(attribute.array)]));
  }
  values.push(JSON.stringify({index: geometry.index === null ? null : Array.from(geometry.index.array), drawRange: geometry.drawRange, groups: geometry.groups}));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(values.join(''))));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}

const isGeometry = (value: unknown): value is BufferGeometry => value instanceof BufferGeometry;
const isMaterial = (value: unknown): value is Material => value instanceof Material;

function partsOf(built: readonly ModelPart[] | Object3D): readonly ModelPart[] {
  if (!(built instanceof Object3D)) return built;
  const parts: ModelPart[] = [];
  built.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const geometry: unknown = object.geometry, material: unknown = object.material;
    if (!isGeometry(geometry) || !isMaterial(material)) throw new Error('Unexpected card draw');
    parts.push({geometry, material, castShadow: object.castShadow, receiveShadow: object.receiveShadow});
  });
  return parts;
}

it('matches the original warm cards for every authored geometry and variant', async () => {
  const product = await driftwoodFixedProduct(), material = new MeshStandardMaterial();
  const borrowed = vi.spyOn(lowPolyKit, 'lowPolyLookMaterial').mockReturnValue(material);
  const mocked = vi.spyOn(runtimeProduct, 'loadFirstPartyProduct').mockResolvedValue(product);
  const signatures: Record<string, unknown> = {}, ctx = modelContext(SkyRig.prototype);
  const owner = new Scope('cargo-card-proof'), geometries = new Map<string, BufferGeometry>();
  for (const row of cargo.library.models) {
    const intake = createOwnedGeometry(row.file, row.attributes); await intake.load(await product.file(row.file));
    geometries.set(JSON.stringify(['cargo', row.id]), intake.take());
  }
  bindWorldSceneModelSources(ctx, 'driftwood-isle', { catalogue: parseWorldSceneModels(boot.siteCatalogue), geometries, materials: new Map([['still', material]]) }, owner);
  async function check<P extends object>(def: ModelDef<P>, allBorrowed = true): Promise<void> {
    // The parent oracle explicitly preloads the same warm-world templates; the new cards use their roster preparation.
    await (def.prepare ?? loadFixedGeometry)();
    for (const [id, params] of [['default', def.defaults] as const, ...(def.variants ?? []).map(row => [row.id, {...def.defaults, ...row.params}] as const)]) {
      const parts = partsOf(def.build(ctx, params, new Rng(seedOf(def))));
      signatures[`${def.id}/${id}`] = await Promise.all(parts.map(async part => ({geometry: await geometryHash(part.geometry), castShadow: part.castShadow ?? false, receiveShadow: part.receiveShadow ?? false})));
      for (const part of parts) {
        if (allBorrowed) expect(part.material).toBe(material);
        else expect(part.material).toBeInstanceOf(Material);
      }
    }
  }
  try {
    await check(barrel); await check(crate); await check(ropeCoil);
    await check(captainHat); await check(sailclothCape); await COLLECTIONS.prepare(); await check(COLLECTIONS.model('chime')); await check(COLLECTIONS.model('plaques'));
    await check(castaway, false); await check(trader); await check(tradeCounter);
    expect(signatures).toMatchSnapshot();
    // Also compare every wreck-specific size against the old decoded-template
    // scale path, including normalized normals and original index storage.
    const choices = parseWorldSceneModels({ product: 'driftwood-isle', models: cargo.models });
    for (const row of choices.models) for (const choice of row.choices) {
      const p = choice.params;
      const kind = row.key === 'barrel' ? p['lying'] === true ? 'lying' : 'barrel'
        : row.key === 'crate' ? p['broken'] === true ? 'broken' : 'crate' : 'coil';
      const dimension = row.key === 'crate' ? p['size'] : row.key === 'ropeCoil' ? p['r'] : 1;
      if (typeof dimension !== 'number') throw new Error('Missing cargo dimension');
      const scale = row.key === 'crate' ? dimension / (p['broken'] === true ? 0.7 : 0.8) : row.key === 'ropeCoil' ? dimension / 0.3 : 1;
      const expected = fixedDraw(fixedGeometryGroups().cargo[kind]).copy();
      try {
        if (scale !== 1) expected.scale(scale, scale, scale);
        const parts = partsOf(sites.model(row.key).build(ctx, p, new Rng(1))), first = parts[0];
        if (first === undefined || parts.length !== 1) throw new Error('Missing cargo specimen part');
        expect(await geometryHash(first.geometry)).toBe(await geometryHash(expected));
        expect(first.material).toBe(material);
        expect(first.castShadow).toBe(true); expect(first.receiveShadow).toBe(true);
      } finally { expected.dispose(); }
    }
    expect(mocked).toHaveBeenCalled();
  } finally { owner.dispose(); for (const geometry of geometries.values()) geometry.dispose(); mocked.mockRestore(); borrowed.mockRestore(); material.dispose(); }
});
