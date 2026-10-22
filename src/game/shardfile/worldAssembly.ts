import { BuildingLifeLookSchema, BuildingLifeRowsSchema } from '@wildshard/format/buildings';
import { LivingBuildings } from './livingBuildings';
import { createBuildingCloud } from './buildingCloud';
import { hasLentLook, lentLook } from './lentLooks';
import type { ShardProduct } from './shardProduct';
import { RopeDeckSite } from '../models/ropeDeckSite';
import { RopeChain } from '@wildshard/engine/physics/ropeChain';
import type { Physics } from '@wildshard/engine/physics/Physics';
import type { Game } from '@wildshard/engine/core/Game';
import type { FixedDraws } from '../models/fixedDraws';
import * as v from 'valibot';
import type { Scope } from '@wildshard/engine/app/scope';
import type { ModelContext } from '@wildshard/engine/models/model';
import type { ModelSite } from '@wildshard/engine/models/place';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import { WorldAssemblySchema, type WorldAssemblyStage } from '@wildshard/format/worldAssembly';
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
  /** Original simulation and fixed-post registration authority for rope chains. */
  readonly physics?: Physics;
  readonly fixed?: Pick<Game, 'onFixed'>;
  /** what `entry` stages run their rows against (the world root, tier, variant and piece registration) */
  readonly entry?: Omit<WorldEntryPorts, 'scenes' | 'fence'>;
  /** the build's time slice, after each stage (labelled progress) */
  readonly slice: (label: string) => Promise<void>;
}

/** G571: an admitted world assembly (format/worldAssembly), run stage by stage in its declared order. Client-only. */
export class WorldAssembly {
  private at = 0;
  private constructor(private readonly stages: readonly WorldAssemblyStage[], private readonly ports: WorldAssemblyPorts) {}
  static admit(input: unknown, ports: WorldAssemblyPorts): WorldAssembly { return new WorldAssembly(admitted(input), ports); }

  /** Borrow the completed stages into an entered child, preserving every
   * construction owner. Stage kinds determine the finite loan kinds; no
   * callback, property path or second builder crosses this boundary. */
  static lend(input: unknown, construction: Scope, entered: Scope): void {
    const stages = admitted(input);
    if (entered !== construction && !entered.belongsTo(construction)) throw new Error('World assembly needs its construction ancestor');
    const loans = stages.flatMap(stage => loanKinds(stage).map(kind => ({ kind, id: stage.id })));
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
    if (stage.kind === 'rope-deck') {
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
  const placements = stages.flatMap(stage => stage.kind === 'place' || stage.kind === 'rope-deck' ? [stage.id] : stage.kind === 'entry' ? stage.rows.flatMap(row => row.kind === 'place' ? [row.id] : []) : []);
  if (new Set(placements).size !== placements.length) throw new Error('Repeated world assembly placement');
  for (const stage of stages) if (stage.kind === 'entry' && stage.floor !== undefined && !stage.rows.some(row => row.kind === 'place' && row.id === stage.floor && row.when === undefined)) {
    throw new Error(`World assembly entry ${stage.id} floor needs its unconditional place row`);
  }
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
function loanKinds(stage: WorldAssemblyStage): readonly ('object' | 'placed' | 'site' | 'floor' | 'rope-deck' | 'chain' | 'buildings')[] {
  if (stage.kind === 'rope-deck') return ['object', 'placed', 'floor', 'rope-deck'];
  if (stage.kind === 'rope-chain') return ['chain'];
  if (stage.kind === 'site') return ['object', 'placed', 'site', 'floor', ...stage.life === undefined ? [] : ['buildings'] as const];
  if (stage.kind === 'place') return ['object', 'placed', 'floor'];
  if (stage.kind === 'entry') return ['placed', ...stage.object === undefined ? [] : ['object'] as const, ...stage.floor === undefined ? [] : ['floor'] as const];
  return ['object'];
}
