// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { BufferGeometry, Material, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { SkyRig } from '@wildshard/engine/world/skyRig';
import { live } from '@wildshard/engine/models/live';
import { modelContext, specimenReady, seedOf, type ModelDef, type ModelPart } from '@wildshard/engine/models/model';
import * as lowPolyKit from '@wildshard/engine/world/lowpolyKit';
import { driftwoodFixedProduct } from './fixtures/driftwoodFixedProduct';
import * as runtimeProduct from '../src/game/shardfile/runtimeProduct';
import { loadFixedGeometry, fixedGeometryReady, fixedDraw, fixedGeometryGroups, COLLECTIONS } from './fixtures/driftwoodLegacyAssets';
import { sites, captainHat, sailclothCape, tradeCounter, trader as traderCard } from './fixtures/driftwoodLegacyCatalogue';
import { bindWorldSceneModelSources } from '../src/game/models/worldSceneCatalogue';
import { parseWorldSceneModels } from '../src/format/worldSceneModels';
import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';
import { Scope } from '../src/engine/app/scope';
import native from '../src/shards/driftwood-isle/data/nativeSpecimens.generated.json' with { type: 'json' };
import cargo from '../src/shards/driftwood-isle/data/cargoScenes.generated.json' with { type: 'json' };
import boot from '../src/shards/driftwood-isle/boot/modelCatalogue.generated.json' with { type: 'json' };
import { kitFigureCard } from '../src/game/models/kitFigureCard';
import { castawayFigure } from './fixtures/driftwoodCastawayOracle';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { driftwoodKitFigureCards } from '../src/shards/driftwood-isle/generators/kitFigureCards';
import { enteredTrader } from './fixtures/driftwoodTraderOracle';

const trader = enteredTrader(traderCard);
const barrel = sites.model('barrel'), crate = sites.model('crate'), ropeCoil = sites.model('ropeCoil');


it('keeps the kit card preparation inside its own view', async () => {
  const product = await driftwoodFixedProduct(), castaway = kitFigureCard(product, driftwoodKitFigureCards(), 'castaway');
  expect(castaway.specimenLifetime).toBe('view');
  expect(live(castaway).prepare).toBeUndefined();
  expect(fixedGeometryReady()).toBe(false);
  expect(live(trader).prepare).toBe(loadFixedGeometry);
  for (const def of [barrel, crate, ropeCoil, captainHat, sailclothCape, tradeCounter]) expect(live(def).prepare).toBeUndefined();
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
  const castaway = kitFigureCard(product, driftwoodKitFigureCards(), 'castaway');
  const borrowed = vi.spyOn(lowPolyKit, 'lowPolyLookMaterial').mockReturnValue(material);
  const mocked = vi.spyOn(runtimeProduct, 'loadFirstPartyProduct').mockResolvedValue(await driftwoodFixedProduct(true));
  const signatures: Record<string, unknown> = {}, ctx = modelContext(SkyRig.prototype);
  const owner = new Scope('cargo-card-proof'), geometries = new Map<string, BufferGeometry>();
  for (const [library, rows] of [['cargo', cargo.library.models], ['native-specimens', native.library.models]] as const) for (const row of rows) {
    const intake = createOwnedGeometry(row.file, row.attributes); await intake.load(await product.file(row.file));
    geometries.set(JSON.stringify([library, row.id]), intake.take());
  }
  bindWorldSceneModelSources(ctx, 'driftwood-isle', { catalogue: parseWorldSceneModels(boot.siteCatalogue), geometries, materials: new Map([['still', material], ['kit', material]]) }, owner);
  async function check<P extends object>(def: ModelDef<P>, allBorrowed = true): Promise<void> {
    // The parent oracle explicitly preloads the same warm-world templates; the new cards use their roster preparation.
    await (def.id === castaway.id ? def.prepare?.() : (def.prepare ?? loadFixedGeometry)());
    for (const [id, params] of [['default', def.defaults] as const, ...(def.variants ?? []).map(row => [row.id, {...def.defaults, ...row.params}] as const)]) {
      const cardScope = owner.child(`prepared-card/${def.id}/${id}`);
      // The old snapshot samples the immediate kit head; FigureRows replaces
      // it one microtask later. Keep that oracle and compare both ready cards.
      const original = def.id === castaway.id ? cardScope.run(() => castawayFigure(ctx.sky, { x: 0, y: 0, z: 0 }, { x: -1.2, y: 0, z: -1.1 }, new SceneHandles(ctx.sky), cardScope)) : null;
      const signature = (parts: readonly ModelPart[]) => Promise.all(parts.map(async part => ({geometry: await geometryHash(part.geometry), castShadow: part.castShadow ?? false, receiveShadow: part.receiveShadow ?? false})));
      const initial = original === null ? null : signature(partsOf(original.group));
      const built = cardScope.run(() => def.build({ ...ctx, specimenScope: cardScope }, params, new Rng(seedOf(def))));
      if (built instanceof Object3D && def.specimenLifetime === 'view') await specimenReady(built);
      const parts = partsOf(built);
      const ready = await signature(parts);
      if (original !== null && initial !== null) {
        await original.presentation.ready;
        expect(ready).toEqual(await signature(partsOf(original.group)));
        signatures[`${def.id}/${id}`] = await initial;
      } else signatures[`${def.id}/${id}`] = ready;
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
