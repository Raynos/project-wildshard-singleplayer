import * as v from 'valibot';
import { Object3D, Vector3 } from 'three';
import type { Actor, CombatTarget } from '@wildshard/engine/combat/pipeline';
import { fovForAspect } from '@wildshard/engine/combat/blocks/melee';
import { scriptItemHook, type ItemTarget, type ItemRuntime } from '@wildshard/engine/combat/items';
import type { ItemFamily } from '@wildshard/engine/combat/itemFamilies';
import type { EquipmentIcon } from '@wildshard/engine/combat/Equipment';
import { installDeclaredAudio, type DeclaredAudioPorts } from '@wildshard/engine/audio/declared';
import { TIER } from '@wildshard/engine/core/tier';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { ShardContext } from '../shard/context';
import type { ShardPlayHost } from '../shard/runtime';
import { installDeclaredPlumbing } from '../shard/declaredPlumbing';
import { declaredCompendium, declaredDay, declaredLootPresentation, declaredWeather } from '../shard/declaredRows';
import { installCompendium } from '../compendium/install';
import { installLoot } from '../loot/runtime';
import { installDeclaredTargets } from '../shard/declaredTargets';
import { mountDeclaredUi } from '../shard/declaredUi';
import { createQuestScriptPorts } from '../quest/declared';
import { installQuestPresentation } from '../quest/presentation';
import { instanceSave } from '../instanceSaves';
import { Ledger, installLedgerEmitter, type LedgerCatalogueItem, type LedgerEmitter } from '../ledger';
import { EmptyEquipment } from './emptyEquipment';
import type { ResidencyAllocator } from '../grid/allocator';
import type { PageResidency, HomeResidencyClaim } from '../grid/pageResidency';
import { leaseClientLibrary } from './clientLibrary';
import { compendiumSketches } from './sketch';
import { clientMaterials } from './clientMaterials';
import { clientSpeciesLooks, type ShardViewRecipe } from './clientRecipes';
import { loadClientSkins, type ClientSkin } from './clientSkins';
import { clientViews } from './clientViews';
import { createShardfileClientScripts } from './clientScripts';
import { ClientScriptViews, driveClientScriptViews, type ClientScriptViewTarget } from './clientScriptViews';
import { installClientWater } from './clientWater';
import { clientWorld } from './clientWorld';
import { clientSimStep } from './clientStep';
import { clientScene, projectItemFields, handledItemInputs } from './clientItems';
import { captureClientState, restoreClientState, installClientItemState, clientStateSave, clientCheckpoint } from './clientState';
import { syncTargetColliders } from './targets';
import type { ClientAssets } from './clientAssets';
import { installDeclaredItems, type DeclaredItems } from './items';
import { createShardfileSim, type ShardfileSimulation, type ShardfileSimPorts } from './simulation';
import { scriptDisabledNotice } from './scriptNotice';
import type { DeclaredGroupPorts } from './groupRuntime';
import type { Shardfile } from './schema';
import type { DeclaredBrainPorts } from './brainRuntime';

function isItemModel(value: unknown): value is Object3D { return value instanceof Object3D; }

/** Trusted catalogue dependencies are injected by the normal composition root, never imported upward by the loader. */
export interface ShardfileClientBindings {
  recipes: ReadonlyMap<string, ShardViewRecipe>; items: ReadonlyMap<string, ItemFamily>; icon: (name: string) => EquipmentIcon;
  voices: (audio: ShardPlayHost['audio']) => DeclaredAudioPorts['voices']; catalogue: readonly LedgerCatalogueItem[];
  instance: string;
  allocator?: ResidencyAllocator;
  /** Optional grid-page owner, created before hydration. Runtime homes reuse its reviewed early claim. */
  residency?: PageResidency;
  /** Explicit trusted native actor recipes for declared brain families. */
  brains?: DeclaredBrainPorts;
  /** Trusted recipes for declared group controllers; one shared policy owns each ordered roster. */
  groups?: DeclaredGroupPorts;
  /** Trusted crowd observations and views; the authoritative factory preflights every recipe before initialization. */
  crowds?: ShardfileSimPorts['crowds'];
  /** Host-owned custom-policy observation and strike recipes; the factory supplies actor identities and aliases. */
  scriptBrains?: ShardfileSimPorts['scriptBrains'];
  /** Explicit first-party transition policy: a completely empty data declaration adds no gameplay services. */
  trustedRuntime?: boolean;
  /** Declared audio is the default. A trusted first-party transition may let its runtime consume the same audio declaration exactly once. */
  audioOwner?: 'declared' | 'runtime';
  /** Declared water rows and collider-only props are installed by the data client by default. A trusted first-party transition may
   *  let its runtime consume them exactly once (G164: Driftwood's sea row with its dry sockets and its socket landings). */
  worldOwner?: 'declared' | 'runtime';
  /** Platform catalogue installers bind extended audio data to the existing play host. */
  audioProfiles?: (play: ShardPlayHost) => DeclaredAudioPorts['profiles'];
  /** Announced during construction only when this data client will create a simulation; empty trusted transitions never announce a handoff. */
  onSimulationExpected?: () => void;
  /** Production handoff after restoration; checkpoint confirms ledger, coins, encounters and continuation writes. The existing Game driver remains the home tick owner. */
  onSimulation?: (binding: { source: Shardfile; simulation: ShardfileSimulation; items: ReadonlyMap<string, ItemRuntime>; scope: ShardContext['scope']; checkpoint: () => boolean; suppressCheckpoint: () => void; setActive: (active: boolean) => void; residency?: HomeResidencyClaim }) => void;
}
const encounterSchema = v.record(v.string(), v.strictObject({ defeated: v.boolean(), rewardTaken: v.boolean(), kills: v.pipe(v.number(), v.integer(), v.minValue(0)) }));
const encounterSave = { key: 'platform.encounters', scope: 'shard' as const, version: 1, schema: encounterSchema, initial: (): v.InferOutput<typeof encounterSchema> => ({}) };

function emptyHybridData(source: Shardfile, audioOwner: ShardfileClientBindings['audioOwner'], worldOwner: ShardfileClientBindings['worldOwner']): boolean {
  // a runtime-owned world declaration: water rows and props that only declare colliders (no tiles, panels, models, far or textures)
  const runtimeWorld = worldOwner === 'runtime', props = source.props;
  const propsEmpty = props === null || (runtimeWorld && props.tiles.length + props.panels.length + props.models.length + props.textures.length === 0 && props.far === null);
  const audioEmpty = audioOwner === 'runtime' || (source.audio.cues.length + source.audio.routing.length === 0 && source.audio.ambience === null && source.audio.score === 'silent' && source.audio.music === undefined && source.audio.samples === undefined && source.audio.zones === undefined);
  return source.movers.length + source.crowds.length + source.clientScripts.bindings.length + source.files.length + source.requires.commons.length + source.requires.capabilities.length + source.tiles.length + source.library.length + source.critical.length + source.ui.length + source.sim.scripts.length + source.sim.bindings.length + source.state.shared.length + source.state.player.length + Object.values(source.rows).reduce((sum, rows) => sum + rows.length, 0) + (runtimeWorld ? 0 : source.water.length) + source.creatures.brains.length + source.creatures.groups.length + source.creatures.spawns.length + source.encounters.length + Object.values(source.quests).reduce((sum, rows) => sum + rows.length, 0) + source.ledger.length + source.hooks.conditions.length + source.hooks.scenes.length + source.items.rows.length + source.items.contexts.length + source.targets.panels.length + source.targets.interactions.length + source.look.families.length + source.look.keys.length + Object.keys(source.look.materials).length + Object.keys(source.look.familyLooks).length === 0
    && source.terrain === null && propsEmpty && source.far === null && source.plumbing === null
    && audioEmpty && source.look.grade.lut === null
    && source.look.day === undefined && source.look.dayOverride === null;
}

/** The existing Game's world/kit/play stages install one authored level, one borrowed simulation and the normal equipment/HUD. */
export class ShardfileClient {
  private readonly source: Shardfile;
  private readonly assets: ClientAssets;
  private readonly bindings: ShardfileClientBindings;
  private presentation: Awaited<ReturnType<typeof clientMaterials>> | undefined;
  private skins: ReadonlyMap<string, ClientSkin> = new Map();
  private worldTiles: Awaited<ReturnType<typeof clientWorld>> | undefined;
  private sim: ShardfileSimulation | undefined;
  private items: DeclaredItems | undefined;
  private readonly animals = new Map<string, Animal>();
  private readonly emptyTrustedData: boolean;
  constructor(source: Shardfile, assets: ClientAssets, bindings: ShardfileClientBindings) {
    if (bindings.residency !== undefined) {
      const home = bindings.residency.home();
      if (home.instance !== bindings.instance || home.allocator !== bindings.allocator) throw new Error('Shardfile client requires its early page home residency');
    }
    this.source = source; this.assets = assets; this.bindings = bindings; this.emptyTrustedData = bindings.trustedRuntime === true && emptyHybridData(source, bindings.audioOwner, bindings.worldOwner);
    if (!this.emptyTrustedData) bindings.onSimulationExpected?.();
  }

  async world(ctx: ShardContext): Promise<void> {
    if (this.emptyTrustedData) return;
    const runtime = ctx.game.runtime, world = runtime?.world;
    if (runtime === undefined || world === null || world === undefined) throw new Error('Shardfile requires the normal world stage');
    ctx.scope.onDispose(this.assets.pin());
    const allocator = this.bindings.allocator; if (allocator === undefined) throw new Error('Shardfile requires its session residency allocator');
    // The reviewed opaque-runtime claim includes its whole home. Cache leases remain pinned above;
    // ordinary data homes account library/commons and tile parts independently in the same allocator.
    if (this.bindings.residency === undefined || this.source.runtime === null) leaseClientLibrary(this.source, this.assets.retained, { scope: ctx.scope, allocator, owner: this.bindings.instance });
    const presentation = await clientMaterials(this.source, this.assets.retained, world.game.renderer, ctx.scope);
    this.presentation = presentation;
    this.skins = await loadClientSkins(this.source, this.assets.retained, presentation.compile, ctx.scope);
    installClientWater(this.source.water, { root: ctx.root, scope: ctx.scope, materials: presentation.materials, outline: presentation.outline });
    this.worldTiles = await clientWorld(this.source, this.assets, { scope: ctx.scope, x: this.source.spawn.x, z: this.source.spawn.z,
      ...(this.bindings.residency !== undefined && this.source.runtime === null ? { residency: { allocator, owner: this.bindings.instance } } : {}),
      views: clientViews({ root: ctx.root, terrain: this.source.terrain?.family ?? null, ...presentation }),
    });
    const tiles = this.worldTiles; let priorX = this.source.spawn.x, priorZ = this.source.spawn.z;
    ctx.system({ id: 'game.shardfile.residency', phase: 'fixed.post', after: ['player.step'], run: () => {
      const position = runtime.viewer();
      if (Math.hypot(position.x - priorX, position.z - priorZ) < 5) return;
      void tiles.refresh(position.x, position.z);
      priorX = position.x; priorZ = position.z;
    } });
    ctx.system({ id: 'game.shardfile.presentation', phase: 'update', run: (dt) => { presentation.tick(dt); } });
    ctx.debug.expose('shardfileResidency', { tiles, allocator, mode: 'standalone', workers: false });
  }

  kit(ctx: ShardContext): void {
    if (this.emptyTrustedData) return;
    const runtime = ctx.game.runtime, world = runtime?.world, presentation = this.presentation;
    if (runtime === undefined || world === null || world === undefined || presentation === undefined) throw new Error('Shardfile requires the normal kit stage');
    const source = this.source;
    ctx.rows.species(source.rows.species.map((row) => ({ ...row, variants: row.variants.map((variant) => ({ ...variant, scale: [...variant.scale] })) })));
    ctx.rows.speciesLook(clientSpeciesLooks(source.rows, this.bindings.recipes, presentation.materials, this.skins));
    const sketches = compendiumSketches(source.rows, this.assets.retained);
    for (const row of source.rows.compendiums) ctx.rows.compendium({ id: row.id, ...declaredCompendium(row, source.rows, ctx.manifest.slug, ref => {
      const sketch = sketches.get(ref); if (sketch === undefined) throw new Error('Missing admitted compendium sketch'); return sketch.data;
    }) });
    ctx.rows.lootTable(source.rows.loot);
    runtime.hooks.animalsReady = (manager) => {
      for (const spawn of source.creatures.spawns) {
        const species = source.rows.species.find((row) => row.id === spawn.species); if (species === undefined) throw new Error('Missing authored creature species');
        const view = manager.spawn(species.kind, spawn.at[0], spawn.at[2], spawn.yaw, spawn.variant, { y: spawn.at[1], entityId: spawn.id });
        this.animals.set(spawn.id, view);
      }
    };
    const player = (): NonNullable<ShardContext['app']['player']> => { const actor = ctx.app.player; if (actor === null) throw new Error('Player health has not entered play'); return actor; };
    const actor: Actor = { id: 'actor.player', get tags() { return player().tags; }, get state() { return player().state; }, get attributes() { return player().attributes; }, get alive() { return player().alive; }, applyDamage: (request) => player().applyDamage(request) };
    const aimTarget = (target: CombatTarget): ItemTarget => {
      const body = this.sim?.host.entities.get(target.actor.id);
      return { ...target, aimPoint: target.position.clone().add(new Vector3(0, body === undefined ? 0.9 : body.dims.bodyY * body.scale, 0)) };
    };
    runtime.buildEquipment = () => {
      const items = installDeclaredItems(source.items, { scope: ctx.scope, actorId: actor.id, input: ctx.app.input, families: this.bindings.items, icon: this.bindings.icon,
        aim: () => ({ origin: world.game.camera.getWorldPosition(new Vector3()), direction: world.game.camera.getWorldDirection(new Vector3()) }),
        runtime: (row) => ({ actor, combat: ctx.app.combat, active: () => ctx.app.state === 'play' && !world.freeCamera,
          targets: () => ctx.app.combat.targets().map(aimTarget),
          effect: (target, effect, from) => { const service = ctx.app.effects; if (service === null) throw new Error('Missing normal effect host'); service.apply(target, effect, from); },
          hook: row.hook === null ? null : (command) => { const lane = this.sim?.lane, hook = row.hook; if (lane === undefined || hook === null) throw new Error('Missing admitted item lane'); return scriptItemHook(lane.host, hook.module, hook.entity, hook.event, actor.id)(command); },
        }),
      });
      this.items = items;
      return Promise.resolve({ primary: items.primary ?? new EmptyEquipment(), secondary: items.secondary, rifle: null, extras: items.extras, order: items.order, install: items.install });
    };
  }

  play(ctx: ShardContext): void {
    if (this.emptyTrustedData) return;
    const runtime = ctx.game.runtime, world = runtime?.world, play = runtime?.play, items = this.items, tiles = this.worldTiles;
    const health = ctx.app.player;
    if (runtime === undefined || world === null || world === undefined || play === null || play === undefined || items === undefined || tiles === undefined || health === null) throw new Error('Shardfile requires the normal play stage');
    const source = this.source, identity = { instance: this.bindings.instance, shard: source.identity.slug, revision: source.identity.revision };
    const equipmentHost = ctx.app.equipmentHost;
    if (equipmentHost === null) throw new Error('Declared items require the normal equipment view host');
    for (const item of [items.primary, items.secondary, ...items.extras, ...items.tools]) {
      if (item === null) continue;
      const model: unknown = Reflect.get(item, 'model');
      if (isItemModel(model)) {
        equipmentHost.viewmodel.add(model);
        ctx.scope.onDispose(() => { model.removeFromParent(); });
      }
    }
    let baseFov = 0;
    ctx.system({ id: 'shardfile.item-fov', phase: 'update', run: () => {
      const current = play.weapons.current;
      if (!source.items.rows.some((row) => row.kind === 'weapon' && row.family === 'kit.melee' && row.id === current.row.id)) return;
      const camera = world.game.camera;
      const base = fovForAspect(camera.aspect < 1 ? world.game.level.camera?.portraitFov ?? 72 : 72, camera.aspect);
      const target = base + (current.model.visible ? world.player.fovKick : 0);
      if (Math.abs(target - camera.fov) > 0.01) {
        camera.fov = target; camera.updateProjectionMatrix();
        if (Math.abs(base - baseFov) > 0.01) world.sky.csm.updateFrustums();
      }
      baseFov = base;
    } });
    const lootRow = source.rows.loot[0], loot = lootRow === undefined ? null : installLoot({ ctx, manifest: ctx.manifest, owned: play.owned, scene: world.game.scene,
      player: world.player, camera: world.game.camera, animals: () => play.animals.animals, menu: play.menu, presentation: declaredLootPresentation(lootRow, (id) => { if (!id.startsWith('cue.')) throw new Error('Unknown registered loot cue'); play.cues.cue(`cue.${id.slice(4)}`); }),
    });
    if (source.rows.compendiums.length > 0) {
      const journal = installCompendium({ chunkId: ctx.manifest.slug, game: world.game, camera: world.game.camera, hud: play.hud, menu: play.menu,
        animals: play.animals, cabins: null, interactables: runtime.interactables, weapons: play.weapons, touchUi: play.touchUi, nolock: play.nolock });
      if (journal !== null) ctx.scope.onDispose(() => { journal.journal.scope.dispose(); });
    }
    const ledger = new Ledger(ctx.app.saves, [{ id: identity.instance, shard: identity.shard }], [{ shard: identity.shard, revision: identity.revision, rules: source.ledger }], this.bindings.catalogue);
    const emitters = new Map<string, LedgerEmitter>();
    const fact = (name: string, entity: string, origin: string): void => {
      const emitter = emitters.get(origin); if (emitter === undefined) throw new Error('Missing declared fact provenance'); emitter.emit(name, entity);
    };
    const read = (scope: 'shared' | 'player', id: number): number => {
      const field = source.state[scope].find((row) => row.id === id); if (field === undefined) throw new Error('Missing declared state field');
      const value = this.sim?.lane?.world.view(health.id)[scope][field.name];
      if (value !== undefined) return value;
      if (typeof field.default === 'string') throw new Error('UI requires numeric state'); return typeof field.default === 'boolean' ? Number(field.default) : field.default;
    };
    const ui = mountDeclaredUi(source.ui, { hud: ctx.hud, system: ctx.system, scope: ctx.scope, bag: ctx.bag,
      read: (name) => { const scope = source.state.shared.some((row) => row.name === name) ? 'shared' : 'player', field = source.state[scope].find((row) => row.name === name); if (field === undefined) throw new Error('Missing declared counter field'); return read(scope, field.id); },
    });
    const saved = instanceSave(ctx.app.saves, encounterSave, { id: identity.instance, shard: identity.shard }), encounters = saved.read();
    let simulationActive = true;
    const sim = createShardfileSim(source, this.assets.retained, { rapier: world.physics.R, physics: world.physics,
      ...(this.bindings.brains === undefined ? {} : { brains: this.bindings.brains }),
      ...(this.bindings.groups === undefined ? {} : { groups: this.bindings.groups }),
      ...(this.bindings.crowds === undefined ? {} : { crowds: this.bindings.crowds }),
      ...(this.bindings.scriptBrains === undefined ? {} : { scriptBrains: this.bindings.scriptBrains }),
      // G168: a module switched off after its strikes tells the player once, and Developer mode names it
      scriptDisabled: scriptDisabledNotice({ toast: (text) => { play.hud.toast(text, 'warn'); }, devAlert: (text) => { play.hud.devAlert(text); } }),
      player: { id: health.id, position: world.player.position, get yaw() { return world.player.yaw; }, set yaw(value) { world.player.yaw = value; }, health, get motor() { return world.player.motor; } },
      events: ctx.app.events, clock: ctx.app.clock, combat: ctx.app.combat, scope: ctx.scope, water: ctx.app.world.water,
      fixedStep: clientSimStep({ scope: ctx.scope, app: ctx.app, active: () => simulationActive, freeCamera: () => world.freeCamera, system: ctx.system }), hud: ui,
      quest: { fact: (name, entity) => { fact(name, entity, 'quest.complete'); }, coins: (amount, entity) => {
        if (loot?.purse !== null && loot?.purse !== undefined) { loot.purse.add(amount); return; }
        const host = this.sim?.host; if (host === undefined) throw new Error('Missing local coin host');
        const key = `coins.${entity}`, prior = host.slots.questState[key]; host.slots.questState[key] = (typeof prior === 'number' ? prior : 0) + amount;
      } },
      encounters: (id) => ({ saved: encounters[id] ?? { defeated: false, rewardTaken: false, kills: 0 }, persist: (value) => { encounters[id] = value; saved.write(encounters); },
        reward: () => { for (const rule of source.ledger) if (rule.origin.kind === 'engine' && rule.origin.source === 'encounter.complete') fact(rule.fact, id, rule.origin.source); },
      }),
    });
    this.sim = sim;
    // SF59: graph params read the frame owner's clock (the level backdrop's, G158) and the live public state
    this.presentation?.graphs.bind({ hour: () => world.game.sky.dayNight?.hour ?? null, state: (scope, name) => {
      const value = sim.lane?.world.view(health.id)[scope][name]; return typeof value === 'number' ? value : undefined;
    } });
    const authoredDay = source.rows.days[0], day = ctx.app.dayCycle ?? (authoredDay === undefined ? null : declaredDay(authoredDay));
    const ownsDay = ctx.app.dayCycle === null && day !== null;
    if (ownsDay) ctx.app.registerDayCycle(day, ctx.scope);
    const weather = new Map(source.rows.weather.map((row) => [row.id, declaredWeather(row, sim.host.rng.stream('cosmetic').fork(row.id))]));
    sim.host.onStep('climate.declared', (dt) => { if (ownsDay) day.update(dt); for (const profile of weather.values()) profile.update(dt, day); });
    for (const rule of source.ledger) if (!emitters.has(rule.origin.source)) emitters.set(rule.origin.source, installLedgerEmitter(sim.host, ledger, identity, rule.origin));
    for (const [id, view] of this.animals) {
      const core = sim.host.entities.get(id); if (core === undefined) throw new Error('Missing authoritative creature');
      view.bindSimulation(core); view.mesh.scale.setScalar(core.scale);
    }
    // SF25 / G66: presentation-only client scripts; live creatures keep their sim pose and clips, a frozen home (the
    // traveller in another frame) breathes and grazes on top of it. The lane sees copies; its sim is never stepped here.
    if (source.clientScripts.bindings.length > 0) {
      const animals = this.animals, lane = sim.lane;
      const scripts = createShardfileClientScripts(source, this.assets.retained, { actorId: health.id, ...(lane === undefined ? {} : { state: lane.world }),
        observe: (target) => {
          if (target.kind === 'particles') return { position: target.at, frozen: !simulationActive };
          const p = target.kind === 'creature' ? animals.get(target.id)?.mesh.position : undefined;
          return { position: p === undefined ? [0, 0, 0] : [p.x, p.y, p.z], frozen: !simulationActive };
        } });
      ctx.scope.onDispose(() => { scripts.dispose(); });
      const targets = scripts.targets.map(({ entity, target }): ClientScriptViewTarget => {
        const view = target.kind === 'creature' ? animals.get(target.id) : undefined, body = view === undefined ? 0 : (sim.host.entities.get(view.entityId)?.dims.bodyY ?? 0.5) * (view.mesh.scale.y || 1);
        const looks = source.clientScripts.bindings.find((b) => b.entity === entity)?.emitters.map((e) => ({ id: e.id, live: e.live, colour: e.colour, size: e.size, velocity: e.velocity, gravity: e.gravity })) ?? [];
        return { entity, object: view?.mesh ?? null, emitters: looks,
          anchor: (out) => (target.kind === 'particles' ? out.fromArray(target.at) : view === undefined ? out.set(0, 0, 0) : out.copy(view.mesh.position).setY(view.mesh.position.y + body * 1.6)) };
      });
      const views = new ClientScriptViews(scripts.lane, targets, { root: ctx.root, scope: ctx.scope });
      let presentationTick = 0, stopped = false;
      // a refused observation (a creature past the lane's ±250 m frame) stills the presentation, never the game
      ctx.system({ id: 'game.shardfile.client-scripts', phase: 'fixed.post', run: () => {
        if (stopped) return;
        try { scripts.step(presentationTick++); } catch (error) { stopped = true; views.restore(); console.warn('[shardfile] client scripts stopped:', error); }
      } });
      driveClientScriptViews(views, { system: ctx.system, id: 'game.shardfile.client-script-views' });
      ctx.debug.expose('shardfileClientScripts', { views: () => views.state(), frames: () => scripts.lane.frames() });
    }
    installClientItemState(sim, items.runtimes, () => {
      items.step(sim.host.state.tick, 1 / 60);
      const lane = sim.lane, player = sim.actors.get(health.id);
      if (lane !== undefined && player !== undefined) projectItemFields(source, items.runtimes, lane, player);
    });
    const continuation = instanceSave(ctx.app.saves, clientStateSave, { id: identity.instance, shard: identity.shard });
    const prior = continuation.read();
    if (prior !== null && !restoreClientState(source, sim, items.runtimes, prior)) throw new Error('Saved progress requires an admitted checkpoint migration');
    syncTargetColliders(source.targets, sim.colliders, read);
    const saver = clientCheckpoint({ ledger, purse: loot?.purse ?? null,
      encounters: () => saved.write(encounters), continuation: () => continuation.write(captureClientState(source, sim, items.runtimes)),
    });
    const checkpoint = saver.checkpoint;
    sim.host.onStep('client.save', () => { if (sim.host.state.tick % 300 === 0) checkpoint(); });
    ctx.scope.onDispose(() => { checkpoint(); });
    ctx.scope.listen(window, 'pagehide', () => { checkpoint(); });
    ctx.scope.listen(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') checkpoint(); });
    const hooks = sim.lane === undefined ? null : createQuestScriptPorts(sim.lane, source.hooks, sim.actors);
    const scene = clientScene(source, items.runtimes, (id) => { if (hooks === null) throw new Error('Missing admitted scene lane'); hooks.scene(id, health.id); });

    if (source.plumbing !== null) installDeclaredPlumbing(source.plumbing, { handledInput: handledItemInputs(source), instance: source.identity.slug, tier: TIER, scope: ctx.scope, input: ctx.app.input,
      active: () => ctx.app.state === 'play' && !world.freeCamera, scene, knobs: ctx.tiers.knobs, debugRow: ctx.debugRow,
    });
    installDeclaredTargets(source.targets, { panels: tiles.props?.panels ?? new Map(), colliders: sim.colliders, read, scene, interactables: runtime.interactables, scope: ctx.scope, system: ctx.system });
    for (const quest of sim.quest.quests) {
      const declaration = source.quests.quests.find((row) => row.id === quest.def.id);
      installQuestPresentation(ctx, quest, declaration?.track === false ? { chip: () => ({ label: '', count: '' }) } : {});
    }
    runtime.hooks.questFlags = () => sim.host.flags.all; runtime.hooks.adventureFlags = () => sim.host.flags.all;
    if (this.bindings.audioOwner !== 'runtime') installDeclaredAudio(source.audio, { audio: play.audio, cues: play.cues, voices: this.bindings.voices(play.audio), music: play.music, scope: ctx.scope, profiles: this.bindings.audioProfiles?.(play) });
    ctx.debug.expose('shardfile', { source, host: sim.host, lane: sim.lane, items: items.runtimes, colliders: sim.colliders, fine: tiles.fine, weather });
    this.bindings.onSimulation?.({ source, simulation: sim, items: items.runtimes, scope: ctx.scope,
      ...(this.bindings.residency === undefined ? {} : { residency: this.bindings.residency.home() }),
      checkpoint: () => !ctx.scope.disposed && checkpoint(), suppressCheckpoint: saver.suppress, setActive: (active) => { simulationActive = active && !ctx.scope.disposed; },
    });
  }
}
