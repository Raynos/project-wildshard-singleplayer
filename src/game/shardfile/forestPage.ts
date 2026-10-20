/** Client-only forest fields, living buildings and their native resource lifetime. */
import type { FieldModelsContext } from '../shard/manifest';
import { Group, Vector3, type Object3D } from 'three';
import * as v from 'valibot';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { Scope } from '@wildshard/engine/app/scope';
import { macrotask } from '@wildshard/engine/boot/plan';
import { buildTier, TIER_CONFIG } from '@wildshard/engine/core/tier';
import { Grass } from '@wildshard/engine/world/Grass';
import { setSight } from '@wildshard/engine/world/interact/Interactables';
import { LightPool } from '@wildshard/engine/fx/LightPool';
import { floorAtRects } from '@wildshard/engine/physics/box';
import { ForestPageSchema, LivingPageInputSchema, LivingPageSitesSchema, type ForestPageRows } from '@wildshard/format/forestPage';
import { ForestGround } from '../looks/forestGround';
import { Particles } from '../systems/looks/particles';
import { trample, TRAMPLE_GLSL } from '../systems/looks/trample';
import { plumbingKnob } from '../shard/declaredPlumbing';
import { LivingBuildings } from './livingBuildings';
import { installWorldScenes } from './worldScenes';
import { hydrateWorldSceneWeld } from './worldSceneWeld';
import { residentWorldScope } from './hybridPresentation';
import { runtimeLookMaterials } from './runtimeProduct';
import { lendLooks, setLentParam } from './lentLooks';
import type { SceneHandles } from './sceneHandles';
import type { ShardContext } from '../plugin/context';

export interface LivingPage {
  readonly resources: SceneHandles; readonly life: LivingBuildings; readonly group: Group;
  readonly buildings: v.InferOutput<typeof LivingPageSitesSchema>['buildings'];
  readonly roofs: v.InferOutput<typeof LivingPageSitesSchema>['roofs']; readonly roots: readonly Object3D[];
}
export interface ForestPage {
  readonly rows: ForestPageRows; readonly resources: SceneHandles; readonly cabins: LivingPage;
  readonly grass: Grass; readonly under: ForestGround; readonly particles: Particles;
  readonly streams: { group: Group; water: Object3D; spray: Object3D };
  readonly props: { colliderDescs: () => ColliderDesc[] };
  readonly update: (dt: number, time: number) => void;
  readonly roofAt: (x: number, z: number) => boolean; readonly finish: () => Promise<void>;
}
const pages = new WeakMap<Scope, Map<string, ForestPage>>();
/** Borrow actual native scene/life owners by declared page identity. */
export function forestPage(scope: Scope, id: string): ForestPage {
  const page = pages.get(scope)?.get(id); if (scope.disposed || page === undefined) throw new Error('Missing entered forest page'); return page;
}
/** Graph admission is separate so custom water views can bind before geometry. */
export async function prepareForestPageLooks(ctx: ShardContext, input: unknown): Promise<void> {
  const rows = v.parse(ForestPageSchema, input);
  lendLooks(ctx.scope, await runtimeLookMaterials(ctx, ctx.product.shardfile, true, rows.graphs));
}
export async function prepareForestPage(ctx: ShardContext, input: unknown): Promise<ForestPage> {
  const rows = v.parse(ForestPageSchema, input), runtime = ctx.game.runtime, world = runtime?.world, step = runtime?.step;
  if (runtime === undefined || world === undefined || world === null || step === undefined || step === null) throw new Error('Forest page requires staged native services');
  if (pages.get(ctx.scope)?.has(rows.id) === true) throw new Error('Duplicate forest page');
  const { game, sky, forest, player, registry } = world;
  ctx.app.registerTrample(trample, ctx.scope);
  const resources = await installWorldScenes(ctx, ctx.product.section('world/scenes'), residentWorldScope(ctx));
  const streams = { group: resources.group(rows.streams.group), water: resources.mesh(rows.streams.water), spray: resources.mesh(rows.streams.spray) }; game.scene.add(streams.group);
  const carpet = await step('grass', async () => {
    const grass = ctx.scope.run(() => new Grass(sky, forest, { trample: { field: trample, glsl: TRAMPLE_GLSL } }).build()); await macrotask();
    const under = await ForestGround.prepare(ctx, rows.ground, forest, sky), particles = ctx.scope.run(() => new Particles(sky, forest).build());
    game.scene.add(grass.group, under.group, particles.group); return { grass, under, particles };
  });
  runtime.overhead.push(carpet.grass.group, carpet.under.group, carpet.particles.group);
  const cabins = await step('cabins', async () => {
    const row = rows.buildings, tier = buildTier(), knob = (id: string): boolean => plumbingKnob(ctx.product.shardfile.plumbing, tier, id, 'boolean', TIER_CONFIG);
    const shadow = knob(row.shadow), shared = knob(row.shared), variant = row.variants.find(entry => entry.tier === tier && entry.shadow === shadow && entry.shared === shared);
    if (variant === undefined) throw new Error('Missing declared living topology');
    const topology = v.parse(LivingPageInputSchema, await ctx.product.json(variant.file)), group = new Group(); resources.publish(row.root, group);
    const geometry = new Map(topology.geometry.map(entry => [entry.key, resources.geometry(entry.id)]));
    const materials = new Map(ctx.product.section('world/scenes').materials.filter(entry => resources.has(row.material + entry.id)).map(entry => [entry.id, resources.material(row.material + entry.id)]));
    const life = ctx.scope.run(() => new LivingBuildings(resources, row.life)), owner = residentWorldScope(ctx);
    if (shared) for (let i = 0; i < row.light.count; i++) { const light = row.light; topology.life.shared.push(resources.lend(LightPool.for(game.scene).acquire(light.color, light.intensity, light.distance, light.decay))); }
    hydrateWorldSceneWeld(topology.graph, resources, { geometry, materials, plumbing: ctx.product.shardfile.plumbing }, owner); life.add(topology.life);
    const sites = v.parse(LivingPageSitesSchema, await ctx.product.json(row.sites));
    const page: LivingPage = { resources, life, group, ...sites, roots: sites.buildings.filter(entry => entry.standalone).map(entry => resources.object(entry.root)) };
    game.scene.add(group); runtime.interactables.push(...life.interactables); await resources.assemble(row.shells);
    life.persist(ctx.app.saves, owner, { id: ctx.manifest.slug, shard: ctx.manifest.slug, group: row.save }); life.registerDoors(registry, player.position);
    for (const prompt of life.interactables) setSight(prompt, { slack: row.sightSlack }); return page;
  });
  const contacts: ColliderDesc[] = [], props = { colliderDescs: () => [...contacts] };
  const eye = new Vector3(), sun = [1, 1, 1], row = rows.buildings;
  let finished = false;
  const page: ForestPage = { rows, resources, cabins, ...carpet, streams, props,
    finish: async () => { if (finished) throw new Error('Forest page already finished'); finished = true;
      await step('props', async () => { for (const id of rows.props) contacts.push(...(await resources.place(id)).colliders); }); },
    roofAt: (x, z) => floorAtRects(row.floors, x, z, 'first') !== undefined,
    update: (dt, time) => { const viewer = runtime.viewer();
      for (const binding of rows.treeLooks) { const fade = world.forest.factory.fade[binding.band].value; setLentParam(binding.look, binding.fade, [fade.x, fade.y]); setLentParam(binding.look, binding.viewer, [viewer.x, viewer.y, viewer.z]); }
      carpet.grass.update(dt, viewer); carpet.under.update(dt, viewer); carpet.particles.update(dt, viewer, game.camera);
      sky.viewCamera.getWorldPosition(eye); cabins.life.tick(dt, time, eye, sky.lamps); sun[0] = sky.sunColor.r; sun[1] = sky.sunColor.g; sun[2] = sky.sunColor.b;
      setLentParam(row.hearth, row.sunParam, sun); setLentParam(row.hearth, row.lampsParam, sky.lamps); setLentParam(row.hearth, row.shadeParam, 1 - row.nightShade * sky.night); } };
  const book = pages.get(ctx.scope) ?? new Map<string, ForestPage>(); book.set(rows.id, page); pages.set(ctx.scope, book); ctx.scope.onDispose(() => { book.delete(rows.id); });
  Object.assign(runtime.objects, { cabins, props, streams, ...carpet }); return page;
}

/** Native drawing context for a shard's counted model definitions. */
export function forestFieldModels(ctx: ShardContext, id: string): FieldModelsContext<ForestGround> {
  const page = forestPage(ctx.scope, id), world = ctx.game.runtime?.world;
  if (world === undefined || world === null) throw new Error('Forest drawing requires its native world');
  return { sky: world.sky, renderer: world.game.renderer, forest: world.forest, under: page.under, registry: world.registry };
}
