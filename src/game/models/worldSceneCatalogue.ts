import { type BufferGeometry, type Material, Group } from 'three';
import { defineModel, type ModelContext, type ModelDef } from '@wildshard/engine/models/model';
import { placeModelSite, type ModelSite } from '@wildshard/engine/models/place';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { floorAtRects } from '@wildshard/engine/physics/box';
import type { Scope } from '@wildshard/engine/app/scope';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import { isJsonData } from '@wildshard/format/json';
import { parseWorldSceneModels, type WorldSceneModels } from '@wildshard/format/worldSceneModels';
import { libraryModel } from './libraryModel';

interface Sources {
  readonly catalogue: WorldSceneModels;
  readonly geometries: ReadonlyMap<string, BufferGeometry>;
  readonly materials: ReadonlyMap<string, Material>;
}
interface State { value?: Sources }
const state = (ctx: ModelContext, product: string): State => ctx.once(`world-scenes/models/${product}`, () => ({}));
const surfaces = ['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth'] as const;
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
  owner.onDispose(() => { if (current.value === sources) { delete current.value; } });
}

/** Client-only resident model catalogue. Metadata, choices, draws and site facts are rows. */
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
    const builder = libraryModel<Record<string, unknown>, string>({
      draws: params => { const choice = select(params); return choice.draws.map(draw => ({ draw: JSON.stringify([choice.id, draw.id]), material: draw.material, castShadow: draw.castShadow, receiveShadow: draw.receiveShadow, renderOrder: draw.renderOrder })); },
      geometry: (ctx, key) => { const draw = parts.get(key), sources = state(ctx, rows.product).value; if (draw === undefined || sources === undefined) throw new Error('Scene model resources are not ready'); const geometry = sources.geometries.get(JSON.stringify([draw.library, draw.model])); if (geometry === undefined) throw new Error(`Missing scene model geometry: ${key}`); return geometry.clone(); },
      material: (ctx, id) => { const material = state(ctx, rows.product).value?.materials.get(id); if (material === undefined) throw new Error(`Missing scene model material: ${id}`); return material; },
      colliders: params => colliders(select(params).colliders),
    });
    const { key: _key, choices: _choices, surface, ...metadata } = row;
    definitions.set(row.key, defineModel({ ...metadata, ...(surface === undefined ? {} : { surface }), ...(builder.colliders === undefined ? {} : { colliders: builder.colliders }),
      build: (ctx, params, rng) => {
        select(params); const build = () => {
          const source = state(ctx, rows.product).value?.catalogue;
          if (source === undefined) throw new Error('Scene model resources are not ready');
          if (!admitted.has(source)) { if (!same(source, rows)) throw new Error('Scene model metadata differs from its resident catalogue'); admitted.add(source); }
          const made = builder.build(ctx, params, rng); if (!(made instanceof Group)) throw new Error('Scene model library must build a group'); return made; };
        return build();
      },
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
