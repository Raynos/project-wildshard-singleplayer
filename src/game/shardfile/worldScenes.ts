import { prepareSceneSources, sceneModelSource, sceneBakeSource, sceneSourceDeclares } from './sceneSources';
import { drawSceneRows, prepareSceneDrawRows } from './sceneDraws';
import { admitWorldSceneStepSources, worldSceneStepSources } from './worldSceneStepSources';
import { TIER } from '@wildshard/engine/core/tier';
import { SceneHandles } from './sceneHandles';
import { assertSceneProfile } from './sceneProfile';
import { BufferAttribute, BufferGeometry, InstancedBufferAttribute, InstancedMesh, type Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, type Object3D, Sphere, Vector3 } from 'three';
import { sharedModelContext } from '@wildshard/engine/models/model';
import { bindWorldSceneModelSources, defineWorldSceneCatalogue } from '../models/worldSceneCatalogue';
import { admitWorldSceneSurface, prepareWorldSceneSurfaces, worldSceneSurfaceMaterial } from './worldSceneSurface';
import { worldSceneSourceMaterial } from './worldSceneMaterials';
import { WorldScenePlacement } from './worldScenePlacement';
import { readWholeLibrary } from './wholeLibrary';
import { lendWorldSceneTextures } from './worldSceneTextures';
import { WorldSceneBatch } from './worldSceneBatch';
import { WorldSceneWeldAssembly, worldSceneWeldFile, worldSceneWeldFiles, admitWorldSceneModelGraphs } from './worldSceneWeld';
import { parseWorldSceneWeld, type WorldSceneWeld } from '@wildshard/format/worldSceneWeld';
import { parseWorldScenePlacement, type WorldScenePlacementRow } from '@wildshard/format/worldScenePlacement';
import { poseOf, placeCollider, readColliderRows } from '@wildshard/engine/models/colliders';
import { createOwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { withOwner } from '@wildshard/engine/app/ownership';
import { buildYield } from '@wildshard/engine/core/workSlice';
import type { Scope } from '@wildshard/engine/app/scope';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { parseWorldSceneModels, worldSceneModelResources } from '@wildshard/format/worldSceneModels';
import { parseWorldScenes, worldScenesForTier, type WorldScenesSection } from '@wildshard/format/worldScenes';
import { parseWorldScene, type WorldSceneRecipe } from '@wildshard/format/clientChannels';
import type { ShardContext } from '../plugin/context';
import { createModelLibrary, type ModelLibrary } from '../plugin/geometry';
import { createWorldScene, bindWorldSceneParts } from '../plugin/ui';
import { hasLentLook, lentLook, lentMappedLook, lendLooks, sceneMaterial } from './lentLooks';
import { runtimeLookMaterials } from './runtimeProduct';

function instances3(value: unknown): value is InstancedMesh { return value instanceof InstancedMesh; }
function mesh3(value: unknown): value is Mesh { return value instanceof Mesh; }
interface Library {
  readonly geometry: (id: string) => BufferGeometry | null;
  readonly models?: Pick<ModelLibrary<string, string>, 'painted'>;
}
const decoder = new TextDecoder('utf-8', { fatal: true });
const residents = new WeakMap<Scope, WeakMap<ShardContext['product'], Promise<SceneHandles>>>();

/** Client-only scene host. Takes declared rows and an engine lifetime, never shard constructors or callbacks.
 * Results build once per resident/product and remain valid across entered play scopes. */
export function installWorldScenes(ctx: ShardContext, input: WorldScenesSection, resident: Scope = ctx.scope): Promise<SceneHandles> {
  if (resident.disposed) return Promise.reject(new Error('World scene resident is disposed'));
  let products = residents.get(resident);
  if (products === undefined) { products = new WeakMap(); residents.set(resident, products); }
  const previous = products.get(ctx.product); if (previous !== undefined) return previous;
  let section: WorldScenesSection;
  try { section = worldScenesForTier(parseWorldScenes(input), TIER); } catch (error) { return Promise.reject(error instanceof Error ? error : new Error('World scene admission failed', { cause: error })); }
  const pending = build(ctx, section, resident);
  products.set(ctx.product, pending);
  const cache = products;
  void pending.catch(() => { if (cache.get(ctx.product) === pending) cache.delete(ctx.product); });
  resident.onDispose(() => { cache.delete(ctx.product); });
  return pending;
}

async function build(ctx: ShardContext, section: WorldScenesSection, resident: Scope): Promise<SceneHandles> {
  const product = ctx.product, recipes = new Map<string, WorldSceneRecipe>(), libraryRows = new Map(section.libraries.map(row => [row.id, row]));
  if (section.libraries.some(row => row.kind === 'models' || row.kind === 'baked')) await prepareSceneSources(product);
  const slots = new Set(section.materials.map(row => row.id));
  const requireFile = (name: string): void => { if (!product.hasFile(name)) throw new Error(`Missing world scene blob: ${name}`); };
  const reference = (ref: { readonly library: string; readonly model: string }, mapped = false): void => {
    const library = libraryRows.get(ref.library);
    if (library?.kind === 'models') { if (!sceneSourceDeclares(product, ref.library, ref.model, mapped ? 'painted' : 'geometry')) throw new Error('Missing declared scene source'); return; }
    if (library === undefined || library.kind === 'baked' || !(mapped ? library.kind === 'pool' && library.painted.some(row => row.id === ref.model) : library.kind === 'owned' || library.kind === 'whole' ? library.models.some(row => row.id === ref.model) : library.files.some(row => row.parts.includes(ref.model)))) throw new Error(`Missing world scene model: ${ref.library}/${ref.model}`);
  };
  // Admission precedes geometry/material allocation, including both cube variants.
  for (const row of section.libraries) for (const file of row.kind === 'whole' ? [] : row.kind === 'models' || row.kind === 'baked' ? [row.file] : row.kind === 'owned' ? row.models.flatMap(model => [typeof model.file === 'string' ? model.file : model.file[TIER], ...model.segments ?? []]) : [...row.files.map(entry => entry.file), ...row.painted.map(entry => entry.file)]) requireFile(file);
  for (const row of section.materials) if (row.kind === 'look' || row.kind === 'surface') {
    if (row.look !== undefined && product.shardfile.look.materials[row.look] === undefined) throw new Error(`Missing world scene look: ${row.look}`);
    if (row.kind === 'look' && row.over !== undefined) reference(row.over, true);
  }
  for (const row of section.materials) if (row.kind === 'surface') await admitWorldSceneSurface(row, product);
  for (const row of section.lent ?? []) {
    for (const look of row.looks) if (product.shardfile.look.materials[look] === undefined) throw new Error(`Missing lent texture look: ${look}`);
    if (row.kind === 'product') { requireFile(row.file[TIER]); if ((row.looks.length > 0) !== (row.param !== undefined) || row.looks.length === 0 && row.publish === undefined) throw new Error('A product texture is lent with a param or published'); }
  }
  let catalogue: ReturnType<typeof parseWorldSceneModels> | undefined;
  let modelScenes: ReadonlyMap<string, WorldSceneWeld> = new Map();
  const frozenSlots = new Set<string>();
  if (section.catalogue !== undefined) {
    requireFile(section.catalogue);
    catalogue = parseWorldSceneModels(JSON.parse(decoder.decode(await product.file(section.catalogue))));
    if (!Object.is(catalogue.product, product.shardfile.identity.slug)) throw new Error('Scene catalogue product identity differs');
    for (const model of catalogue.models) for (const choice of model.choices) for (const draw of [...choice.draws, ...choice.lods.flatMap(level => level.draws)]) {
      reference(draw);
      if (!['owned', 'whole'].includes(libraryRows.get(draw.library)?.kind ?? '') || !slots.has(draw.material)) throw new Error('Scene catalogue needs owned geometry and declared material slots');
    }
    modelScenes = await admitWorldSceneModelGraphs(product, catalogue);
    const resources = worldSceneModelResources(catalogue, [...modelScenes.values()]);
    for (const draw of resources.geometry) { reference(draw); if (!['owned', 'whole'].includes(libraryRows.get(draw.library)?.kind ?? '')) throw new Error('Frozen specimens need owned geometry'); }
    for (const slot of resources.materials) if (!slots.has(slot)) throw new Error('Missing frozen specimen material slot');
    for (const slot of worldSceneModelResources({ ...catalogue, models: catalogue.models.filter(model => model.assembly === 'scene') }, [...modelScenes.values()]).materials) frozenSlots.add(slot);
  }
  const immediate = new Set(section.steps.flatMap(step => Object.values(step.materials)));
  if (section.materials.some(row => row.kind === 'source' && row.load === 'placement' && immediate.has(row.id))) throw new Error('Deferred source material requires a named model placement');
  const published = new Set<string>(), sourceObjects = new Map<string, string>();
  for (const row of section.materials) if (row.kind === 'source' && row.publishObject !== undefined) {
    const key = JSON.stringify([row.url, row.aliases, row.anisotropy, row.anisotropyMaps, row.envMapIntensity]);
    if (sourceObjects.has(row.publishObject) && sourceObjects.get(row.publishObject) !== key || slots.has(row.publishObject.slice('materials.'.length)) && row.publishObject.startsWith('materials.')) throw new Error('Source object publication differs');
    sourceObjects.set(row.publishObject, key); published.add(row.publishObject);
  }
  const welds: WorldSceneWeld[] = [], deferredPlacements = new Set<string>();
  assertSceneProfile(product.shardfile, (section.welds ?? []).map(row => worldSceneWeldFile(row, product.shardfile.plumbing)));
  for (const declared of section.welds ?? []) {
    const selected = worldSceneWeldFile(declared, product.shardfile.plumbing);
    let row: WorldSceneWeld | undefined;
    for (const file of worldSceneWeldFiles(declared)) {
      requireFile(file);
      const candidate = parseWorldSceneWeld(JSON.parse(decoder.decode(await product.file(file))));
      if (candidate.id !== declared.id) throw new Error('Frozen scene blob identity differs');
      for (const id of candidate.placements) deferredPlacements.add(id);
      if (file === selected) row = candidate;
    }
    if (row === undefined) throw new Error('Missing selected frozen scene');
    for (const resource of row.resources) {
      if (resource.kind === 'geometry') reference(resource.source);
      if (published.has(resource.id)) throw new Error('Duplicate frozen scene resource'); published.add(resource.id);
    }
    for (const node of row.nodes) {
      if ('geometry' in node) reference(node.geometry);
      if ('material' in node && node.material !== '$shadow' && !slots.has(node.material)) throw new Error('Missing frozen scene material slot');
      if (published.has(node.id)) throw new Error('Duplicate frozen scene part identity');
      published.add(node.id);
    }
    if (published.has(row.id)) throw new Error('Duplicate frozen scene identity');
    published.add(row.id); welds.push(row);
  }
  const batches = new Map((section.batches ?? []).map(row => [row.id, row])), reservations = new Map<string, number>();
  for (const row of batches.values()) {
    if (!slots.has(row.material)) throw new Error('Missing scene batch material');
    for (const source of row.geometry) { reference(source); if (libraryRows.get(source.library)?.kind !== 'owned') throw new Error('Scene batch requires owned geometry'); }
    published.add(row.id); reservations.set(row.id, row.fixed.length);
  }
  const placements: WorldScenePlacementRow[] = [];
  for (const declared of section.placements ?? []) {
    if ('file' in declared) requireFile(declared.file);
    const row = 'file' in declared ? parseWorldScenePlacement(JSON.parse(decoder.decode(await product.file(declared.file)))) : declared;
    if (row.id !== declared.id) throw new Error('Scene placement blob identity differs');
    placements.push(row);
    if (catalogue?.models.some(model => model.key === row.model) !== true) throw new Error(`Missing scene placement model: ${row.model}`);
    if (row.batch !== undefined) {
      const batch = batches.get(row.batch), model = catalogue.models.find(entry => entry.key === row.model);
      if (batch === undefined || row.draw !== 'batched' || model === undefined || model.choices.some(choice => [choice.draws, ...choice.lods.map(level => level.draws)].some(draws => draws.length !== 1 || draws.some(draw => draw.material !== batch.material)))) throw new Error('Scene placement cannot share the declared batch');
      const count = (reservations.get(row.batch) ?? 0) + row.poses.length;
      if (count > batch.capacity.instances) throw new Error('Scene batch instance capacity exceeded');
      reservations.set(row.batch, count);
    }
    for (const id of [row.id, `${row.id}.root`, `${row.id}.colliders`]) {
      if (published.has(id)) throw new Error(`Duplicate world scene publication: ${id}`);
      published.add(id);
    }
    await buildYield(resident);
  }
  for (const step of section.steps) {
    await prepareSceneDrawRows(product, step.draws ?? []);
    for (const row of step.draws ?? []) if (!slots.has(row.material)) throw new Error(`Missing scene draw slot: ${row.material}`);
    const files = step.variants === undefined ? [step.scene] : [step.variants.standalone, step.variants.cell];
    for (const file of files) {
      if (file === undefined) throw new Error('Missing world scene recipe');
      requireFile(file);
      if (!recipes.has(file)) recipes.set(file, parseWorldScene(JSON.parse(decoder.decode(await product.file(file)))));
      const recipe = recipes.get(file);
      if (recipe === undefined) throw new Error('Missing admitted scene recipe');
      admitWorldSceneStepSources(product, step, recipe);
      const nodes = new Map(recipe.scene.nodes.map(node => [node.id, node]));
      const attributes = new Set<string>();
      for (const row of step.instanceAttributes) {
        const part = nodes.get(row.part), key = `${row.part}.${row.target === 'instanceColor' ? '#instanceColor' : row.name}`;
        if (part?.kind !== 'mesh' || part.instances === undefined || row.values.length !== part.instances * row.width || attributes.has(key)) throw new Error('Invalid scene instance attributes');
        attributes.add(key);
      }
      if (nodes.get(recipe.scene.root)?.kind !== 'group') throw new Error('World scene needs a group root');
      for (const node of recipe.scene.nodes) if (node.kind === 'mesh' && step.geometry[node.geometry] === undefined) throw new Error(`Missing scene geometry port: ${node.geometry}`);
      for (const material of recipe.scene.materials) if (material.kind === 'port' && step.materials[material.source] === undefined) throw new Error(`Missing scene material port: ${material.source}`);
      for (const row of [...step.registry, ...step.bounds, ...step.instanceAttributes]) if (!nodes.has(row.part)) throw new Error(`Missing scene part: ${row.part}`);
      for (const binding of Object.values(step.publish)) if ('part' in binding && binding.kind !== 'standard-material' && !(binding.kind === 'colliders' ? step.registry.some(row => row.id === binding.part) : nodes.has(binding.part))) throw new Error(`Missing scene publication: ${binding.part}`);
    }
    if (step.registry.length > 0 && step.repeat?.some(row => row.rotation !== undefined && (row.rotation[0] !== 0 || row.rotation[2] !== 0)) === true) throw new Error('Collider repeat poses rotate about Y only');
    for (const ref of Object.values(step.geometry)) reference(ref);
    for (const slot of Object.values(step.materials)) if (!slots.has(slot)) throw new Error(`Missing world scene material: ${slot}`);
    for (const instance of step.repeat ?? [{ id: '' }]) for (const key of [ 'root', ...Object.keys(step.publish), ...step.collectMaterials ?? []]) {
      const id = [step.id, instance.id, key].filter(Boolean).join('.');
      if (published.has(id)) throw new Error(`Duplicate world scene publication: ${id}`); published.add(id);
    }
    await buildYield(resident);
  }
  for (const row of placements) if (row.drawnInto !== undefined && (!published.has(row.drawnInto.part) && !deferredPlacements.has(row.id) || row.drawnInto.boxes.length !== row.poses.length * 6)) throw new Error('Scene placement needs a published part and one box per copy');
  // Specimen graphs are fully admitted above; their buffers belong to a requested
  // Explorer choice, rather than every resident world and inactive profile.
  const residentModels = catalogue === undefined ? undefined : { ...catalogue, models: catalogue.models.filter(model => model.assembly !== 'scene') };
  const coldOnly = (ref: { readonly library: string }): boolean => { const row = libraryRows.get(ref.library); return row?.kind === 'whole' && row.load === 'explorer'; };
  const modelGeometry = residentModels === undefined ? [] : worldSceneModelResources(residentModels).geometry.filter(ref => !coldOnly(ref));
  const activeSteps = section.steps.filter(step => step.load !== 'explorer' && (step.cube === undefined || step.cube === (ctx.cube === null ? 'standalone' : 'cell')));
  // Collision predicates may only read an already published scalar from the
  // selected scene graph. Reject absent, wrong-kind and future refs before any
  // geometry, physics piece or active callback can be installed.
  const activeNumbers = new Set<string>();
  for (const step of activeSteps) for (const instance of step.repeat ?? [{ id: '' }]) {
    const prefix = [step.id, instance.id].filter(Boolean).join('.');
    for (const [id, row] of Object.entries(step.publish)) if (row.kind === 'number') activeNumbers.add(`${prefix}.${id}`);
    for (const row of step.registry) if (row.active !== undefined && !activeNumbers.has(row.active)) throw new Error(`Scene collision requires a published scalar: ${row.active}`);
  }
  const residentReferences = new Set([...modelGeometry, ...activeSteps.flatMap(step => Object.values(step.geometry)),
    ...[...batches.values()].flatMap(row => row.geometry),
    ...welds.flatMap(row => row.resources.flatMap(resource => resource.kind === 'geometry' ? [resource.source] : [])
      .concat(row.nodes.flatMap(node => 'geometry' in node ? [node.geometry] : [])))].map(ref => JSON.stringify([ref.library, ref.model])));
  const owner = resident.child('world-scenes'), libraries = new Map<string, Library>(), materials = new Map<string, Material>(), finish: (() => void)[] = [];
  const handles = new SceneHandles(ctx.game.runtime?.world?.sky);
  if (section.cosmeticDraws !== undefined) {
    const random = ctx.app.rng.stream('cosmetic');
    for (let draw = 0; draw < section.cosmeticDraws; draw++) random.next();
  }
  try {
    for (const row of section.libraries) {
      if (row.kind === 'models') {
        const models = sceneModelSource(product, row.id); await models.preload(() => buildYield(owner));
        libraries.set(row.id, { geometry: id => models.geometry(id), models });
      } else if (row.kind === 'baked') { await sceneBakeSource(product, row.id).load();
      } else if (row.kind === 'whole') {
        const used = new Set(row.models.flatMap(model => residentReferences.has(JSON.stringify([row.id, model.id])) ? [model.id] : []));
        if (row.load === 'explorer' || used.size === 0) continue;
        const whole = await readWholeLibrary(owner, product, row, used, () => buildYield(owner));
        finish.push(whole.done); libraries.set(row.id, { geometry: whole.geometry });
      } else if (row.kind === 'owned') {
        const models = new Map<string, ReturnType<typeof createOwnedGeometry>>();
        for (const model of row.models) {
          if (!residentReferences.has(JSON.stringify([row.id, model.id]))) continue;
          const file = typeof model.file === 'string' ? model.file : model.file[TIER];
          const geometry = createOwnedGeometry(product.url(file), model.attributes);
          await geometry.load(await product.file(file), model.segments === undefined ? undefined : await Promise.all(model.segments.map(segment => product.file(segment)))); models.set(model.id, geometry);
          // Transfer on first use; later copies come from the independently owned original.
          await buildYield(owner);
        }
        libraries.set(row.id, { geometry: id => models.get(id)?.copy() ?? null });
      } else {
        const models = createModelLibrary({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
          paintedModels: row.painted.map(model => ({ name: model.id, url: product.url(model.file), geometry: model.geometry })),
          geometryPools: row.files.map(file => ({ url: product.url(file.file), parts: file.parts })) }, 'world scene library', {},
          async url => { const file = [...row.files, ...row.painted].find(entry => product.url(entry.file) === url); if (file === undefined) throw new Error('Missing scene library file');
            const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import('three/examples/jsm/loaders/GLTFLoader.js'), import('three/examples/jsm/libs/meshopt_decoder.module.js')]);
            return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(Uint8Array.from(await product.file(file.file)).buffer, ''); });
        await models.preload(() => buildYield(owner));
        libraries.set(row.id, { geometry: id => models.geometry(id), models });
      }
      await buildYield(owner);
    }
    const missing = section.materials.flatMap(row => (row.kind === 'look' || row.kind === 'surface') && row.look !== undefined
      && !(row.kind === 'look' && row.over === undefined && sceneMaterial(resident, product.slug, row.look) !== undefined) && !hasLentLook(row.look) ? [row.look] : [])
      .concat((section.lent ?? []).flatMap(row => row.looks.filter(look => !hasLentLook(look))));
    if (missing.length > 0) lendLooks(owner, await runtimeLookMaterials({ scope: owner, game: ctx.game }, product.shardfile, true, [...new Set(missing)]));
    await lendWorldSceneTextures(section.lent ?? [], owner, product, handles, section.lent?.some(row => row.kind === 'product') === true ? ctx.game.runtime?.world?.game.renderer : undefined);
    const surfaces = section.materials.filter(row => row.kind === 'surface');
    if (surfaces.length > 0) {
      const sky = ctx.game.runtime?.world?.sky; if (sky === undefined) throw new Error('Scene surface needs world sky');
      await prepareWorldSceneSurfaces(surfaces, sky, product, owner);
    }
    for (const row of section.materials) {
      if (row.kind === 'source' && row.load === 'placement' && row.publishObject === undefined && !welds.some(weld => weld.nodes.some(node => 'material' in node && node.material === row.id))
        && !frozenSlots.has(row.id)) continue;
      const model = row.kind === 'look' && row.over !== undefined ? libraries.get(row.over.library)?.models?.painted(row.over.model) : undefined;
      if (row.kind === 'look' && row.over !== undefined && (model === undefined || model === null)) throw new Error('Scene material overlay requires a mapped library model');
      let material: Material;
      if (row.kind === 'surface') {
        const sky = ctx.game.runtime?.world?.sky; if (sky === undefined) throw new Error('Scene surface needs world sky');
        material = await worldSceneSurfaceMaterial(row, sky, product, owner);
      } else if (row.kind === 'source') {
        const sky = ctx.game.runtime?.world?.sky; if (sky === undefined) throw new Error('Source scene materials need a world sky');
        material = await worldSceneSourceMaterial(row, sky, owner, handles);
      } else if (row.kind === 'standard') material = new MeshStandardMaterial(row.properties);
      else if (row.kind === 'basic') material = new MeshBasicMaterial(row.properties);
      else if (row.kind === 'lowpoly') {
        const sky = ctx.game.runtime?.world?.sky; if (sky === undefined) throw new Error('Scene family material needs a world sky');
        material = lowPolyLookMaterial(sky, row.variant, value => { Object.assign(value, row.properties); });
      } else material = model === undefined || model === null ? sceneMaterial(resident, product.slug, row.look) ?? lentLook(row.look) : lentMappedLook(row.look, model.map);
      if (row.kind === 'standard' && row.sky === true) {
        const sky = ctx.game.runtime?.world?.sky; if (sky === undefined) throw new Error('Sky-aware scene materials need a world sky');
        sky.setupMaterial(material);
      }
      materials.set(row.id, material); handles.publish(`materials.${row.id}`, material);
      if (row.kind === 'standard' || row.kind === 'basic') owner.onDispose(() => { material.dispose(); });
      await buildYield(owner);
    }
    const sky = ctx.game.runtime?.world?.sky, game = ctx.game.runtime?.world?.game, preparedBatches = new Map<string, WorldSceneBatch>();
    for (const row of welds) {
      for (const resource of row.resources) {
        const shape = resource.kind === 'seeds' ? new BufferGeometry().setAttribute('seed', new BufferAttribute(new Float32Array(Uint32Array.from(resource.words).buffer), 4))
          : libraries.get(resource.source.library)?.geometry(resource.source.model);
        if (shape === undefined || shape === null) throw new Error('Missing frozen scene resource');
        handles.publish(resource.id, shape); owner.onDispose(() => { shape.dispose(); handles.release(resource.id, shape); });
      }
      const geometry = new Map<string, BufferGeometry>();
      for (const node of row.nodes) if ('geometry' in node) {
        const key = JSON.stringify([node.geometry.library, node.geometry.model]);
        if (geometry.has(key)) continue;
        const shape = libraries.get(node.geometry.library)?.geometry(node.geometry.model);
        if (shape === undefined || shape === null) throw new Error('Missing frozen scene geometry');
        // Decoder-only staging is adopted by the assembly, never uploaded.
        geometry.set(key, shape);
      }
      handles.publish(row.id, new WorldSceneWeldAssembly(row, handles, { geometry, materials, plumbing: product.shardfile.plumbing }, owner, ctx.app.registry));
    }
    if (batches.size > 0 && sky === undefined) throw new Error('Scene batches need a world sky');
    for (const row of batches.values()) {
      const material = materials.get(row.material); if (material === undefined) throw new Error('Missing admitted scene batch material');
      const preparedGeometry = row.geometry.map(source => {
        const geometry = libraries.get(source.library)?.geometry(source.model);
        if (geometry === undefined || geometry === null) throw new Error('Missing admitted scene batch geometry');
        owner.onDispose(() => { geometry.dispose(); }); return geometry;
      });
      const batch = new WorldSceneBatch(row, material, preparedGeometry, owner);
      preparedBatches.set(row.id, batch); handles.publish(row.id, batch);
      if (sky !== undefined && game !== undefined) withOwner(owner, () => { game.onUpdate(() => { batch.update(sky.viewCamera); }); });
      await buildYield(owner);
    }
    if (sky !== undefined && catalogue !== undefined) {
      const geometries = new Map<string, BufferGeometry>();
      for (const draw of modelGeometry) {
        const key = JSON.stringify([draw.library, draw.model]);
        if (geometries.has(key)) continue;
        const geometry = libraries.get(draw.library)?.geometry(draw.model);
        if (geometry === undefined || geometry === null) throw new Error('Missing model catalogue source');
        geometries.set(key, geometry); owner.onDispose(() => { geometry.dispose(); });
      }
      bindWorldSceneModelSources(sharedModelContext(sky), product.shardfile.identity.slug, { catalogue, geometries, materials, plumbing: product.shardfile.plumbing, scenes: modelScenes }, owner);
      const definitions = defineWorldSceneCatalogue(catalogue);
      for (const row of placements) {
        const model = catalogue.models.find(entry => entry.key === row.model);
        const needed = new Set(model?.choices.flatMap(choice => choice.draws.concat(choice.lods.flatMap(level => level.draws)).map(draw => draw.material)));
        const sources = section.materials.filter((source): source is Extract<typeof source, { kind: 'source' }> => source.kind === 'source' && source.load === 'placement' && needed.has(source.id));
        handles.publish(row.id, new WorldScenePlacement(ctx, row, definitions, owner, materials, sources, handles, row.batch === undefined ? undefined : preparedBatches.get(row.batch)));
      }
    }
    for (const step of activeSteps) for (const instance of step.repeat ?? [{ id: '' }]) {
      const file = step.variants === undefined ? step.scene : ctx.cube === null ? step.variants.standalone : step.variants.cell;
      const recipe = file === undefined ? undefined : recipes.get(file); if (recipe === undefined) throw new Error('Missing admitted scene recipe');
      const geometry = new Map<string, BufferGeometry>();
      for (const [port, ref] of Object.entries(step.geometry)) {
        const source = libraries.get(ref.library)?.geometry(ref.model); if (source === undefined || source === null) throw new Error(`Missing scene geometry: ${port}`);
        geometry.set(port, source); owner.onDispose(() => { source.dispose(); });
      }
      const sources = worldSceneStepSources(product, step, geometry, new Map(Object.entries(step.materials).map(([port, slot]) => [port, materials.get(slot)])));
      const made = createWorldScene(recipe, sources.ports);
      owner.onDispose(() => { made.dispose(); });
      drawSceneRows(product, step.draws ?? [], made.root, owner, materials);
      if (instance.position !== undefined) made.root.position.set(...instance.position);
      if (instance.rotation !== undefined) made.root.rotation.set(...instance.rotation);
      for (const row of step.bounds) {
        const part = made.parts.get(row.part); if (!mesh3(part)) throw new Error('Scene bounds require a mesh');
        part.geometry.boundingSphere = new Sphere(new Vector3(...row.sphere.center), row.sphere.radius);
      }
      for (const row of step.instanceAttributes) {
        const part = made.parts.get(row.part);
        if (!instances3(part) || row.values.length !== part.count * row.width) throw new Error('Scene instance attribute count differs');
        const values = new InstancedBufferAttribute(Float32Array.from(row.values), row.width);
        if (row.target === 'instanceColor') part.instanceColor = values; else part.geometry.setAttribute(row.name, values);
      }
      const prefix = [step.id, instance.id].filter(Boolean).join('.');
      handles.publish(`${prefix}.root`, made.root);
      for (const [id, values] of sources.collections) handles.publishMaterials(`${prefix}.${id}`, values);
      const registered = new Map<string, { root: Object3D; colliders: ColliderDesc[] }>();
      const position = instance.position ?? [0, 0, 0], rotation = instance.rotation ?? [0, 0, 0];
      const pose = poseOf({ x: position[0], y: position[1], z: position[2], yaw: rotation[1] });
      for (const row of step.registry) {
        const object = made.parts.get(row.part); if (object === undefined) throw new Error('Missing scene registry part');
        const native = readColliderRows(row.colliders, { kinds: ['box', 'treads', 'hull'], surfaces: ['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth'] });
        registered.set(row.id, { root: object, colliders: pose.upright && pose.x === 0 && pose.y === 0 && pose.z === 0 ? native : native.map(shape => placeCollider(shape, pose)) });
      }
      const kinds = Object.fromEntries(Object.entries(step.publish).map(([key, row]) => [key, row.kind]));
      for (const [key, value] of Object.entries(bindWorldSceneParts({ ...made, baked: registered }, kinds, step.publish))) {
        if (Array.isArray(value)) handles.publishColliders(`${prefix}.${key}`, value);
        else handles.publish(`${prefix}.${key}`, value);
      }
      for (const row of step.registry) {
        const prepared = registered.get(row.id); if (prepared === undefined) throw new Error('Missing scene registry part');
        const scalar = row.active;
        const active = scalar === undefined ? undefined : () => handles.number(scalar) !== 0;
        withOwner(owner, () => ctx.app.registry.add({ id: instance.id === '' ? row.id : `${row.id}.${instance.id}`, name: row.name, file: row.file, category: row.category, object: prepared.root, colliders: prepared.colliders, ...(row.surface === undefined ? {} : { surface: row.surface }), solidFloor: row.solidFloor, ...(active === undefined ? {} : { active }), ...(row.mode === undefined ? {} : { mode: row.mode }) }));
        await buildYield(owner);
      }
      if (section.libraries.some(row => row.kind === 'models' || row.kind === 'baked')) ctx.root.add(made.root);
      await buildYield(owner);
    }
    // Every live/deferred consumer now owns a copy; retire decoder templates.
    libraries.clear(); for (const done of finish) done();
    return handles;
  } catch (error) { owner.dispose(); throw error; }
}
