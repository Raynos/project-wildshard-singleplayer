import type { ShardProduct } from '../shardfile/shardProduct';
import { BufferGeometry, type Material, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Sphere, Vector3 } from 'three';
import { defineModel, type ModelContext, type ModelDef, type ModelPart } from '@wildshard/engine/models/model';
import { place, placeModelSite, type ModelSite } from '@wildshard/engine/models/place';
import { createClientChannels } from '../plugin/channels';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { SHADOW_LAYER } from '@wildshard/engine/core/shadowLayer';
import { shadowProxyMaterial } from '@wildshard/engine/models/weld';
import { admitWorldSceneSurface, prepareWorldSceneSurfaces, worldSceneSurfaceMaterial } from '../shardfile/worldSceneSurface';
import { buildTier, TIER, TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { PlumbingData } from '@wildshard/format/plumbing';
import { plumbingKnob } from '../shard/declaredPlumbing';
import { floorAtRects } from '@wildshard/engine/physics/box';
import { createOwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { resourceScope } from '@wildshard/engine/app/resources';
import type { Scope } from '@wildshard/engine/app/scope';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { isJsonData } from '@wildshard/format/json';
import { parseWorldSceneModels, worldSceneModelGraphs, worldSceneModelResources, type WorldSceneModels } from '@wildshard/format/worldSceneModels';
import { hydrateWorldSceneWeld, admitWorldSceneModelGraphs } from '../shardfile/worldSceneWeld';
import type { WorldSceneWeld } from '@wildshard/format/worldSceneWeld';
import { SceneHandles } from '../shardfile/sceneHandles';
import { hasLentLook, lendLooks, lentLook } from '../shardfile/lentLooks';
import { loadFirstPartyProduct, runtimeLookMaterials } from '../shardfile/runtimeProduct';
import { libraryModel } from './libraryModel';
import { worldSceneSourceMaterial } from '../shardfile/worldSceneMaterials';
import { readWholeLibrary } from '../shardfile/wholeLibrary';
import { ownSceneResource } from '@wildshard/engine/app/sceneOwnership';

interface Sources {
  readonly catalogue: WorldSceneModels;
  readonly geometries: ReadonlyMap<string, BufferGeometry>;
  readonly materials: ReadonlyMap<string, Material>;
  readonly plumbing?: PlumbingData | null;
  readonly scenes?: ReadonlyMap<string, WorldSceneWeld>;
}
interface State { value?: Sources; pending?: Promise<Sources>; owner?: Scope }
interface Selection {
  readonly model: WorldSceneModels['models'][number];
  readonly choice: WorldSceneModels['models'][number]['choices'][number];
  readonly quality?: { readonly tier: 'phone' | 'desktop'; readonly overrides: Readonly<Partial<Record<`${string}.${string}`, number | boolean>>> } | undefined;
}
/** A projected copy: its drawn body and its clock. */
export interface ProjectedCopy { readonly body: Object3D; readonly advance: (time: number) => void }
const state = (ctx: ModelContext, product: string): State => ctx.once(`world-scenes/models/${product}`, () => ({}));
type Draw = WorldSceneModels['models'][number]['choices'][number]['draws'][number];
const tierNumber = (value: NonNullable<Draw['until']>, source: Sources | undefined): number => typeof value === 'number' ? value
  : 'knob' in value ? plumbingKnob(source?.plumbing, buildTier(), value.knob, 'number', TIER_CONFIG) * value.multiply + value.add : value[buildTier()];
const tierFlag = (value: Draw['castShadow'], source: Sources | undefined): boolean => typeof value === 'boolean' ? value
  : 'knob' in value ? plumbingKnob(source?.plumbing, buildTier(), value.knob, 'boolean', TIER_CONFIG) : value[buildTier()];
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
  const current = state(ctx, product); current.value = sources; current.owner = owner;
  owner.onDispose(() => { if (current.owner === owner) { delete current.value; delete current.pending; delete current.owner; } });
}

/** Resolve one requested choice while keeping the complete catalogue admitted. */
function selectedResources(catalogue: WorldSceneModels, selection: Selection, sources: Pick<Sources, 'plumbing' | 'scenes'>) {
  let choice = selection.choice;
  if (choice.scene !== undefined) {
    const scene = choice.scene, quality = selection.quality;
    if (quality === undefined) throw new Error('Frozen specimen needs its captured quality');
    const topology = 'knob' in scene ? scene[plumbingKnob(sources.plumbing, quality.tier, scene.knob, 'boolean', quality.overrides) ? 'true' : 'false'] : scene;
    choice = { ...choice, scene: 'nodes' in topology || 'file' in topology ? topology : topology[TIER] };
  }
  const selected = { ...catalogue, models: [{ ...selection.model, choices: [choice] }] };
  const graphs = worldSceneModelGraphs(choice).flatMap(leaf => {
    if (!('file' in leaf)) return [];
    const graph = sources.scenes?.get(leaf.file);
    if (graph === undefined) throw new Error('Missing admitted frozen specimen');
    return [graph];
  });
  return worldSceneModelResources(selected, graphs);
}
function ready(sources: Sources | undefined, catalogue: WorldSceneModels, selection: Selection): boolean {
  if (sources === undefined) return false;
  const needed = selectedResources(catalogue, selection, sources);
  return needed.geometry.every(ref => sources.geometries.has(JSON.stringify([ref.library, ref.model]))) && needed.materials.every(id => sources.materials.has(id));
}

async function load(ctx: ModelContext, product: string, catalogue: WorldSceneModels, selection: Selection, lifetime: Scope, pinnedProduct?: ShardProduct): Promise<Sources> {
  const current = state(ctx, product);
  requireLive(lifetime);
  if (ready(current.value, catalogue, selection) && current.value !== undefined) return current.value;
  // Requests serialize only intake; concurrent choices still receive their own
  // captured tier/profile and never reuse another choice's incomplete resources.
  if (current.pending !== undefined) {
    try { await current.pending; } catch { /* An abandoned view does not cancel the next requested choice. */ }
    return load(ctx, product, catalogue, selection, lifetime, pinnedProduct);
  }
  current.pending ??= (async () => {
    const owner = lifetime.child(`scene-models/${product}`);
    try {
    const admitted = pinnedProduct ?? await loadFirstPartyProduct(product, owner), rows = admitted.section('world/scenes');
    requireLive(owner);
    if (!Object.is(admitted.shardfile.identity.slug, product)) throw new Error('Scene model product identity differs');
    if (rows.catalogue === undefined || !same(parseWorldSceneModels(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await admitted.file(rows.catalogue)))), catalogue)) throw new Error('Scene model boot metadata differs from its admitted catalogue');
    const geometries = new Map(current.value?.geometries);
    const scenes = current.value?.scenes ?? await admitWorldSceneModelGraphs(admitted, catalogue);
    const declared = selectedResources(catalogue, selection, { scenes, plumbing: admitted.shardfile.plumbing });
    const slots = new Set(declared.materials), declaredMaterials = rows.materials.filter(row => slots.has(row.id));
    if (declaredMaterials.length !== slots.size) throw new Error('Missing scene model material slot');
    const materialRows = declaredMaterials.filter(row => !current.value?.materials.has(row.id));
    for (const row of materialRows) if (row.kind === 'surface') await admitWorldSceneSurface(row, admitted);
    const wholes = new Map<string, Awaited<ReturnType<typeof readWholeLibrary>>>();
    for (const draw of declared.geometry) {
      const key = JSON.stringify([draw.library, draw.model]);
      if (geometries.has(key)) continue;
      const library = rows.libraries.find(row => row.id === draw.library);
      if (library?.kind === 'whole') {
        const whole = wholes.get(library.id) ?? await readWholeLibrary(owner, admitted, library, new Set(declared.geometry.flatMap(ref => ref.library === library.id ? [ref.model] : []))); wholes.set(library.id, whole);
        const owned = whole.geometry(draw.model); if (owned === null) throw new Error('Missing declared scene model source');
        requireLive(owner); geometries.set(key, owned); owner.onDispose(() => { owned.dispose(); }); continue;
      }
      if (library?.kind !== 'owned') throw new Error('Cold scene models require an owned product library');
      const model = library.models.find(row => row.id === draw.model);
      if (model === undefined) throw new Error('Missing declared scene model source');
      const file = typeof model.file === 'string' ? model.file : model.file[TIER];
      const geometry = createOwnedGeometry(admitted.url(file), model.attributes);
      await geometry.load(await admitted.file(file), model.segments === undefined ? undefined : await Promise.all(model.segments.map(segment => admitted.file(segment))));
      requireLive(owner);
      const owned = geometry.take(); geometries.set(key, owned); owner.onDispose(() => { owned.dispose(); });
    }
    for (const whole of wholes.values()) whole.done();
    const missing = materialRows.flatMap(row => (row.kind === 'look' || row.kind === 'surface') && row.look !== undefined && !hasLentLook(row.look) ? [row.look] : []);
    if (missing.length > 0) {
      if (ctx.renderer === null) throw new Error('Cold scene graph materials require a renderer');
      lendLooks(owner, await runtimeLookMaterials({ scope: owner, renderer: ctx.renderer }, admitted.shardfile, true, [...new Set(missing)]));
    }
    const materials = new Map(current.value?.materials);
    const surfaceRows = materialRows.filter(row => row.kind === 'surface');
    if (surfaceRows.length > 0) await prepareWorldSceneSurfaces(surfaceRows, ctx.sky, admitted, owner);
    for (const row of materialRows) {
      if (materials.has(row.id)) continue;
      let material: Material;
      if (row.kind === 'surface') material = await worldSceneSurfaceMaterial(row, ctx.sky, admitted, owner);
      else if (row.kind === 'source') material = await worldSceneSourceMaterial(row, ctx.sky, owner);
      else if (row.kind === 'look') { if (row.over !== undefined) throw new Error('Cold scene models require direct graph slots'); material = lentLook(row.look); }
      else if (row.kind === 'basic') material = new MeshBasicMaterial(row.properties);
      else if (row.kind === 'standard') material = new MeshStandardMaterial(row.properties);
      else material = lowPolyLookMaterial(ctx.sky, row.variant, value => { Object.assign(value, row.properties); });
      if (row.kind === 'standard' && row.sky === true) ctx.sky.setupMaterial(material);
      materials.set(row.id, material);
      if (row.kind === 'basic' || row.kind === 'standard') owner.onDispose(() => { material.dispose(); });
    }
    requireLive(owner);
    // A late world publication wins over a newly prepared copy, preserving the
    // world's original material maps and borrowed source-root identity.
    for (const [id, material] of current.value?.materials ?? []) materials.set(id, material);
    for (const [id, geometry] of current.value?.geometries ?? []) geometries.set(id, geometry);
    // View resources never enter the resident world maps. A closed specimen
    // retires this intake and its product lease, even after many different visits.
    owner.onDispose(() => { geometries.clear(); materials.clear(); });
    return { catalogue, materials, geometries, plumbing: admitted.shardfile.plumbing, scenes };
    } catch (error) { owner.dispose(); throw error; }
  })();
  const pending = current.pending;
  try { return await pending; } finally { if (current.pending === pending) delete current.pending; }
}

/** Client-only, cold-loadable model catalogue. Metadata, choices, draws and site facts are rows.
 * Decorative projection uses admitted channel rows and preserves each copy's initial pose and native lifetime. */
export function defineWorldSceneCatalogue(input: unknown, pinnedProduct?: ShardProduct): {
  readonly model: (key: string) => ModelDef<Record<string, unknown>>;
  readonly site: (key: string, choice: string, ctx: ModelContext, registry: WorldRegistry | null) => ModelSite;
  readonly material: (id: string, ctx: ModelContext) => Material;
  readonly project: (id: string, ctx: ModelContext, parent: Object3D) => ProjectedCopy[];
} {
  const rows = parseWorldSceneModels(input);
  if (pinnedProduct !== undefined && !Object.is(pinnedProduct.slug, rows.product)) throw new Error('Pinned scene catalogue product differs');
  const definitions = new Map<string, ModelDef<Record<string, unknown>>>();
  for (const row of rows.models) {
    for (const choice of row.choices) colliders(choice.colliders);
    const select = (params: object) => { if (!isJsonData(params)) throw new Error(`Scene model requires an authored choice: ${row.id}`); const found = row.choices.find(choice => same(choice.params, params)); if (found === undefined) throw new Error(`Scene model requires an authored choice: ${row.id}`); return found; };
    select(row.defaults);
    for (const variant of row.variants) select({ ...row.defaults, ...variant.params });
    if (row.choices.some((choice, index) => row.choices.slice(0, index).some(other => same(choice.params, other.params)))) throw new Error('Ambiguous scene model parameters');
    const admitted = new WeakSet<WorldSceneModels>();
    const parts = new Map<string, typeof row.choices[number]['draws'][number]>(row.choices.flatMap(choice => choice.draws.map(draw => [JSON.stringify([choice.id, draw.id]), draw] as const)));
    const rawParts = (draws: typeof row.choices[number]['draws'], ctx: ModelContext, source = state(ctx, rows.product).value, owner?: Scope): ModelPart[] => draws.map(draw => {
      const original = source?.geometries.get(JSON.stringify([draw.library, draw.model])), material = source?.materials.get(draw.material);
      const geometry = owner === undefined ? original : original?.clone();
      if (geometry === undefined || material === undefined) throw new Error('Scene model parts are not ready');
      if (owner !== undefined) ownSceneResource(geometry, owner);
      if (draw.sphere !== undefined) geometry.boundingSphere = new Sphere(new Vector3(draw.sphere[0], draw.sphere[1], draw.sphere[2]), draw.sphere[3]);
      return { geometry, material, castShadow: tierFlag(draw.castShadow, source), receiveShadow: draw.receiveShadow, renderOrder: draw.renderOrder, ...(draw.until === undefined ? {} : { until: tierNumber(draw.until, source) }) };
    });
    const builder = (sources: Sources) => libraryModel<Record<string, unknown>, string>({
      draws: params => { const choice = select(params); return choice.draws.map(draw => ({ draw: JSON.stringify([choice.id, draw.id]), material: draw.material, castShadow: tierFlag(draw.castShadow, sources), receiveShadow: draw.receiveShadow, renderOrder: draw.renderOrder })); },
      geometry: (_ctx, key) => { const draw = parts.get(key); if (draw === undefined) throw new Error('Scene model resources are not ready'); const geometry = sources.geometries.get(JSON.stringify([draw.library, draw.model])); if (geometry === undefined) throw new Error(`Missing scene model geometry: ${key}`); return geometry.clone(); },
      material: (_ctx, id) => { const material = sources.materials.get(id); if (material === undefined) throw new Error(`Missing scene model material: ${id}`); return material; },
    });
    const { key: _key, choices: _choices, assembly: _assembly, surface, ...metadata } = row;
    definitions.set(row.key, defineModel({ ...metadata, specimenLifetime: 'view', ...(surface === undefined ? {} : { surface }), colliders: params => colliders(select(params).colliders),
      build: (ctx, params, rng) => {
        const owner = resourceScope();
        const quality = row.assembly === 'scene' ? { tier: buildTier(), overrides: Object.fromEntries(Object.entries(TIER_CONFIG).filter((entry): entry is [string, number | boolean] => entry[0].includes('.') && (typeof entry[1] === 'number' || typeof entry[1] === 'boolean'))) } : undefined;
        const choice = select(params), build = (sources: Sources) => {
          requireLive(owner);
          const source = sources.catalogue;
          if (!admitted.has(source)) { if (!same(source, rows)) throw new Error('Scene model metadata differs from its resident catalogue'); admitted.add(source); }
          if (row.assembly === 'scene') {
            const scene = choice.scene;
            if (scene === undefined || quality === undefined) throw new Error('Frozen specimen resources are not ready');
            const topology = 'knob' in scene ? scene[plumbingKnob(sources.plumbing, quality.tier, scene.knob, 'boolean', quality.overrides) ? 'true' : 'false'] : scene;
            const leaf = 'nodes' in topology || 'file' in topology ? topology : topology[TIER];
            const recipe = 'file' in leaf ? sources.scenes?.get(leaf.file) : leaf;
            if (recipe === undefined) throw new Error('Missing admitted frozen specimen');
            if (recipe.culls.length > 0 || recipe.placements.length > 0 || recipe.sets.length > 0 || recipe.resources.length > 0) throw new Error('Frozen specimens cannot install world services');
            const handles = new SceneHandles(ctx.sky), root = new Group(); handles.publish(recipe.root, root);
            return hydrateWorldSceneWeld(recipe, handles, { geometry: sources.geometries, materials: sources.materials, plumbing: sources.plumbing, quality }, owner);
          }
          if (row.assembly === 'parts') return rawParts(choice.draws, ctx, sources, ctx.specimenScope);
          if (row.assembly === 'objects') {
            const root = new Group();
            for (const [i, part] of rawParts(choice.draws, ctx, sources).entries()) {
              const proxy = choice.draws[i]?.depthOnly === true;
              const mesh = new Mesh(part.geometry.clone(), proxy ? shadowProxyMaterial : part.material);
              ownSceneResource(mesh.geometry, owner);
              mesh.castShadow = proxy || (part.castShadow ?? false); mesh.receiveShadow = part.receiveShadow ?? false; mesh.renderOrder = part.renderOrder ?? 0;
              if (proxy) mesh.layers.set(SHADOW_LAYER);
              if (part.until !== undefined) mesh.userData['until'] = part.until;
              root.add(mesh);
            }
            return root;
          }
          const made = builder(sources).build(ctx, params, rng); if (!(made instanceof Group)) throw new Error('Scene model library must build a group');
          made.traverse(node => { if (node instanceof Mesh) { const shape: unknown = node.geometry; if (shape instanceof BufferGeometry) ownSceneResource(shape, owner); } }); return made; };
        const selection: Selection = { model: row, choice, quality };
        const resident = state(ctx, rows.product).value;
        if (ready(resident, rows, selection) && resident !== undefined) return build(resident);
        return loadingSpecimen(row.id, choice.size, async () => {
          const sources = await load(ctx, rows.product, rows, selection, owner, pinnedProduct), made = build(sources); if (made instanceof Object3D) return made;
          const root = new Group();
          for (const part of made) { const mesh = new Mesh(part.geometry, part.material); mesh.castShadow = part.castShadow ?? false; mesh.receiveShadow = part.receiveShadow ?? false; mesh.renderOrder = part.renderOrder ?? 0; root.add(mesh); }
          return root;
        }, owner);
      },
      lods: row.choices[0]?.lods.map((level, index) => ({ from: typeof level.from === 'number' ? level.from : level.from[TIER], build: (ctx, params) => rawParts(select(params).lods[index]?.draws ?? [], ctx) })) ?? [],
    }));
  }
  const model = (key: string): ModelDef<Record<string, unknown>> => { const found = definitions.get(key); if (found === undefined) throw new Error(`Missing scene model: ${key}`); return found; };
  return { model, material: (id, ctx) => { const material = state(ctx, rows.product).value?.materials.get(id); if (material === undefined) throw new Error(`Missing scene model material: ${id}`); return material; },
    project: (id, ctx, parent) => {
      const row = rows.projections?.find(entry => entry.id === id);
      if (row === undefined) throw new Error('Missing admitted model projection');
      const observation = { time: 0, delta: 0, values: [] as readonly number[] };
      const views = row.programs.map(program => { const view = createClientChannels(program); view.evaluate(observation); return view; });
      const pose = (frame: ReturnType<typeof createClientChannels>['frame']) => {
        const { x, y, z, yaw } = frame;
        if (x === undefined || y === undefined || z === undefined) throw new Error('Missing declared decorative position');
        return { x, y, z, ...(yaw === undefined ? {} : { yaw }) };
      };
      const placed = place(model(row.key), views.map(view => pose(view.frame)), { ctx, draw: 'single', parent, piece: { id: row.id } });
      const copies = views.length === 1 ? [placed.object] : [...placed.object.children];
      placed.object.name = row.name;
      return views.map((view, index) => {
        const body = copies[index]; if (body === undefined) throw new Error('Missing declared decorative copy');
        body.name = row.name;
        return { body, advance: time => {
          observation.time = time; view.evaluate(observation); const { x, y, z, yaw } = view.frame;
          if (x === undefined || y === undefined || z === undefined) throw new Error('Missing declared decorative position');
          body.position.set(x, y, z); if (yaw !== undefined) body.rotation.y = yaw;
        } };
      });
    },
    site: (key, id, ctx, registry) => {
      const choice = rows.models.find(row => row.key === key)?.choices.find(row => row.id === id), facts = choice?.site;
      if (choice === undefined || facts === undefined) throw new Error(`Missing authored scene site: ${key}/${id}`);
      return placeModelSite(model(key), facts.origin, { colliders: facts.colliders, anchors: facts.anchors, floorHeightAt: (x, z) => floorAtRects(facts.floors, x, z, 'first') }, { ctx, registry, params: choice.params, piece: { id: facts.piece ?? key } });
    },
  };
}
