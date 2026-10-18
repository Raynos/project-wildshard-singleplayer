import { SceneHandles } from './sceneHandles';
import { type BufferGeometry, InstancedBufferAttribute, InstancedMesh, type Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, type Object3D, Sphere, Vector3 } from 'three';
import { sharedModelContext } from '@wildshard/engine/models/model';
import { bindWorldSceneModelSources, defineWorldSceneCatalogue } from '../models/worldSceneCatalogue';
import { worldSceneSourceMaterial } from './worldSceneMaterials';
import { WorldScenePlacement } from './worldScenePlacement';
import { WorldSceneBatch } from './worldSceneBatch';
import { parseWorldScenePlacement, type WorldScenePlacementRow } from '@wildshard/format/worldScenePlacement';
import { poseOf, placeCollider, readColliderRows } from '@wildshard/engine/models/colliders';
import { createOwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { withOwner } from '@wildshard/engine/app/ownership';
import { buildYield } from '@wildshard/engine/core/workSlice';
import type { Scope } from '@wildshard/engine/app/scope';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { parseWorldSceneModels } from '@wildshard/format/worldSceneModels';
import { parseWorldScenes, type WorldScenesSection } from '@wildshard/format/worldScenes';
import { parseWorldScene, type WorldSceneRecipe } from '@wildshard/format/clientChannels';
import type { ShardContext } from '../plugin/context';
import { createModelLibrary, type ModelLibrary } from '../plugin/geometry';
import { createWorldScene, bindWorldSceneParts } from '../plugin/ui';
import { hasLentLook, lentLook, lentMappedLook, lendLooks } from './lentLooks';
import { runtimeLookMaterials } from './runtimeProduct';

function instances3(value: unknown): value is InstancedMesh { return value instanceof InstancedMesh; }
function mesh3(value: unknown): value is Mesh { return value instanceof Mesh; }
interface Library {
  readonly geometry: (id: string) => BufferGeometry | null;
  readonly models?: ModelLibrary<never, never>;
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
  try { section = parseWorldScenes(input); } catch (error) { return Promise.reject(error instanceof Error ? error : new Error('World scene admission failed', { cause: error })); }
  const pending = build(ctx, section, resident);
  products.set(ctx.product, pending);
  const cache = products;
  void pending.catch(() => { if (cache.get(ctx.product) === pending) cache.delete(ctx.product); });
  resident.onDispose(() => { cache.delete(ctx.product); });
  return pending;
}

async function build(ctx: ShardContext, section: WorldScenesSection, resident: Scope): Promise<SceneHandles> {
  const product = ctx.product, recipes = new Map<string, WorldSceneRecipe>(), libraryRows = new Map(section.libraries.map(row => [row.id, row]));
  const slots = new Set(section.materials.map(row => row.id));
  const requireFile = (name: string): void => { if (!product.hasFile(name)) throw new Error(`Missing world scene blob: ${name}`); };
  const reference = (ref: { readonly library: string; readonly model: string }, mapped = false): void => {
    const library = libraryRows.get(ref.library);
    if (library === undefined || !(mapped ? library.kind === 'pool' && library.painted.some(row => row.id === ref.model) : library.kind === 'owned' ? library.models.some(row => row.id === ref.model) : library.files.some(row => row.parts.includes(ref.model)))) throw new Error(`Missing world scene model: ${ref.library}/${ref.model}`);
  };
  // Admission precedes geometry/material allocation, including both cube variants.
  for (const row of section.libraries) for (const file of row.kind === 'owned' ? row.models.map(model => model.file) : [...row.files.map(entry => entry.file), ...row.painted.map(entry => entry.file)]) requireFile(file);
  for (const row of section.materials) if (row.kind === 'look') {
    if (product.shardfile.look.materials[row.look] === undefined) throw new Error(`Missing world scene look: ${row.look}`);
    if (row.over !== undefined) reference(row.over, true);
  }
  let catalogue: ReturnType<typeof parseWorldSceneModels> | undefined;
  if (section.catalogue !== undefined) {
    requireFile(section.catalogue);
    catalogue = parseWorldSceneModels(JSON.parse(decoder.decode(await product.file(section.catalogue))));
    if (!Object.is(catalogue.product, product.shardfile.identity.slug)) throw new Error('Scene catalogue product identity differs');
    for (const model of catalogue.models) for (const choice of model.choices) for (const draw of [...choice.draws, ...choice.lods.flatMap(level => level.draws)]) {
      reference(draw);
      if (libraryRows.get(draw.library)?.kind !== 'owned' || !slots.has(draw.material)) throw new Error('Scene catalogue needs owned geometry and declared material slots');
    }
  }
  const immediate = new Set(section.steps.flatMap(step => Object.values(step.materials)));
  if (section.materials.some(row => row.kind === 'source' && row.load === 'placement' && immediate.has(row.id))) throw new Error('Deferred source material requires a named model placement');
  const published = new Set<string>();
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
    const files = step.variants === undefined ? [step.scene] : [step.variants.standalone, step.variants.cell];
    for (const file of files) {
      if (file === undefined) throw new Error('Missing world scene recipe');
      requireFile(file);
      if (!recipes.has(file)) recipes.set(file, parseWorldScene(JSON.parse(decoder.decode(await product.file(file)))));
      const recipe = recipes.get(file);
      if (recipe === undefined) throw new Error('Missing admitted scene recipe');
      if (recipe.imports.length > 0) throw new Error('World scene import needs a declared library binding');
      if (recipe.scene.textures.length > 0 || recipe.scene.nodes.some(node => node.kind === 'object' || node.kind === 'anchor')) throw new Error('Scene objects and textures need explicit library bindings');
      const nodes = new Map(recipe.scene.nodes.map(node => [node.id, node]));
      const attributes = new Set<string>();
      for (const row of step.instanceAttributes) {
        const part = nodes.get(row.part), key = `${row.part}.${row.name}`;
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
    for (const instance of step.repeat ?? [{ id: '' }]) for (const key of [ 'root', ...Object.keys(step.publish)]) {
      const id = [step.id, instance.id, key].filter(Boolean).join('.');
      if (published.has(id)) throw new Error(`Duplicate world scene publication: ${id}`); published.add(id);
    }
    await buildYield(resident);
  }
  const owner = resident.child('world-scenes'), libraries = new Map<string, Library>(), materials = new Map<string, Material>();
  const handles = new SceneHandles(ctx.game.runtime?.world?.sky);
  try {
    for (const row of section.libraries) {
      if (row.kind === 'owned') {
        const models = new Map<string, ReturnType<typeof createOwnedGeometry>>();
        for (const model of row.models) {
          const geometry = createOwnedGeometry(product.url(model.file), model.attributes);
          await geometry.load(await product.file(model.file)); models.set(model.id, geometry);
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
    const missing = section.materials.flatMap(row => row.kind === 'look' && !hasLentLook(row.look) ? [row.look] : []);
    if (missing.length > 0) lendLooks(owner, await runtimeLookMaterials({ scope: owner, game: ctx.game }, product.shardfile, true, [...new Set(missing)]));
    for (const row of section.materials) {
      if (row.kind === 'source' && row.load === 'placement') continue;
      const model = row.kind === 'look' && row.over !== undefined ? libraries.get(row.over.library)?.models?.painted(row.over.model) : undefined;
      if (row.kind === 'look' && row.over !== undefined && (model === undefined || model === null)) throw new Error('Scene material overlay requires a mapped library model');
      let material: Material;
      if (row.kind === 'source') {
        const sky = ctx.game.runtime?.world?.sky; if (sky === undefined) throw new Error('Source scene materials need a world sky');
        material = await worldSceneSourceMaterial(row, sky, owner);
      } else if (row.kind === 'standard') material = new MeshStandardMaterial(row.properties);
      else if (row.kind === 'basic') material = new MeshBasicMaterial(row.properties);
      else if (row.kind === 'lowpoly') {
        const sky = ctx.game.runtime?.world?.sky; if (sky === undefined) throw new Error('Scene family material needs a world sky');
        material = lowPolyLookMaterial(sky, row.variant, value => { Object.assign(value, row.properties); });
      } else material = model === undefined || model === null ? lentLook(row.look) : lentMappedLook(row.look, model.map);
      if (row.kind === 'standard' && row.sky === true) {
        const sky = ctx.game.runtime?.world?.sky; if (sky === undefined) throw new Error('Sky-aware scene materials need a world sky');
        sky.setupMaterial(material);
      }
      materials.set(row.id, material); handles.publish(`materials.${row.id}`, material);
      if (row.kind === 'standard' || row.kind === 'basic') owner.onDispose(() => { material.dispose(); });
      await buildYield(owner);
    }
    const sky = ctx.game.runtime?.world?.sky, game = ctx.game.runtime?.world?.game, preparedBatches = new Map<string, WorldSceneBatch>();
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
      for (const draw of catalogue.models.flatMap(model => model.choices.flatMap(choice => [...choice.draws, ...choice.lods.flatMap(level => level.draws)]))) {
        const key = JSON.stringify([draw.library, draw.model]);
        if (geometries.has(key)) continue;
        const geometry = libraries.get(draw.library)?.geometry(draw.model);
        if (geometry === undefined || geometry === null) throw new Error('Missing model catalogue source');
        geometries.set(key, geometry); owner.onDispose(() => { geometry.dispose(); });
      }
      bindWorldSceneModelSources(sharedModelContext(sky), product.shardfile.identity.slug, { catalogue, geometries, materials }, owner);
      const definitions = defineWorldSceneCatalogue(catalogue);
      for (const row of placements) {
        const model = catalogue.models.find(entry => entry.key === row.model);
        const needed = new Set(model?.choices.flatMap(choice => choice.draws.concat(choice.lods.flatMap(level => level.draws)).map(draw => draw.material)));
        const sources = section.materials.filter((source): source is Extract<typeof source, { kind: 'source' }> => source.kind === 'source' && source.load === 'placement' && needed.has(source.id));
        handles.publish(row.id, new WorldScenePlacement(ctx, row, definitions, owner, materials, sources, row.batch === undefined ? undefined : preparedBatches.get(row.batch)));
      }
    }
    for (const step of section.steps) for (const instance of step.repeat ?? [{ id: '' }]) {
      const file = step.variants === undefined ? step.scene : ctx.cube === null ? step.variants.standalone : step.variants.cell;
      const recipe = file === undefined ? undefined : recipes.get(file); if (recipe === undefined) throw new Error('Missing admitted scene recipe');
      const geometry = new Map<string, BufferGeometry>();
      for (const [port, ref] of Object.entries(step.geometry)) {
        const source = libraries.get(ref.library)?.geometry(ref.model); if (source === undefined || source === null) throw new Error(`Missing scene geometry: ${port}`);
        geometry.set(port, source); owner.onDispose(() => { source.dispose(); });
      }
      const made = createWorldScene(recipe, { geometry, materials: new Map(Object.entries(step.materials).map(([port, slot]) => [port, materials.get(slot)])),
        model: () => { throw new Error('Undeclared scene model import'); }, baked: () => { throw new Error('Undeclared scene bake import'); } });
      owner.onDispose(() => { made.dispose(); });
      if (instance.position !== undefined) made.root.position.set(...instance.position);
      if (instance.rotation !== undefined) made.root.rotation.set(...instance.rotation);
      for (const row of step.bounds) {
        const part = made.parts.get(row.part); if (!mesh3(part)) throw new Error('Scene bounds require a mesh');
        part.geometry.boundingSphere = new Sphere(new Vector3(...row.sphere.center), row.sphere.radius);
      }
      for (const row of step.instanceAttributes) {
        const part = made.parts.get(row.part);
        if (!instances3(part) || row.values.length !== part.count * row.width) throw new Error('Scene instance attribute count differs');
        part.geometry.setAttribute(row.name, new InstancedBufferAttribute(Float32Array.from(row.values), row.width));
      }
      const prefix = [step.id, instance.id].filter(Boolean).join('.');
      handles.publish(`${prefix}.root`, made.root);
      const registered = new Map<string, { root: Object3D; colliders: ColliderDesc[] }>();
      const position = instance.position ?? [0, 0, 0], rotation = instance.rotation ?? [0, 0, 0];
      const pose = poseOf({ x: position[0], y: position[1], z: position[2], yaw: rotation[1] });
      for (const row of step.registry) {
        const object = made.parts.get(row.part); if (object === undefined) throw new Error('Missing scene registry part');
        const native = readColliderRows(row.colliders, { kinds: ['box', 'treads'], surfaces: ['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth'] });
        registered.set(row.id, { root: object, colliders: pose.upright && pose.x === 0 && pose.y === 0 && pose.z === 0 ? native : native.map(shape => placeCollider(shape, pose)) });
      }
      const kinds = Object.fromEntries(Object.entries(step.publish).map(([key, row]) => [key, row.kind]));
      for (const [key, value] of Object.entries(bindWorldSceneParts({ ...made, baked: registered }, kinds, step.publish))) {
        if (Array.isArray(value)) handles.publishColliders(`${prefix}.${key}`, value);
        else handles.publish(`${prefix}.${key}`, value);
      }
      for (const row of step.registry) {
        const prepared = registered.get(row.id); if (prepared === undefined) throw new Error('Missing scene registry part');
        withOwner(owner, () => ctx.app.registry.add({ id: instance.id === '' ? row.id : `${row.id}.${instance.id}`, name: row.name, file: row.file, category: row.category, object: prepared.root, colliders: prepared.colliders, ...(row.surface === undefined ? {} : { surface: row.surface }), solidFloor: row.solidFloor }));
        await buildYield(owner);
      }
      await buildYield(owner);
    }
    return handles;
  } catch (error) { owner.dispose(); throw error; }
}
