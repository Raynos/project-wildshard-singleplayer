import { type BufferGeometry, type Material, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Sphere, Vector3 } from 'three';
import { defineModel, type ModelContext, type ModelDef, type ModelPart } from '@wildshard/engine/models/model';
import { placeModelSite, type ModelSite } from '@wildshard/engine/models/place';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { TIER } from '@wildshard/engine/core/tier';
import { floorAtRects } from '@wildshard/engine/physics/box';
import { createOwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { resourceScope } from '@wildshard/engine/app/resources';
import type { Scope } from '@wildshard/engine/app/scope';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { isJsonData } from '@wildshard/format/json';
import { parseWorldSceneModels, type WorldSceneModels } from '@wildshard/format/worldSceneModels';
import { hasLentLook, lendLooks, lentLook } from '../shardfile/lentLooks';
import { loadFirstPartyProduct, runtimeLookMaterials } from '../shardfile/runtimeProduct';
import { libraryModel } from './libraryModel';
import { worldSceneSourceMaterial } from '../shardfile/worldSceneMaterials';

interface Sources {
  readonly catalogue: WorldSceneModels;
  readonly geometries: ReadonlyMap<string, BufferGeometry>;
  readonly materials: ReadonlyMap<string, Material>;
}
interface State { value?: Sources; pending?: Promise<Sources> }
const state = (ctx: ModelContext, product: string): State => ctx.once(`world-scenes/models/${product}`, () => ({}));
const surfaces = ['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth'] as const;
const requireLive = (owner: Scope): void => { if (owner.disposed) throw new Error('Scene model owner is not live'); };
const colliders = (rows: readonly unknown[]) => readColliderRows(rows, { kinds: ['box', 'treads', 'capsule', 'ball', 'hull', 'trimesh'], surfaces });
const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && same(Reflect.get(a, key), Reflect.get(b, key)));
};

/** Z2 lends its prepared libraries and graph slots to model recipes in the same world context. */
export function bindWorldSceneModelSources(ctx: ModelContext, product: string, sources: Sources, owner: Scope): void {
  const current = state(ctx, product); current.value = sources;
  owner.onDispose(() => { if (current.value === sources) { delete current.value; delete current.pending; } });
}

async function load(ctx: ModelContext, product: string, catalogue: WorldSceneModels): Promise<Sources> {
  const current = state(ctx, product);
  if (current.value !== undefined) return current.value;
  current.pending ??= (async () => {
    const owner = resourceScope().child(`scene-models/${product}`);
    try {
    const admitted = await loadFirstPartyProduct(product, owner), rows = admitted.section('world/scenes');
    requireLive(owner);
    if (!Object.is(admitted.shardfile.identity.slug, product)) throw new Error('Scene model product identity differs');
    if (rows.catalogue === undefined || !same(parseWorldSceneModels(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await admitted.file(rows.catalogue)))), catalogue)) throw new Error('Scene model boot metadata differs from its admitted catalogue');
    const geometries = new Map<string, BufferGeometry>();
    const draws = catalogue.models.flatMap(model => model.choices.flatMap(choice => [...choice.draws, ...choice.lods.flatMap(level => level.draws)]));
    for (const draw of draws) {
      const key = JSON.stringify([draw.library, draw.model]);
      if (geometries.has(key)) continue;
      const library = rows.libraries.find(row => row.id === draw.library);
      if (library?.kind !== 'owned') throw new Error('Cold scene models require an owned product library');
      const model = library.models.find(row => row.id === draw.model);
      if (model === undefined) throw new Error('Missing declared scene model source');
      const geometry = createOwnedGeometry(admitted.url(model.file), model.attributes);
      await geometry.load(await admitted.file(model.file));
      requireLive(owner);
      const owned = geometry.take(); geometries.set(key, owned); owner.onDispose(() => { owned.dispose(); });
    }
    const slots = new Set(draws.map(draw => draw.material)), materialRows = rows.materials.filter(row => slots.has(row.id));
    if (materialRows.length !== slots.size) throw new Error('Missing scene model material slot');
    const missing = materialRows.flatMap(row => row.kind === 'look' && !hasLentLook(row.look) ? [row.look] : []);
    if (missing.length > 0) {
      if (ctx.renderer === null) throw new Error('Cold scene graph materials require a renderer');
      lendLooks(owner, await runtimeLookMaterials({ scope: owner, renderer: ctx.renderer }, admitted.shardfile, true, [...new Set(missing)]));
    }
    const materials = new Map<string, Material>();
    for (const row of materialRows) {
      let material: Material;
      if (row.kind === 'source') material = await worldSceneSourceMaterial(row, ctx.sky, owner);
      else if (row.kind === 'look') { if (row.over !== undefined) throw new Error('Cold scene models require direct graph slots'); material = lentLook(row.look); }
      else if (row.kind === 'basic') material = new MeshBasicMaterial(row.properties);
      else if (row.kind === 'standard') material = new MeshStandardMaterial(row.properties);
      else material = lowPolyLookMaterial(ctx.sky, row.variant, value => { Object.assign(value, row.properties); });
      if (row.kind === 'standard' && row.sky === true) ctx.sky.setupMaterial(material);
      materials.set(row.id, material);
      if (row.kind === 'basic' || row.kind === 'standard') owner.onDispose(() => { material.dispose(); });
    }
    requireLive(owner);
    const result: Sources = { catalogue, materials, geometries };
    current.value ??= result; owner.onDispose(() => { if (current.value === result) { delete current.value; delete current.pending; } }); return current.value;
    } catch (error) { owner.dispose(); throw error; }
  })();
  try { return await current.pending; } catch (error) { delete current.pending; throw error; }
}

/** Client-only, cold-loadable model catalogue. Metadata, choices, draws and site facts are rows. */
export function defineWorldSceneCatalogue(input: unknown): {
  readonly model: (key: string) => ModelDef<Record<string, unknown>>;
  readonly site: (key: string, choice: string, ctx: ModelContext, registry: WorldRegistry | null) => ModelSite;
  readonly material: (id: string, ctx: ModelContext) => Material;
} {
  const rows = parseWorldSceneModels(input), definitions = new Map<string, ModelDef<Record<string, unknown>>>();
  for (const row of rows.models) {
    for (const choice of row.choices) colliders(choice.colliders);
    const select = (params: object) => { if (!isJsonData(params)) throw new Error(`Scene model requires an authored choice: ${row.id}`); const found = row.choices.find(choice => same(choice.params, params)); if (found === undefined) throw new Error(`Scene model requires an authored choice: ${row.id}`); return found; };
    select(row.defaults);
    for (const variant of row.variants) select({ ...row.defaults, ...variant.params });
    if (row.choices.some((choice, index) => row.choices.slice(0, index).some(other => same(choice.params, other.params)))) throw new Error('Ambiguous scene model parameters');
    const admitted = new WeakSet<WorldSceneModels>();
    const parts = new Map<string, typeof row.choices[number]['draws'][number]>(row.choices.flatMap(choice => choice.draws.map(draw => [JSON.stringify([choice.id, draw.id]), draw] as const)));
    const rawParts = (draws: typeof row.choices[number]['draws'], ctx: ModelContext): ModelPart[] => draws.map(draw => {
      const source = state(ctx, rows.product).value, geometry = source?.geometries.get(JSON.stringify([draw.library, draw.model])), material = source?.materials.get(draw.material);
      if (geometry === undefined || material === undefined) throw new Error('Scene model parts are not ready');
      if (draw.sphere !== undefined) geometry.boundingSphere = new Sphere(new Vector3(draw.sphere[0], draw.sphere[1], draw.sphere[2]), draw.sphere[3]);
      return { geometry, material, castShadow: draw.castShadow, receiveShadow: draw.receiveShadow, renderOrder: draw.renderOrder, ...(draw.until === undefined ? {} : { until: draw.until }) };
    });
    const builder = libraryModel<Record<string, unknown>, string>({
      draws: params => { const choice = select(params); return choice.draws.map(draw => ({ draw: JSON.stringify([choice.id, draw.id]), material: draw.material, castShadow: draw.castShadow, receiveShadow: draw.receiveShadow, renderOrder: draw.renderOrder })); },
      geometry: (ctx, key) => { const draw = parts.get(key), sources = state(ctx, rows.product).value; if (draw === undefined || sources === undefined) throw new Error('Scene model resources are not ready'); const geometry = sources.geometries.get(JSON.stringify([draw.library, draw.model])); if (geometry === undefined) throw new Error(`Missing scene model geometry: ${key}`); return geometry.clone(); },
      material: (ctx, id) => { const material = state(ctx, rows.product).value?.materials.get(id); if (material === undefined) throw new Error(`Missing scene model material: ${id}`); return material; },
      colliders: params => colliders(select(params).colliders),
    });
    const { key: _key, choices: _choices, assembly: _assembly, surface, ...metadata } = row;
    definitions.set(row.key, defineModel({ ...metadata, ...(surface === undefined ? {} : { surface }), ...(builder.colliders === undefined ? {} : { colliders: builder.colliders }),
      build: (ctx, params, rng) => {
        const choice = select(params), build = () => {
          const source = state(ctx, rows.product).value?.catalogue;
          if (source === undefined) throw new Error('Scene model resources are not ready');
          if (!admitted.has(source)) { if (!same(source, rows)) throw new Error('Scene model metadata differs from its resident catalogue'); admitted.add(source); }
          if (row.assembly === 'parts') return rawParts(choice.draws, ctx);
          const made = builder.build(ctx, params, rng); if (!(made instanceof Group)) throw new Error('Scene model library must build a group'); return made; };
        if (state(ctx, rows.product).value !== undefined) return build();
        return loadingSpecimen(row.id, choice.size, async () => {
          await load(ctx, rows.product, rows); const made = build(); if (made instanceof Group) return made;
          const root = new Group();
          for (const part of made) { const mesh = new Mesh(part.geometry, part.material); mesh.castShadow = part.castShadow ?? false; mesh.receiveShadow = part.receiveShadow ?? false; mesh.renderOrder = part.renderOrder ?? 0; root.add(mesh); }
          return root;
        });
      },
      lods: row.choices[0]?.lods.map((level, index) => ({ from: typeof level.from === 'number' ? level.from : level.from[TIER], build: (ctx, params) => rawParts(select(params).lods[index]?.draws ?? [], ctx) })) ?? [],
    }));
  }
  const model = (key: string): ModelDef<Record<string, unknown>> => { const found = definitions.get(key); if (found === undefined) throw new Error(`Missing scene model: ${key}`); return found; };
  return { model, material: (id, ctx) => { const material = state(ctx, rows.product).value?.materials.get(id); if (material === undefined) throw new Error(`Missing scene model material: ${id}`); return material; },
    site: (key, id, ctx, registry) => {
      const choice = rows.models.find(row => row.key === key)?.choices.find(row => row.id === id), facts = choice?.site;
      if (choice === undefined || facts === undefined) throw new Error(`Missing authored scene site: ${key}/${id}`);
      return placeModelSite(model(key), facts.origin, { colliders: facts.colliders, anchors: facts.anchors, floorHeightAt: (x, z) => floorAtRects(facts.floors, x, z, 'first') }, { ctx, registry, params: choice.params, piece: { id: facts.piece ?? key } });
    },
  };
}
