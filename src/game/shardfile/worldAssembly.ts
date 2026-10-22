import { TIER } from '@wildshard/engine/core/tier';
import { gpuOnlyTrees } from '@wildshard/engine/core/gpuOnly';
import { macrotask, slicer, type StepProgress } from '@wildshard/engine/boot/plan';
import type { ShardRuntime } from '../shard/runtime';
import type { IslandLibrary } from '../models/islandLibrary';
import type { defineWorldSceneCatalogue } from '../models/worldSceneCatalogue';
import type { BakedTiles } from './bakedTiles';
import type { Vector3 } from 'three';
import { CoverCompositionSchema } from '@wildshard/format/streamedCover';
import { createStreamedCover } from '../looks/streamedCover';
import { toonLightingOf } from '../looks/toonLighting';
import { createAmbientFlock } from '../ambient/ambientFlock';
import { BuildingLifeLookSchema, BuildingLifeRowsSchema } from '@wildshard/format/buildings';
import { LivingBuildings } from './livingBuildings';
import { createBuildingCloud } from './buildingCloud';
import { hasLentLook, lentLook, lentToon } from './lentLooks';
import type { ShardProduct } from './shardProduct';
import { RopeDeckSite } from '../models/ropeDeckSite';
import { RopeChain } from '@wildshard/engine/physics/ropeChain';
import type { Physics } from '@wildshard/engine/physics/Physics';
import type { Game } from '@wildshard/engine/core/Game';
import type { FixedDraws } from '../models/fixedDraws';
import * as v from 'valibot';
import type { Scope } from '@wildshard/engine/app/scope';
import { sharedModelContext, type ModelContext } from '@wildshard/engine/models/model';
import type { ModelSite } from '@wildshard/engine/models/place';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import { WorldAssemblySchema, type WorldAssemblyStage, type WorldConstructionRows } from '@wildshard/format/worldAssembly';
import { publishEntryOwner, entryOwner, lendEntryOwner } from './entryOwners';
import { WorldEntry, type WorldEntryPorts } from './worldEntry';
import type { SceneHandles } from './sceneHandles';

/** What an assembly builds against: the construction scope its loans belong to, the admitted scene handles, the shard's
 *  site catalogue (for `site` stages), the model context and registry sites register into, and the build's slice. */
export interface WorldAssemblyPorts {
  readonly scope: Scope;
  readonly scenes: SceneHandles;
  readonly sites?: { readonly site: (key: string, choice: string, ctx: ModelContext, registry: WorldRegistry | null) => ModelSite };
  readonly context: ModelContext;
  readonly registry: WorldRegistry | null;
  /** Original already-loaded templates; no stage creates a second intake. */
  readonly draws?: FixedDraws;
  /** The original admitted product reader; site life never creates an intake. */
  readonly product?: Pick<ShardProduct, 'file'>;
  /** The original early-read cells, native viewer and Game registration receiver. */
  readonly cover?: { readonly cells: Uint8Array; readonly viewer: () => Vector3; readonly updates: Pick<Game, 'onUpdate'> };
  /** Original simulation and fixed-post registration authority for rope chains. */
  readonly physics?: Physics;
  readonly fixed?: Pick<Game, 'onFixed'>;
  /** what `entry` stages run their rows against (the world root, tier, variant and piece registration) */
  readonly entry?: Omit<WorldEntryPorts, 'scenes' | 'fence'>;
  /** the build's time slice, after each stage (labelled progress) */
  readonly slice: (label: string) => Promise<void>;
}

/** Existing concrete native authorities; construction never creates another
 * library, scene intake, registry, world or retained owner. */
export interface WorldConstructionPorts {
  readonly runtime: ShardRuntime;
  readonly product: ShardProduct;
  readonly scope: Scope;
  readonly scenes: SceneHandles;
  readonly baked: ReadonlyMap<string, BakedTiles>;
  readonly library: IslandLibrary<unknown>;
  readonly sites: ReturnType<typeof defineWorldSceneCatalogue>;
  readonly progress?: StepProgress;
}

/** G571: an admitted world assembly (format/worldAssembly), run stage by stage in its declared order. Client-only. */
export class WorldAssembly {
  /** One walk of the declared stages, retaining native checkpoint and progress
   * boundaries. The caller keeps its original resident cache and lending. */
  static async construct(input: unknown, ports: WorldConstructionPorts): Promise<void> {
    const parsed = v.parse(WorldAssemblySchema, input), rows = parsed.construction, stages = admitted(input);
    if (rows === undefined) throw new Error('World construction needs its declared checkpoints');
    const { runtime, scope, product, library, scenes, baked } = ports, world = runtime.world;
    if (world === null) throw new Error('World construction needs its native world');
    const { game, sky, player, registry, physics } = world, root = game.scene, viewer = runtime.viewer, read = product.file;
    const live = (): void => {
      if (scope.disposed || scope.disposing || runtime.world !== world || world.game !== game || world.registry !== registry
        || world.sky !== sky || world.physics !== physics || game.scene !== root || runtime.viewer !== viewer
        || product.file !== read || library.product !== product) throw new Error('World construction owner left or changed');
    };
    live();
    const checkpoints = new Map<string, WorldConstructionRows['checkpoints'][number]>();
    const floors = new Set<string>();
    for (const stage of stages) {
      const before = rows.checkpoints.filter(check => check.stage === stage.id && check.at === 'before');
      for (const check of before) for (const action of check.actions) if (action.kind === 'entry-floor' && !floors.has(action.floor)) throw new Error('World checkpoint floor is not constructed yet');
      if (loanKinds(stage).includes('floor')) floors.add(stage.id);
      const after = rows.checkpoints.filter(check => check.stage === stage.id && check.at === 'after');
      for (const check of after) for (const action of check.actions) if (action.kind === 'entry-floor' && !floors.has(action.floor)) throw new Error('World checkpoint floor is not constructed yet');
    }
    for (const check of rows.checkpoints) {
      const key = `${check.at}:${check.stage}`;
      if (!stages.some(stage => stage.id === check.stage) || checkpoints.has(key)) throw new Error('Unknown or repeated world checkpoint');
      checkpoints.set(key, check);
    }
    const [, cells] = await Promise.all([library.load(undefined, game.registrationScope, scope), product.file(rows.cells[TIER])]);
    live();
    const draws = library.loaded(), slice = slicer(rows.progress.budgetMs, ports.progress), total = rows.progress.total;
    let completed = 0;
    const complete = async (label: string): Promise<void> => { await slice(++completed, total, label); };
    const assembly = WorldAssembly.admit(input, { scope, scenes, sites: ports.sites, context: sharedModelContext(sky, game), registry,
      slice: complete, product, draws, physics, fixed: game, cover: { cells, viewer, updates: game },
      entry: { root, tier: game.tier, physics, piece: piece => { registry.add(piece); } } });
    const checkpoint = async (stage: string, at: 'before' | 'after'): Promise<void> => {
      const check = checkpoints.get(`${at}:${stage}`);
      if (check === undefined) return;
      for (const action of check.actions) {
        live();
        if (action.kind === 'entry-floor') {
          const y = entryOwner(scope, 'floor', action.floor)(player.position.x, player.position.z);
          if (y !== undefined) player.position.y = y;
        } else if (action.kind === 'slice') await slice();
        else if (action.kind === 'progress') await complete(action.label);
        else if (action.kind === 'macrotask') await macrotask();
        else if (action.kind === 'seed') { if (rows.seed !== product.shardfile.identity.seed) throw new Error('Foliage placements require their authored seed'); }
        else if (!baked.has(action.id)) throw new Error(`Missing baked world ${action.id}`);
        live();
      }
    };
    ports.progress?.set(0, total, rows.progress.start);
    for (const stage of stages) {
      live(); await checkpoint(stage.id, 'before'); live();
      await assembly.next(stage.id); live();
      await checkpoint(stage.id, 'after'); live();
    }
    await slice(total, total, rows.progress.finish); live();
    // Resolve the WHOLE ordered root list before releasing even one CPU copy.
    const roots = rows.gpu.roots.map(ref => {
      if (ref.kind === 'object') return entryOwner(scope, 'object', ref.id);
      if (ref.kind === 'placed') {
        const [placed] = entryOwner(scope, 'placed', ref.id);
        if (placed === undefined) throw new Error(`World GPU root placed nothing: ${ref.id}`);
        return placed.object;
      }
      if (ref.kind === 'baked') { const value = baked.get(ref.id); if (value === undefined) throw new Error(`Missing baked world ${ref.id}`); return value.group; }
      return ref.as === 'mesh' ? scenes.mesh(ref.id) : ref.as === 'group' ? scenes.group(ref.id) : scenes.object(ref.id);
    });
    live(); gpuOnlyTrees(roots, rows.gpu.label, ['position']);
  }

  private at = 0;
  private constructor(private readonly stages: readonly WorldAssemblyStage[], private readonly ports: WorldAssemblyPorts) {}
  static admit(input: unknown, ports: WorldAssemblyPorts): WorldAssembly { return new WorldAssembly(admitted(input), ports); }

  /** Borrow the completed stages into an entered child, preserving every
   * construction owner. Stage kinds determine the finite loan kinds; no
   * callback, property path or second builder crosses this boundary. */
  static lend(input: unknown, construction: Scope, entered: Scope): void {
    const stages = admitted(input);
    if (entered !== construction && !entered.belongsTo(construction)) throw new Error('World assembly needs its construction ancestor');
    const loans = stages.flatMap(stage => loanKinds(stage).map(kind => ({ kind, id: stage.kind === 'streamed-cover' && kind === 'object' ? stage.object : stage.id })));
    // Refuse an incomplete build before publishing even its first entered loan.
    for (const { kind, id } of loans) entryOwner(construction, kind, id);
    if (entered !== construction) for (const { kind, id } of loans) lendEntryOwner(entered, construction, kind, id);
  }

  /** Run the next declared stage, which must be `id` (the build keeps the declared order), and publish its loans. */
  async next(id: string): Promise<void> {
    const stage = this.stages[this.at];
    if (stage?.id !== id) throw new Error(`World assembly expected ${stage?.id ?? 'no stage'}, not ${id}`);
    const { scope, scenes } = this.ports;
    // a retired or retiring construction (a sliced ancestor retirement) allocates and publishes nothing more
    const live = (): void => { if (scope.disposed || scope.disposing) throw new Error('World assembly owner left'); };
    live();
    const lifeRow = stage.kind === 'site' ? stage.life : undefined;
    const lifePorts = lifeRow === undefined ? undefined : (() => {
      const draws = this.ports.draws, product = this.ports.product;
      if (draws === undefined || !draws.ready || product === undefined) throw new Error('World site life needs loaded draws and its product');
      const draw = draws.handle(lifeRow.cloud.draw), material = hasLentLook(lifeRow.cloud.look) ? lentLook(lifeRow.cloud.look) : null;
      if (scenes.has(lifeRow.root)) throw new Error('World site life root is already published');
      return { draws, draw, product, read: product.file, material };
    })();
    this.at++;
    if (stage.kind === 'streamed-cover') {
      const cover = this.ports.cover, draws = this.ports.draws, product = this.ports.product, root = this.ports.entry?.root;
      if (cover === undefined || draws === undefined || !draws.ready || product === undefined || root === undefined) throw new Error('World cover needs its cells, draws, product and native authority');
      if (typeof cover.viewer !== 'function' || typeof cover.updates.onUpdate !== 'function' || typeof product.file !== 'function') throw new Error('World cover needs its native reader, update and viewer');
      const read = product.file, viewer = cover.viewer, updates = cover.updates, onUpdate = updates.onUpdate, cells = cover.cells;
      const needed = new Set(stage.rows.kinds.flatMap(kind => [kind.geometry, ...kind.far === undefined ? [] : [kind.far.geometry]]));
      if (needed.size !== Object.keys(stage.draws).length || [...needed].some(key => !Object.hasOwn(stage.draws, key))) throw new Error('World cover needs its exact geometry bindings');
      const handles = Object.entries(stage.draws).map(([name, slot]) => {
        if (scenes.has(name)) throw new Error('World cover geometry is already published');
        return { name, slot, handle: draws.handle(slot) };
      });
      const looks = stage.rows.kinds.flatMap(kind => [ ...kind.far === undefined ? [] : [`${stage.rows.look}-${kind.name}-far`], `${stage.rows.look}-${kind.name}` ]).map(lookId => ({ id: lookId, material: lentLook(lookId), toon: lentToon(lookId) }));
      const lighting = toonLightingOf(stage.rows.lighting);
      const unchanged = (): void => {
        live();
        if (this.ports.scenes !== scenes || this.ports.cover !== cover || cover.viewer !== viewer || cover.updates !== updates || updates.onUpdate !== onUpdate || cover.cells !== cells
          || this.ports.draws !== draws || !draws.ready || this.ports.product !== product || product.file !== read || this.ports.entry?.root !== root
          || toonLightingOf(stage.rows.lighting) !== lighting || handles.some(row => draws.handle(row.slot) !== row.handle)
          || looks.some(row => lentLook(row.id) !== row.material || lentToon(row.id) !== row.toon)) throw new Error('World cover owners changed');
      };
      const bytes = await product.file(stage.file); unchanged();
      const composition = v.parse(CoverCompositionSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
      if (composition.placement !== stage.placement) throw new Error('World cover placement differs from its binding');
      const placed = await scenes.place(stage.placement); unchanged();
      if (!scenes.has(composition.mesh)) throw new Error('World cover companion is missing');
      for (const { name, handle } of handles) scenes.publish(name, handle.copy());
      const field = createStreamedCover(scenes, stage.rows, cells); field.group.name = composition.name;
      const logs = scenes.mesh(composition.mesh); Object.assign(logs.userData, composition.userData); field.group.add(logs);
      unchanged(); root.add(field.group); updates.onUpdate(dt => { field.update(dt, viewer()); }, stage.system);
      unchanged(); publishEntryOwner(scope, 'object', stage.object, field.group); publishEntryOwner(scope, 'placed', stage.id, [placed]);
    } else if (stage.kind === 'ambient-flock') {
      const draws = this.ports.draws, root = this.ports.entry?.root;
      if (draws === undefined || !draws.ready || root === undefined) throw new Error('World ambient flock needs loaded draws and its root');
      const draw = draws.handle(stage.draw.slot), material = lentLook(stage.draw.look);
      const flock = createAmbientFlock(stage.rows, { name: stage.draw.look, geometry: draw.copy(), material: material.clone(), castShadow: stage.draw.castShadow }, stage.perches);
      root.add(flock.group);
      publishEntryOwner(scope, 'object', stage.id, flock.group); publishEntryOwner(scope, 'ambient-draw', stage.id, flock); publishEntryOwner(scope, 'ambient', stage.id, flock.flock);
    } else if (stage.kind === 'rope-deck') {
      const draws = this.ports.draws, registry = this.ports.registry;
      if (draws === undefined || !draws.ready) throw new Error('World rope deck needs loaded fixed draws');
      if (registry === null) throw new Error('World rope deck needs its registry');
      draws.handle(stage.site.draws.specimen); draws.handle(stage.site.draws.world);
      const site = new RopeDeckSite(stage.site, { get ready() { return draws.ready; }, draw: slot => draws.handle(slot), load: () => draws.load() });
      const deck = site.place(this.ports.context.sky, stage.span, registry);
      publishEntryOwner(scope, 'object', stage.id, deck.placed.object); publishEntryOwner(scope, 'placed', stage.id, [deck.placed]);
      publishEntryOwner(scope, 'floor', stage.id, deck.floorHeightAt); publishEntryOwner(scope, 'rope-deck', stage.id, deck);
    } else if (stage.kind === 'rope-chain') {
      const physics = this.ports.physics, fixed = this.ports.fixed;
      if (physics === undefined || fixed === undefined) throw new Error('World rope chain needs its physics and fixed-post authority');
      const deck = entryOwner(scope, 'rope-deck', stage.deck), chain = new RopeChain(physics, deck.chainSpec());
      fixed.onFixed('post', () => { chain.capture(); }, stage.capture);
      publishEntryOwner(scope, 'chain', stage.id, chain);
    } else if (stage.kind === 'place') {
      const placed = await scenes.place(stage.id);
      live();
      publishEntryOwner(scope, 'object', stage.id, placed.object); publishEntryOwner(scope, 'placed', stage.id, [placed]);
      publishEntryOwner(scope, 'floor', stage.id, (x, z) => scenes.floorAt(stage.id, x, z));
    } else if (stage.kind === 'site') {
      const sites = this.ports.sites; if (sites === undefined) throw new Error('World assembly site needs its catalogue');
      const site = sites.site(stage.model, stage.choice, this.ports.context, this.ports.registry);
      publishEntryOwner(scope, 'object', stage.id, site.group); publishEntryOwner(scope, 'placed', stage.id, [site.placed]);
      publishEntryOwner(scope, 'site', stage.id, site.anchors); publishEntryOwner(scope, 'floor', stage.id, site.floorHeightAt);
    } else if (stage.kind === 'entry') {
      const ports = this.ports.entry; if (ports === undefined) throw new Error('World assembly entry needs its entry ports');
      if (ports.piece === undefined && stage.rows.some(row => row.kind === 'piece')) throw new Error(`World assembly entry ${stage.id} needs its piece registration`);
      if (ports.physics === undefined && stage.rows.some(row => row.kind === 'cut')) throw new Error(`World assembly entry ${stage.id} needs its physics`);
      const entry = WorldEntry.admit({ blocks: { [stage.id]: stage.rows } }, { ...ports, scenes, fence: live });
      await entry.run(stage.id);
      live();
      publishEntryOwner(scope, 'placed', stage.id, entry.placedIn(stage.id));
      const object = stage.object, floor = stage.floor;
      if (object !== undefined) publishEntryOwner(scope, 'object', stage.id, object.as === 'group' ? scenes.group(object.part) : object.as === 'mesh' ? scenes.mesh(object.part) : scenes.object(object.part));
      if (floor !== undefined) publishEntryOwner(scope, 'floor', stage.id, (x, z) => scenes.floorAt(floor, x, z));
    } else publishEntryOwner(scope, 'object', stage.id, stage.kind === 'mesh' ? scenes.mesh(stage.part) : scenes.group(stage.part));
    await this.ports.slice(stage.label);
    live();
    if (lifeRow !== undefined && lifePorts !== undefined) {
      const group = entryOwner(scope, 'object', stage.id);
      const unchanged = (): void => {
        live();
        const material = hasLentLook(lifeRow.cloud.look) ? lentLook(lifeRow.cloud.look) : null;
        if (this.ports.product !== lifePorts.product || lifePorts.product.file !== lifePorts.read || this.ports.draws !== lifePorts.draws || !lifePorts.draws.ready
          || lifePorts.draws.handle(lifeRow.cloud.draw) !== lifePorts.draw || material !== lifePorts.material
          || entryOwner(scope, 'object', stage.id) !== group) throw new Error('World site life owners changed');
      };
      unchanged();
      scenes.publish(lifeRow.root, group);
      group.add(createBuildingCloud(scenes, { ...lifeRow.cloud.pose, geometry: scenes.lend(lifePorts.draw.copy()),
        material: lifePorts.material === null ? null : scenes.lend(lifePorts.material), visible: lifePorts.material !== null }));
      const bytes = await lifePorts.product.file(lifeRow.file);
      unchanged();
      if (scenes.object(lifeRow.root) !== group) throw new Error('World site life root changed');
      const data = v.parse(v.strictObject({ look: BuildingLifeLookSchema, life: BuildingLifeRowsSchema,
        initialDusk: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)) }), JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
      const life = new LivingBuildings(scenes, data.look); life.add(data.life); life.setDusk(data.initialDusk); life.update(0);
      unchanged(); publishEntryOwner(scope, 'buildings', stage.id, life);
    }
  }

  /** Every declared stage ran. */
  get done(): boolean { return this.at === this.stages.length; }
}

/** Admit an assembly: unique stage ids, every placement placed once across it (place stages and entry place rows), and
 *  an entry's floor one of its own unconditional place rows. */
function admitted(input: unknown): readonly WorldAssemblyStage[] {
  const { stages } = v.parse(WorldAssemblySchema, input);
  if (new Set(stages.map(stage => stage.id)).size !== stages.length) throw new Error('Repeated world assembly owner');
  const placements = stages.flatMap(stage => stage.kind === 'streamed-cover' ? [stage.placement] : stage.kind === 'place' || stage.kind === 'rope-deck' ? [stage.id] : stage.kind === 'entry' ? stage.rows.flatMap(row => row.kind === 'place' ? [row.id] : []) : []);
  if (new Set(placements).size !== placements.length) throw new Error('Repeated world assembly placement');
  for (const stage of stages) if (stage.kind === 'entry' && stage.floor !== undefined && !stage.rows.some(row => row.kind === 'place' && row.id === stage.floor && row.when === undefined)) {
    throw new Error(`World assembly entry ${stage.id} floor needs its unconditional place row`);
  }
  const objectIds = stages.flatMap(stage => loanKinds(stage).includes('object') ? [stage.kind === 'streamed-cover' ? stage.object : stage.id] : []);
  if (new Set(objectIds).size !== objectIds.length) throw new Error('Repeated world assembly object');
  const decks = new Set<string>(), chained = new Set<string>(), captures = new Set<string>();
  for (const stage of stages) {
    if (stage.kind === 'rope-deck') decks.add(stage.id);
    if (stage.kind === 'rope-chain') {
      if (!decks.has(stage.deck)) throw new Error('World rope chain needs an earlier rope-deck stage');
      if (chained.has(stage.deck) || captures.has(stage.capture)) throw new Error('Repeated world rope chain or capture');
      chained.add(stage.deck); captures.add(stage.capture);
    }
  }
  return stages;
}

/** The loan kinds a stage publishes, from its declaration alone. */
function loanKinds(stage: WorldAssemblyStage): readonly ('object' | 'placed' | 'site' | 'floor' | 'rope-deck' | 'chain' | 'buildings' | 'ambient-draw' | 'ambient')[] {
  if (stage.kind === 'streamed-cover') return ['object', 'placed'];
  if (stage.kind === 'ambient-flock') return ['object', 'ambient-draw', 'ambient'];
  if (stage.kind === 'rope-deck') return ['object', 'placed', 'floor', 'rope-deck'];
  if (stage.kind === 'rope-chain') return ['chain'];
  if (stage.kind === 'site') return ['object', 'placed', 'site', 'floor', ...stage.life === undefined ? [] : ['buildings'] as const];
  if (stage.kind === 'place') return ['object', 'placed', 'floor'];
  if (stage.kind === 'entry') return ['placed', ...stage.object === undefined ? [] : ['object'] as const, ...stage.floor === undefined ? [] : ['floor'] as const];
  return ['object'];
}
