import { Object3D } from 'three';
import { ownSceneTree } from '@wildshard/engine/app/sceneOwnership';
import type { Scope } from '@wildshard/engine/app/scope';
import { ownedFacade, ownerTask, withOwner } from '@wildshard/engine/app/ownership';
import { createLevelInstallation } from '@wildshard/engine/level/installation';
import { EquipmentService } from '@wildshard/engine/combat/EquipmentService';
import { authoredTargets } from '@wildshard/engine/combat/targets';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { SkinDef } from '@wildshard/engine/player/Skins';
import type { PlayerFrameQueries } from '@wildshard/engine/player/Player';
import { gridCreatureConstraint } from '@wildshard/engine/physics/gridBorders';
import { shardContext, type ShardContext } from '../shard/context';
import type { ShardManifest } from '../shard/manifest';
import type { ShardPlayHost, ShardRuntime } from '../shard/runtime';
import type { ShardWorld } from '../shard/world';
import type { HybridResident } from '../shardfile/hybrid';
import type { AdmittedProduct } from '../shardfile/product';
import type { GridCell } from './assembly';
import type { ResidencyAllocator, ResidencyLease } from './allocator';
import type { LiveGridRegion } from './live';
import type { GridLoadout } from './wallet';
import { runtimeAccountedBytes, type RuntimeCost } from './runtimeCost';
import { createRegionalView, type RegionalView } from './regionalView';
import { installEnteredRuntimeService } from '../shard/retainedHooks';
import { Progress } from '../Progress';
import { Inventory } from '../Inventory';
import { Owned } from '../loot/Owned';
import type { EnteredEquipment } from './enteredEquipment';
import { SkinLocker } from '../cosmetics/locker';
import { coverRuntimeAssets } from './assetResidency';
import { FrameCamera } from '@wildshard/engine/world/frameCamera';

function isSceneNode(value: unknown): value is Object3D { return value instanceof Object3D; }

function sameMeasurement(a: RuntimeCost, b: RuntimeCost): boolean {
  return (['webContentMB', 'glMB', 'engineBaseMB', 'rev', 'device', 'evidence'] as const).every(key => a[key] === b[key]);
}

/**
 * A transitional region pays for its whole opaque runtime. The first-party manifest and admitted declaration must
 * share the reviewed measurement and its images-first provenance; an empty declarative sim is never its estimate.
 * The caller reserves these bytes through the page's ordinary allocator before constructing the regional shell.
 */
export function regionalRuntimeAccountedBytes(admitted: Pick<AdmittedProduct, 'source'>, manifest: Pick<ShardManifest, 'slug' | 'runtimeCost'>): number {
  const { source } = admitted;
  const { slug: declaredIdentity } = source.identity, { slug: registeredIdentity } = manifest;
  if (declaredIdentity !== registeredIdentity) throw new Error('Regional runtime identity differs from its trusted manifest');
  const declared = source.runtime?.cost, measured = manifest.runtimeCost;
  if (declared === undefined || measured === undefined) throw new Error('Regional runtime requires reviewed whole-runtime measurements');
  const bytes = runtimeAccountedBytes(declared);
  runtimeAccountedBytes(measured);
  if (!sameMeasurement(declared, measured) || (declared.imagesFirst === undefined) !== (measured.imagesFirst === undefined)
    || !sameMeasurement(declared.imagesFirst ?? declared, measured.imagesFirst ?? measured)) throw new Error('Regional runtime measurement differs from its trusted manifest');
  return bytes;
}

/** Existing page services lent to a regional shell; it never constructs another renderer, player or input loop. */
export interface RegionalRuntimePage {
  /** Stable page controls delegate to the entered kit; absent for ordinary borrowed-home pages. */
  readonly equipment?: EnteredEquipment;
  readonly world: ShardWorld;
  readonly play: ShardPlayHost;
  readonly context: ShardContext;
}

/** Fully admitted immutable content and the one page owner, supplied before any trusted gameplay hook executes. */
export interface RegionalRuntimeRequest {
  readonly cell: GridCell;
  readonly admitted: AdmittedProduct;
  readonly manifest: ShardManifest;
  readonly page: RegionalRuntimePage;
  readonly allocator: ResidencyAllocator;
  /** Already reserved through the ordinary page allocator at the full measured runtime cost. */
  readonly claim: ResidencyLease;
  readonly scope: Scope;
}

/**
 * The view adapter owns the real region, including critical terrain/colliders and a registry whose additions target
 * its own Physics. Its resident context supplies regional sky/terrain/forest; afterWorld and afterKit finish the shell
 * stages only inside the cell, including the real AnimalManager, equipment, inventory and progress before trusted play.
 * The resident's scope owns disposal in dependency order. A synthetic empty host cannot stand in for this contract.
 */
export interface PreparedRegionalRuntime {
  readonly region: LiveGridRegion;
  readonly queries: PlayerFrameQueries;
  readonly resident: HybridResident;
  readonly loadout: GridLoadout;
  /** Flush authored runtime progress and its admitted continuation; false keeps the traveller in the source frame. */
  readonly checkpoint: () => boolean;
  /** The actual retained herd; callers expose it to aiming only while this runtime is ready and entered. */
  readonly aimAnimals: () => AnimalManager['animals'];
  /** Actual actor-object provenance in the retained region; repeated IDs in parked neighbours grant no permission. */
  readonly combatActors: () => ReadonlyMap<ReturnType<AnimalManager['animals'][number]['combatActor']>, Readonly<{ x: number; y: number; z: number }>>;
}

/** Trusted composition-root adapter. Module admission precedes this call; world/kit/play remain interior-only. */
export type RegionalRuntimeFactory = (request: RegionalRuntimeRequest) => Promise<PreparedRegionalRuntime>;

/**
 * Required engine binding: a real destination world, never the home's terrain, forest or AnimalManager. The engine
 * adapter supplies per-region Heightfield, level, baked terrain, navmesh and water bindings, restored on each leave.
 * Keeping this port required prevents an unfinished foundation from silently becoming an enterable empty world.
 */
export interface RegionalRuntimeFoundation {
  readonly region: LiveGridRegion;
  readonly ground: Pick<PlayerFrameQueries, 'heightAt' | 'waterSurfaceAt'>;
  /** The one renderer/player, but a regional scene facade, level scope, sky, terrain and forest. */
  readonly world: (view: RegionalView) => ShardWorld;
  readonly enter: (scope: Scope) => void;
  readonly afterWorld?: (context: ShardContext, world: ShardWorld) => Promise<void> | void;
  /** Build regional creatures after kit registrations; apply skins through the existing regional view adapter. */
  readonly afterKit: (context: ShardContext, world: ShardWorld) => Promise<{
    animals: AnimalManager; wearSkin: (equipment: EquipmentService, skin: SkinDef) => void;
  }>;
  /** Real runtime continuation, local purse/ownership and encounter writes; refusal keeps the source frame. */
  readonly checkpoint: () => boolean;
}

/** Composition ports owned by the page root, with explicit absence until the engine's regional binding lands. */
export interface RegionalRuntimeFactoryPorts {
  readonly home: Readonly<{ x: number; z: number }>;
  readonly prepareFoundation?: (request: RegionalRuntimeRequest) => Promise<RegionalRuntimeFoundation>;
  /** Validated logical continuation for a rebuilt opaque runtime; supplied by the live instance owner. */
  readonly continuation?: { restore: (animals: AnimalManager) => void; checkpoint: (animals: AnimalManager) => boolean };
}

/** Compose the trusted regional stages without changing discovery, module admission or the fixed crossing driver. */
export function createRegionalRuntimeFactory(ports: RegionalRuntimeFactoryPorts): RegionalRuntimeFactory {
  return async request => {
    const declaration = request.admitted.source.runtime;
    if (declaration === null) throw new Error('Regional factory requires a declared trusted runtime');
    const bytes = regionalRuntimeAccountedBytes(request.admitted, request.manifest);
    const { slug: cellIdentity } = request.cell, { slug: manifestIdentity } = request.manifest;
    if (cellIdentity !== manifestIdentity) throw new Error('Regional factory identity differs from its catalogue cell');
    const claim = request.allocator.entries().find(row => row.id === request.claim.id);
    if (claim === undefined || claim.owner !== request.cell.instance || claim.bytes !== bytes) throw new Error('Regional factory requires its whole-runtime lease');
    const prepare = ports.prepareFoundation;
    if (prepare === undefined) throw new Error('Regional terrain/forest/animals binding is not prepared');
    const scope = request.scope.child(`grid.runtime:${request.cell.instance}`);
    try {
      coverRuntimeAssets(request.allocator, scope, request.claim);
      const foundation = await prepare({ ...request, scope });
      if (scope.disposed) { foundation.region.dispose(); throw new Error('Regional runtime left during foundation admission'); }
      scope.onDispose(foundation.region.dispose);
      const host = foundation.region.host;
      if (host.embedded || host.hasPlayerMotor || host.physics === request.page.world.physics) throw new Error('Regional factory requires an owned bodyless destination');
      const app = request.page.context.app, parent = request.page.context.game.runtime, pageScope = app.levelScope;
      if (parent === undefined) throw new Error('Regional factory requires the page runtime');
      if (pageScope === null) throw new Error('Regional factory requires the page level scope');
      app.cpu.bind(scope, request.cell.instance);
      const view = createRegionalView({ cell: request.cell, home: ports.home, scene: request.page.world.game.rootScene,
        physics: host.physics, slot: app, assets: app.assets, allocator: request.allocator, claim: request.claim,
        scope, ground: foundation.ground });
      const foundationWorld = foundation.world(view);
      // SF63: the herd's far cull reads the camera from the region's frame, where its animals stand (FrameCamera)
      const viewFromRoot = new FrameCamera(view.root);
      let enteredContext: ShardContext | null = null, anonymous = 0;
      const onUpdate: ShardWorld['game']['onUpdate'] = (run, label, core) => {
        if (enteredContext === null) throw new Error('Regional callback registered before its interior context');
        const id = `grid.runtime.${request.cell.instance}.callback.${label ?? String(anonymous++)}`;
        installEnteredRuntimeService(enteredContext, entry => { app.addContentSystem({ id, phase: 'update', run, ...(core === undefined ? {} : { core }) }, entry); });
      };
      // Content keeps the same renderer/player, but its stable scope and callback registration belong to this region.
      // The home Game's fields are never overwritten, even across yielded hooks or while this resident is parked.
      const game = new Proxy(foundationWorld.game, { get: (target, key, receiver) => {
        if (key === 'levelScope' || key === 'registrationScope') return scope;
        if (key === 'onUpdate') return onUpdate;
        const value: unknown = Reflect.get(target, key, receiver); return value;
      } });
      const world = { ...foundationWorld, game };
      if (world.physics !== host.physics || world.player !== request.page.world.player || world.game.renderer !== request.page.world.game.renderer) throw new Error('Regional world must keep the page renderer/player and destination physics');
      const skinRows: SkinDef[] = [];
      let localPlay: ShardPlayHost | null = null;
      let localRuntime: ShardRuntime | undefined;
      let stowed = false, restored = false;
      const checkpoint = (): boolean => {
        if (scope.disposed || localPlay === null || !restored) return false;
        // Attempt all owners even after a refusal; neither gameplay death/reset hooks nor a constant true is a save.
        const progress = localPlay.progress.checkpoint(), inventory = localPlay.inventory.checkpoint(), native = foundation.checkpoint();
        const logical = ports.continuation?.checkpoint(localPlay.animals) ?? true;
        return progress && inventory && native && logical;
      };
      const resident: HybridResident = { instance: request.cell.instance, slug: request.cell.slug, declaration, firstParty: true,
        scope, runtime: parent, retainRuntime: true, context: (owner, runtime) => {
          localRuntime = runtime; runtime.world = { ...world, registry: view.registry }; runtime.play = null;
          runtime.interactables.length = 0; runtime.overhead.length = 0;
          for (const key of Reflect.ownKeys(runtime.hooks)) Reflect.deleteProperty(runtime.hooks, key);
          for (const key of Reflect.ownKeys(runtime.objects)) Reflect.deleteProperty(runtime.objects, key);
          Reflect.deleteProperty(runtime, 'buildEquipment'); Reflect.deleteProperty(runtime, 'menu');
          runtime.step = (_key, work) => Promise.resolve().then(() => work(request.page.context.progress));
          const installation = createLevelInstallation(app, owner, app.levelAdapters, () => request.page.context.progress);
          view.root.add(installation.context.root);
          const base = shardContext(installation.context, request.manifest, { ...request.page.context.game,
            runtime, shard: request.manifest, rows: new Map() });
          const context: ShardContext = { ...base, rows: { ...base.rows, skin: values => {
            base.rows.skin(values);
            const list: readonly SkinDef[] = Array.isArray(values) ? values : [values as SkinDef];
            skinRows.push(...list);
          } } };
          return { ...installation, context,
            beforeWorld: entered => { enteredContext = entered; installEnteredRuntimeService(entered, entry => {
              foundation.enter(entry); app.bindPlayerServices(pageScope, entry); view.enter(entry);
              app.addContentSystem({ id: `grid.runtime.${request.cell.instance}.pieces`, phase: 'fixed.pre', run: () => { view.sync(); } }, entry);
            }); },
            afterWorld: entered => foundation.afterWorld?.(entered, world),
            afterKit: async entered => {
              const left = (): boolean => owner.disposed;
              const regional = await foundation.afterKit(entered, world);
              if (left()) throw new Error('Regional runtime left while building creatures');
              for (const animal of regional.animals.animals) animal.motionConstraint = hostConstraint(host, animal.dims.bodyRadius * animal.scale);
              runtime.hooks.animalsReady?.(regional.animals);
              app.effects?.registerDefinitions(app.levelRegistrations.list('effect'));
              const targets = authoredTargets(app.events, regional.animals, () => null);
              const build = runtime.buildEquipment;
              if (build === undefined) throw new Error('Regional kit did not install its equipment factory');
              const kit = await ownerTask(owner, () => build(targets, request.page.play.nolock));
              if (left()) {
                for (const weapon of [kit.primary, kit.rifle, kit.secondary, ...(kit.extras ?? [])]) weapon?.dispose();
                throw new Error('Regional runtime left while building equipment');
              }
              // Kit models live under the shared camera, outside the regional scene subtree.
              // Their resident remains the sole GPU owner even while weapon.install detaches them on retirement.
              for (const weapon of new Set([kit.primary, kit.rifle, kit.secondary, ...(kit.extras ?? [])])) {
                if (weapon !== null && isSceneNode(weapon.model)) ownSceneTree(weapon.model, owner, app.assets);
              }
              withOwner(owner, () => {
                const weapons = new EquipmentService(kit.primary, { scope: owner, events: app.events,
                  input: { bind: (action, run, _scope, allowed) => { installEnteredRuntimeService(entered, entry => {
                    app.input.bind(action, run, entry, allowed ?? (() => weapons.enabled));
                  }); } }, ...(kit.order === undefined ? {} : { order: [...kit.order] }) });
                for (const weapon of [kit.rifle, kit.secondary, ...(kit.extras ?? [])]) if (weapon !== null) weapons.add(weapon, { locked: true });
                kit.install?.(weapons); app.registerEquipment(weapons, world.game.levelScope);
                const progress = new Progress(request.cell.instance), inventory = new Inventory(request.cell.instance), owned = new Owned(request.cell.instance);
                const skins = new SkinLocker(request.cell.instance, skinRows);
                // SF57: the page's maps reach this resident's hooks through owner facades, so what its play registers on
                // them after an await (a quest card, its places, its marks) ends with the resident, not the page. (Not the
                // HUD or menu: other services key on their identity, e.g. bag tabs by menu.)
                const page = request.page.play;
                const residentOwned = <S>(service: S): S => (typeof service === 'object' && service !== null ? ownedFacade(owner, service) : service);
                localPlay = { ...page, fullMap: residentOwned(page.fullMap),
                  ...(page.minimap === undefined ? {} : { minimap: residentOwned(page.minimap) }),
                  animals: regional.animals, weapons, primary: kit.primary,
                  rifle: kit.rifle, secondary: kit.secondary, progress, inventory, owned, skins,
                  wearSkin: skin => { regional.wearSkin(weapons, skin); skins.wear(skin.weapon, skin.id); },
                  disposeRifleDrop: () => { runtime.hooks.disposeRifleDrop?.(); } };
                runtime.play = localPlay;
                installEnteredRuntimeService(entered, entry => {
                  app.addContentSystem({ id: `grid.runtime.${request.cell.instance}.animals`, phase: 'update', run: (dt, t) => {
                    // Native hitboxes/controllers are lazy, but belong to the parked resident rather than this entry.
                    withOwner(owner, () => regional.animals.update(dt, t, world.player.position, world.player.sprinting, world.player.position, viewFromRoot.of(world.game.camera)));
                    localPlay?.progress.addPlay(dt);
                    weapons.update(dt, t);
                  } }, entry);
                  weapons.enabled = true; weapons.visible = !stowed; weapons.stowed = stowed;
                  entry.onDispose(() => { weapons.enabled = false; weapons.visible = false; weapons.adsHeld = false; weapons.altHeld = false; });
                });
              });
            },
            afterPlay: async entered => {
              if (localPlay === null) throw new Error('Regional play services are not installed');
              // Trusted play can install encounter creatures; validate the complete herd before publishing readiness.
              ports.continuation?.restore(localPlay.animals);
              const equipment = request.page.equipment, weapons = localPlay.weapons;
              if (equipment !== undefined) installEnteredRuntimeService(entered, entry => { equipment.bind(weapons, entry); });
              for (const animal of localPlay.animals.animals) animal.motionConstraint = hostConstraint(host, animal.dims.bodyRadius * animal.scale);
              // G217 stays up until the actual page composer has warmed this newly entered world and kit.
              await request.page.world.game.warmEnteredFrame(owner);
              restored = true;
            },
          };
        } };
      return { resident, region: { ...foundation.region, dispose: () => { scope.dispose(); } }, queries: view.queries, checkpoint,
        aimAnimals: () => localPlay?.animals.animals ?? [],
        combatActors: () => new Map((localPlay?.animals.animals ?? []).map(animal => [animal.combatActor(), animal.position])),
        loadout: { checkpoint, stow: () => {
          stowed = true;
          if (localPlay !== null) { localPlay.weapons.stowed = true; localPlay.weapons.visible = false; localPlay.weapons.adsHeld = false; localPlay.weapons.altHeld = false; }
        }, interior: () => {
          stowed = false;
          if (localPlay !== null && localRuntime?.play === localPlay) { localPlay.weapons.stowed = false; localPlay.weapons.visible = true; }
        } } };
    } catch (error) {
      try { scope.dispose(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Regional admission and cleanup failed', { cause: cleanup }); }
      throw error;
    }
  };
}

/** SF57: a creature's border constraint built outside the admission closure. V8 gives every closure of one scope that
 *  scope's single context, so an inline `() => host.physics` there held the whole runtime (its hooks, the shard's world)
 *  for as long as any creature kept its constraint. */
function hostConstraint(host: { readonly physics: Parameters<typeof gridCreatureConstraint>[0] extends () => infer P ? P : never }, radius: number): ReturnType<typeof gridCreatureConstraint> {
  return gridCreatureConstraint(() => host.physics, radius);
}
