/**
 * The concrete regional world of a trusted hybrid cell (SHARD-PLATFORM SF47 / M3, E452): the foundation that
 * `createRegionalRuntimeFactory` composes, so an admitted first-party runtime can run as a neighbour cell instead of the
 * page's home.
 *
 * The page keeps its one renderer, camera, sky, player, input and combat. The region owns, under its resident scope,
 *
 * - a bodyless destination `SimHost` (its own Physics, no second traveller capsule) with the real terrain collider of the
 *   region's level, plus whatever cell installs the live session adds (borders, entry sockets, transfer walls);
 * - a `LevelFrameBinding` (level, heightfield, chunk constants, water, navmesh) that is entered with the runtime scope;
 * - a scene subtree: a `Scene` parented under the regional view's root (already at the cell's render offset), which
 *   `Game.bindScene` makes `game.scene` while the runtime is entered, so content the runtime adds to `game.scene` draws
 *   in place; the root scene, its one sky dome and its one sun keep rendering (SF19a's one grid frame);
 * - terrain built with `Terrain.build(..., frame.terrain)` and the region level's own look painter (whatever its `look`
 *   declares as `terrainPainter`; absent, the engine ground from the level's own assets: its splat, layers, boreal set), a forest built inside `frame.run`, and the regional
 *   AnimalManager built with `buildAsync(pause, frame)`, all children of that subtree;
 * - its part in the one grid frame (`frameLook.ts`): its scene's own fog object (which its runtime's weather writes) and
 *   its level's grade, contributed to the page's frame while resident, so its air and grade own the frame inside its cell
 *   and blend across the edge band; it builds no sky dome or sun of its own.
 * - its light on the page's one sky (`regionLight.ts`, G223): whatever its runtime lights (the key light, fill, sun disc,
 *   shadow maps, painterly / fog uniforms, volumetric light, engine grade) is held on each entry and put back on leave.
 * - its own sky (`regionSky.ts`, G223 / G232): its level's sky backdrop laid
 *   over the page's one sky by its owner weight, charged under its own `sim-sky:` claim beside the runtime's.
 * - its own look parts (SF63): its level's grass driver (`LookStrategy.grass`) is bound with its level frame, so its
 *   runtime grows its own grass, never the page look's or the engine carpet reading its splat wrongly; and (G232)
 *   its level's light model and fog (`LookStrategy.lighting` / `fog`) scoped to its own
 *   materials as region-keyed program variants (`render/regionLook.ts`), freed with the resident scope.
 *
 * Leave: the frame, scene binding and forest LOD system end with the entered scope, and the view hides its root. Dispose
 * (the resident scope): the host's Physics frees every body and collider, the subtree leaves the page scene and frees the
 * GPU resources the asset cache does not share. Memory: everything here is inside the whole-runtime claim the caller
 * reserved (`regionalRuntimeAccountedBytes`); this module reserves nothing beside it but the optional region sky's claim
 * (`regionSky.ts`). Generic game code (E405).
 */
import { Fog, Group, Material, Mesh, Scene, type Object3D, type Texture } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { withOwner } from '@wildshard/engine/app/ownership';
import { TexturePolicyBinding, registerGpuFiles } from '@wildshard/engine/boot/gpuFiles';
import { ownSceneTree } from '@wildshard/engine/app/sceneOwnership';
import type { EquipmentService } from '@wildshard/engine/combat/EquipmentService';
import { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { LevelFrameBinding, type LevelFrameOptions } from '@wildshard/engine/level/frame';
import type { LevelSpec } from '@wildshard/engine/level/spec';
import type { Rapier } from '@wildshard/engine/physics/rapier';
import { addTerrain } from '@wildshard/engine/physics/terrain';
import { applySkin, type SkinDef } from '@wildshard/engine/player/Skins';
import { createSimHost, type SimHost, type SimLevel } from '@wildshard/engine/sim';
import { SkyRig } from '@wildshard/engine/world/skyRig';
import { loadLUT } from '@wildshard/engine/boot/bakedApi';
import { Terrain } from '@wildshard/engine/world/Terrain';
import { TreeFactory } from '@wildshard/engine/world/TreeFactory';
import { Forest } from '@wildshard/engine/world/forest/Forest';
import { WaterBodies } from '@wildshard/engine/world/water/body';
import { CHUNK_SIZE } from '@wildshard/engine/core/config';
import { TIER } from '@wildshard/engine/core/tier';
import type { ShardManifest } from '../shard/manifest';
import { prepareShardAssets } from '../shard/load';
import { toLevelSpec } from '../shard/spec';
import type { ShardWorld } from '../shard/world';
import type { RegionalRuntimeFoundation, RegionalRuntimeRequest } from './regionalRuntime';
import { frameLookOf, lookChainKind, regionChain, regionGrade, type FrameLookPort } from './frameLook';
import { applyLevelLight, holdPageLight, regionLightSwap } from './regionLight';
import { buildRegionSky } from './regionSky';
import { imagesFirstPlayingBytes } from './runtimeCost';

/** Page-root ports; every default is the standalone behaviour, the live session supplies the cell's own installs. */
export interface RegionalWorldPorts {
  readonly rapier: Rapier;
  /** The trusted level of the admitted manifest (default: the manifest's ordinary `toLevelSpec`). */
  readonly level?: (manifest: ShardManifest) => LevelSpec;
  /** The level's baked navmesh (the browser passes `loadNavmesh`); absent: none. */
  readonly navmesh?: (level: LevelSpec) => Promise<LevelFrameOptions['navmesh']>;
  /** The level's water bodies; absent: an empty set the runtime's own registrations fill while entered. */
  readonly water?: (level: LevelSpec) => WaterBodies;
  /** Cell installs on the owned destination (grid borders, entry sockets, transfer walls), before any gameplay. */
  readonly install?: (host: SimHost, request: RegionalRuntimeRequest) => void;
  /** The region's native continuation; false keeps the traveller in the source frame. */
  readonly checkpoint: (host: SimHost, request: RegionalRuntimeRequest) => boolean;
  /** Yield between herd slices and heavy builds (a macrotask in the browser). */
  readonly pause: () => Promise<void>;
  /** The drawn ground (default: `regionalTerrain`, the level's own painter on the frame's captured heightfield and assets). */
  readonly terrain?: (level: LevelSpec, scope: Scope, binding: LevelFrameBinding['terrain']) => Promise<Terrain>;
  /** The one grid frame's live-region port (default: the frame bound to the page's root scene; null: none). */
  readonly look?: FrameLookPort | null;
  /**
   * The region's light swap on the page's one sky (`regionLight.ts`, G223), installed on each entry: default, the page's
   * whole shared light held on entry and put back on leave when the page sky is a real rig; null: none.
   */
  readonly light?: ((entry: Scope) => void) | null;
}
/**
 * A region's drawn ground as its own level paints it standalone: the painter its look declares (`LookStrategy.terrainPainter`),
 * owned by the region's scope, on the frame's captured heightfield; without one, the engine ground from the level's own
 * assets (splat, layers, boreal set). Only the painter is taken from the look: its sky, fog and chain stay the frame's.
 */
export async function regionalTerrain(level: LevelSpec, scope: Scope, binding: LevelFrameBinding['terrain']): Promise<Terrain> {
  const painter = level.look === undefined ? undefined : (await level.look()).terrainPainter;
  if (scope.disposed) throw new Error('Regional terrain left while loading its look');
  return new Terrain().build(level.ground, painter, scope, binding);
}

/** What a leak check reads from a prepared region, beside the view's own census. */
export interface RegionalWorldCensus { readonly bodies: number; readonly colliders: number; readonly sceneBound: boolean; readonly parented: boolean; readonly disposed: boolean }
const census = new WeakMap<RegionalRuntimeFoundation, () => RegionalWorldCensus>();
/** The live native and scene state of a foundation this module prepared (null for any other foundation). */
export function regionalWorldCensus(foundation: RegionalRuntimeFoundation): RegionalWorldCensus | null { return census.get(foundation)?.() ?? null; }

const isMaterial = (value: unknown): value is Material => value instanceof Material;
/** a level's sky backdrop as the page's sky layers it (G223) */
type LayeredBackdrop = NonNullable<Awaited<ReturnType<SkyRig['layeredBackdrop']>>>['backdrop'];
/** a layered sky's volumetric light: the page's chain never has one to hand (G232 hands a region's clock the page's saturation, SF63 its god rays) */
const NO_VOL: Parameters<LayeredBackdrop['attachPost']>[0]['vol'] = { setSun: () => undefined, setFogColor: () => undefined, setStrength: () => undefined };

function simLevel(level: LevelSpec): SimLevel {
  const { spawn } = level;
  return { version: 1, id: level.id, seed: level.seed ?? 0, ground: { size: CHUNK_SIZE, height: 0 },
    player: { at: { x: spawn.x, y: spawn.y ?? 0, z: spawn.z }, yaw: spawn.yaw, speed: 0 }, entities: [], quests: [],
    // A bodyless destination has no authored player strike; its creatures are the regional AnimalManager's.
    weapon: { id: 'region.none', shape: { kind: 'ring', inner: 0, outer: 0 }, windup: 0, active: 0, recover: 0, cooldown: 0, range: 0, damage: 0, tags: [] } };
}

/** The `prepareFoundation` port of `createRegionalRuntimeFactory` for any trusted hybrid manifest. */
export function createRegionalWorldFoundation(ports: RegionalWorldPorts): (request: RegionalRuntimeRequest) => Promise<RegionalRuntimeFoundation> {
  return async request => {
    if (request.scope.disposed) throw new Error('Regional world requires a live runtime scope');
    const { cell, page } = request, app = page.context.app, home = page.world, game = home.game, sky = home.sky;
    const level = (ports.level ?? toLevelSpec)(request.manifest);
    const { slug: identity } = request.manifest;
    if (level.id !== identity) throw new Error('Regional level identity differs from its trusted manifest');
    const resident = request.scope.child(`grid.world:${cell.instance}`), left = (): boolean => resident.disposed;
    const textures = new TexturePolicyBinding(request.manifest.tiers?.[TIER]?.textures, identity, imagesFirstPlayingBytes(request.manifest.runtimeCost));
    // Exclusive runtime construction has retired the source. Keep the destination's policy through asynchronous
    // setup, then restore the page on the road. Entered frame scopes reinstall this same resolved policy for hooks.
    const leaveTextures = textures.enter(); resident.onDispose(leaveTextures);
    const scene = new Scene(); scene.name = `region-scene:${cell.instance}`;
    let bound = 0;
    ownSceneTree(scene, resident, app.assets);
    try {
      await prepareShardAssets(request.manifest, registerGpuFiles);
      if (left()) throw new Error('Regional world left while registering its texture stand-ins');
      const navmesh = ports.navmesh === undefined ? null : await ports.navmesh(level);
      await ports.pause();
      if (left()) throw new Error('Regional world left while loading its navmesh');
      const water = ports.water?.(level) ?? new WaterBodies();
      // the level's own look parts its content builds from while its frame is bound (SF63: its grass driver)
      const levelLook = level.look === undefined ? null : await level.look();
      if (left()) throw new Error('Regional world left while loading its look');
      const frame = new LevelFrameBinding({ level, scope: resident, levelScope: request.scope, navmesh, water, textures, look: levelLook });
      const field = (): typeof frame.terrain.field => frame.terrain.field;
      const host = withOwner(resident, () => createSimHost(simLevel(level), { rapier: ports.rapier, playerBody: false, ground: false,
        heightAt: (x, z) => field().heightAt(x, z), scope: resident }));
      // The real ground of the region's level, sampled from its own bound heightfield (never the home's).
      frame.run(app, () => { addTerrain(host.physics); });
      ports.install?.(host, request);
      await ports.pause();
      if (left()) throw new Error('Regional world left while building its collision');
      const terrain = await (ports.terrain ?? regionalTerrain)(level, resident, frame.terrain);
      await ports.pause();
      if (left()) throw new Error('Regional world left while building its terrain');
      terrain.group.traverse((node: Object3D) => { const material: unknown = node instanceof Mesh ? node.material : null; if (isMaterial(material)) sky.setupMaterial(material); });
      scene.add(terrain.group);
      const trees = level.trees?.factory;
      const factory = typeof trees === 'function' ? await (await trees())(game.renderer, sky) : new TreeFactory(game.renderer).buildEmpty();
      await ports.pause();
      if (left()) throw new Error('Regional world left while building its trees');
      const forest = frame.run(app, () => new Forest(factory, sky).build({ drawnBy: level.trees?.drawnBy ?? 'self' }));
      if (forest.trees.length === 0) forest.group.visible = false; else scene.add(forest.group);
      terrain.applyCanopy(forest.canopyMap);
      await ports.pause();
      if (left()) throw new Error('Regional world left while building its forest');
      const ground = { heightAt: (x: number, z: number): number => field().heightAt(x, z), waterSurfaceAt: (x: number, z: number): number | null => water.restAt(x, z) };
      let world: ShardWorld | null = null;
      // SF63 part 2: the region's scoped look, whose per-frame parts run only while its cell is entered
      let regionLook: ReturnType<SkyRig['scopeLevelLook']> = null;
      // its light on the page's one sky: held on each entry, put back on leave (G223); its first entry starts from its own level's light
      const light = ports.light !== undefined ? ports.light : sky instanceof SkyRig ? regionLightSwap(() => holdPageLight({ sky, game }), () => { applyLevelLight({ sky, scene }, level); }) : null;
      const foundation: RegionalRuntimeFoundation = {
        region: { host, dispose: () => { resident.dispose(); } },
        ground,
        world: view => {
          if (world !== null) throw new Error('Regional world is already composed');
          if (resident.disposed) throw new Error('Regional world left before composition');
          // The region's own fog object: its runtime's weather writes it (it is never drawn itself) ...
          scene.fog = game.rootScene.fog?.clone() ?? null;
          // ... which is the owner's air in the one frame, with its level's grade, while the region is resident
          const look = ports.look === undefined ? frameLookOf(game.rootScene) : ports.look;
          // G232: on a neutral page shell its whole grade chain (grade, look layer, learned LUT) is carried exactly
          let lut: Texture | null = null;
          if (look !== null) resident.onDispose(look.contribute(cell.instance, { fog: scene.fog, grade: regionGrade(level), chain: regionChain(level, () => lut, lookChainKind(levelLook)) }));
          // G223 / G232: its level's own sky backdrop laid over the one sky by its owner weight
          if (look !== null && sky instanceof SkyRig) void (async () => {
            try {
              const made: { backdrop: LayeredBackdrop | null } = { backdrop: null };
              const outcome = await buildRegionSky({ instance: cell.instance, look, allocator: request.allocator, scope: resident, layered: async () => {
                const make = level.look === undefined ? undefined : (await level.look()).backdrop;
                const layered = make === undefined ? null : await sky.layeredBackdrop(make, { level, scope: resident, air: () => (scene.fog instanceof Fog ? scene.fog : null) });
                if (layered === null) return null;
                made.backdrop = layered.backdrop;
                // its clock turns the page's saturation with its hour as standalone, where the page carries its chain
                const post = look.post?.() ?? null;
                if (post !== null) layered.backdrop.attachPost({ vol: NO_VOL, rays: post.rays, hueSat: post.hueSat });
                return layered;
              } });
              // its LUT: the drawn backdrop's (it loaded the level's), else the level's own file when it has no backdrop
              if (outcome === 'drawn') lut = made.backdrop?.lut ?? null;
              else if (outcome === 'off' && !left() && (look.post?.() ?? null) !== null) {
                const own = await loadLUT(level.id);
                if (own !== null && left()) own.dispose();
                else if (own !== null) { lut = own; resident.onDispose(() => { lut = null; own.dispose(); }); }
              }
            } catch (error) { console.warn(`[region sky] ${cell.instance}`, error); }
          })();
          view.root.add(scene); scene.updateMatrixWorld(true);
          // SF63 / G232: its level's light model and fog on its own materials only
          const scoped = levelLook !== null && sky instanceof SkyRig ? sky.scopeLevelLook(view.root, level, levelLook, resident, { isShared: (material) => app.assets.isAcquired(material) }) : null;
          if (scoped !== null) {
            const lookCensus = (): void => { if (scoped.sweep() > 0) console.info(`[region look] ${cell.instance}: ${scoped.patched()} materials on ${level.id}'s light and fog`); };
            lookCensus();
            app.addSystem({ id: `grid.look.${cell.instance}`, phase: 'late', run: lookCensus }, resident);
            regionLook = scoped;
          }
          if (forest.trees.length > 0 && forest.drawer === 'self') withOwner(view.scope, () => view.registry.add({ id: `forest:${cell.instance}`, name: 'Forest', category: 'nature',
            file: 'src/engine/world/forest/Forest.ts', surface: 'wood', colliders: forest.colliderDescs() }));
          world = { ...home, terrain, forest, physics: host.physics, registry: view.registry, chunk: request.manifest };
          return world;
        },
        enter: entry => {
          if (resident.disposed || entry.disposed) throw new Error('Regional world requires a live resident and entry');
          light?.(entry); // first, so the page's light goes back last, after everything the entry installed has left
          frame.enter(app, entry);
          const leaveScene = game.bindScene(scene, entry); bound++;
          entry.onDispose(() => { leaveScene(); bound--; });
          app.addSystem({ id: `grid.runtime.${cell.instance}.forest`, phase: 'update', run: (dt) => { forest.update(dt, home.player.position); } }, entry);
          // its look's per-frame parts (its sky dressing's update, its frame hook) while entered: they write its own uniforms only
          const scopedLook = regionLook;
          if (scopedLook !== null) app.addSystem({ id: `grid.look.${cell.instance}.frame`, phase: 'update', run: (dt, t) => { scopedLook.frame(dt, t); } }, entry);
        },
        afterKit: async () => {
          if (resident.disposed) throw new Error('Regional world left before its creatures');
          const animals = frame.run(app, () => new AnimalManager(scene, sky, forest));
          await animals.buildAsync(ports.pause, frame);
          if (left()) throw new Error('Regional world left while building creatures');
          return { animals, wearSkin: (equipment: EquipmentService, skin: SkinDef): void => {
            const model = equipment.get(skin.weapon).model;
            if (model instanceof Group) applySkin(model, skin, sky);
          } };
        },
        checkpoint: () => !resident.disposed && ports.checkpoint(host, request),
      };
      census.set(foundation, () => {
        const native = resident.disposed ? { bodies: 0, colliders: 0 } : { bodies: host.physics.world.bodies.len(), colliders: host.physics.world.colliders.len() };
        return { ...native, sceneBound: bound > 0, parented: scene.parent !== null, disposed: resident.disposed };
      });
      return foundation;
    } catch (error) {
      resident.dispose();
      throw error;
    } finally { leaveTextures(); }
  };
}
