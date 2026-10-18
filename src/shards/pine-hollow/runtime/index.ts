import { installQuestCatalogue } from '@wildshard/game/quest/chapter';
import { residentWorldScope } from '@wildshard/game/shardfile/hybridPresentation';
import { registerPackedGeometrySource } from '@wildshard/sdk/models/geometrySources';
import { HeldEquipment } from '@wildshard/game/plugin/heldEquipment';
import { readAdventurePersistence } from '@wildshard/game/quest/persistence';
import { floorAtRects } from '@wildshard/engine/physics/box';
import { pageDecisionAuthority } from '@wildshard/game/shardfile/borrowedDecisions';
import { ClaimedPickupRoster } from '@wildshard/game/loot/runtime';
import type { CustomSections } from './productSections.generated.d.ts';
import { preloadKingKit } from './models/antlerKing';
import { installEnteredRuntimeService, installEnteredRuntimeUpdate, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import { runtimeAudio, installRuntimeAudioEntry, installRuntimeGameplayAudio } from '@wildshard/game/plugin/audio';
import { declaredSpawnTables } from '@wildshard/engine/ai/encounters';
import { pineLooks, preparePineGrazers } from '../species/looks';
import { declaredProductCompendium } from '@wildshard/game/shard/declaredRows';
import { installCollectionCompendium } from '@wildshard/game/models/collectionWall';
import { ShardPlugin,type ShardContext } from '@wildshard/game/plugin/context';
import type { ShardRuntime } from '@wildshard/game/shard/runtime';
import { installAiDebug } from '@wildshard/engine/ai/view/DebugOverlay';
import { macrotask, slicer } from '@wildshard/engine/boot/plan';
import { nextDrawnFrame, presenting } from '@wildshard/engine/core/framePacing';
import { withPreparedScriptMemories } from '@wildshard/engine/script/host';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { Vector3, Group, type Object3D } from 'three';
import questScenes from '../data/timberScenes.generated.json' with { type: 'json' };
import { STARTER_EFFECTS } from '@wildshard/sdk/runtime/effects';
import type { Particles } from '@wildshard/game/systems/looks/particles';
import { Bow } from '@wildshard/sdk/runtime/weapons/starterBow';
import { LivingBuildings } from '@wildshard/game/shardfile/livingBuildings';
import { hydrateWorldSceneWeld } from '@wildshard/game/shardfile/worldSceneWeld';
import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { parseWorldSceneWeld } from '@wildshard/format/worldSceneWeld';
import { parseBuildingLifeRows } from '@wildshard/format/buildings';
import { plumbingKnob } from '@wildshard/game/shard/declaredPlumbing';
import { buildTier, TIER_CONFIG } from '@wildshard/engine/core/tier';
import { LightPool } from '@wildshard/engine/fx/LightPool';
import { updatePineForest } from '../world/treeFactory';
import { lendLooks, setLentParam } from '@wildshard/sdk/looks/lentLooks';
import { dressPineWater } from '../world/water';
import { runtimeLookMaterials } from '@wildshard/game/shardfile/runtimeProduct';
import { loadUnderShapes } from './world/undergrowthKit';
import { loadUnderPlacements } from './world/timberSites';
import { pineModels, admitPineView } from './world/context';
import { Undergrowth } from '../world/undergrowth';
import { installWorldScenes } from '@wildshard/game/shardfile/worldScenes';
import { installPineLandmarks, type PineLandmarks } from './world/landmarks';
import { placeDrawnModels } from './world/drawnModels';
import { registerPlaceSets } from '@wildshard/engine/models/sets';
import { placedGroups } from '@wildshard/engine/models/place';
import { installHeldLoadout } from '@wildshard/game/loadout/held';
import { installPineCombat } from '../combat/install';
import { eliteStream } from '@wildshard/game/quest/eliteStreams';
import { readEliteFeature } from '@wildshard/game/quest/eliteFeature';
import { installPineQuest } from '../quest/index';
import { installPageLife } from '@wildshard/sdk/looks/pageLife';
import { HeldFinishes } from '@wildshard/game/loadout/finishes';

import { pineMemoryTrim } from './debug/options';
import { PosedDraw } from '@wildshard/sdk/looks/posedInstances';
import { installDeclaredAudio } from '@wildshard/engine/audio/declared';
import * as audioTerrain from '@wildshard/engine/world/Heightfield';
import { installWeather, loadPineRain } from '../world/weather';
import { HeldFirearm } from '@wildshard/game/plugin/heldFirearm';
import { HeldLauncher } from '@wildshard/game/plugin/heldLauncher';
import { readItemEquipment, readItemAmmunition, readItemInventory } from '@wildshard/game/plugin/nativeItems';
import { installItemEffects, heldFinishEffect } from '@wildshard/game/loadout/effects';
import type { SkinId } from '@wildshard/engine/player/Skins';
import { KING_KIND, registerKing, thrallVariant } from './antlerKing';

/** Legacy v0 modules prepared by the play hook. Owned v1 guests are
 * admitted by their population and encounter hosts. */
const PREPARED_MODULES = ['behaviour/director.wasm'] as const;

function runtime(ctx: ShardContext): ShardRuntime {
  const rt = ctx.game.runtime;
  if (rt?.world === undefined || rt.world === null) throw new Error('Pine plugin needs its world host');
  return rt;
}

/** Remaining native readers borrow data and the platform life owner. */
export interface PineCabins {
  readonly resources: SceneHandles;
  readonly life: LivingBuildings;
  readonly group: Group;
  readonly buildings: readonly { readonly id: string; readonly index: number; readonly root: string; readonly standalone: boolean }[];
  readonly roots: readonly Object3D[];
  readonly roofs: { x: number; z: number; rot: number; w: number; d: number }[];
}

/** Pine's authored world and gameplay; the shell supplies engine services at each hook. */
export class PineHollow extends ShardPlugin {
  private cabins: PineCabins | null = null;
  private landmarks: PineLandmarks | null = null;
  private particles: Particles | null = null;

  override async world(ctx: ShardContext): Promise<void> {
    const finishPack = ctx.product.section('held/finishes').source;
    if (finishPack === undefined) throw new Error('Held finishes require their declared geometry source');
    registerPackedGeometrySource(ctx.scope, 'held-finishes', { ...finishPack, label: 'held finishes' });
    await Promise.all([HeldFinishes.prepare(ctx.product, ctx.scope, 'held-finishes'), admitPineView(ctx.product)]);
    const rt = runtime(ctx), world = rt.world, step = rt.step;
    if (world === null || step === null) throw new Error('Pine world builder needs staged services');
    const { game, sky, forest, player, registry } = world;
    const trades = ctx.product.section<CustomSections['custom/tradeCatalogue']>('custom/tradeCatalogue');
    const packKinds = readItemInventory(ctx.product.section('combat/items').items).kinds;
    rt.menu = { skins: () => rt.play ? rt.play.skins.cardRows(HeldFinishes.current(ctx.manifest.slug).cards) : [], onWearSkin: (id) => { rt.hooks.wearFinish?.(id); }, skinsTitle: 'Finishes', pack: { note: "Everything here trades at Mott's stall", hint: "Trade at Mott's stall", gearHint: 'Tap a weapon to hold it · a finish to wear it', line: (id) => packKinds.includes(id) ? trades.lines[id] ?? 'Mott has no use for it' : null } };
    const [{ Grass }, { cutTerrain }, { setSight }] = await Promise.all([import('@wildshard/engine/world/Grass'), import('@wildshard/engine/physics/terrain'), import('@wildshard/engine/world/interact/Interactables')]);
    const { Particles: ParticleField } = await import('@wildshard/game/systems/looks/particles');
    const { trample, TRAMPLE_GLSL } = await import('@wildshard/game/systems/looks/trample');
    ctx.app.registerTrample(trample, ctx.scope);
    // The admitted graph list is author data; this scope still owns the compiled materials.
    const graphNames = ctx.product.section<CustomSections['custom/runtimeGraphs']>('custom/runtimeGraphs');
    lendLooks(ctx.scope, await runtimeLookMaterials(ctx, ctx.product.shardfile, true, graphNames));
    await dressPineWater(game);
    // the small wildlife's posed look (data/wildlifeLook.ts), before the forest's draw and any Model Explorer specimen
    const wildlife = await PosedDraw.library(ctx.product, 'look/wildlife-draw.json');
    lendLooks(ctx.scope, await runtimeLookMaterials(ctx, ctx.product.shardfile, true, [wildlife.name]));
    const sceneHandles = await installWorldScenes(ctx, ctx.product.section('world/scenes'), residentWorldScope(ctx));
    const streams = { group: sceneHandles.group('streams.root'), water: sceneHandles.mesh('streams.water'), spray: sceneHandles.mesh('streams.spray') };
    game.scene.add(streams.group);
    const carpet = await step('grass', async () => {
      const grass = new Grass(sky, forest, { trample: { field: trample, glsl: TRAMPLE_GLSL } }).build();
      await macrotask();
      const under = await new Undergrowth(sky, forest, await loadUnderShapes(pineModels(sky)), await loadUnderPlacements()).buildAsync(macrotask);
      const particles = new ParticleField(sky, forest).build();
      game.scene.add(grass.group, under.group, particles.group);
      return { grass, under, particles };
    });
    this.particles = carpet.particles;
    rt.overhead.push(carpet.grass.group, carpet.under.group, carpet.particles.group);
    await step('cabins', async () => {
      const appearance = ctx.product.section<CustomSections['custom/cabinAppearance']>('custom/cabinAppearance');
      const knob = (id: string) => plumbingKnob(ctx.product.shardfile.plumbing, buildTier(), id, 'boolean', TIER_CONFIG);
      const shared = knob('pine.sharedCabinLights'), shadow = knob('pine.cabinDetailShadows');
      const input = await ctx.product.json<{ graph: unknown; life: unknown }>(`scenes/cabins/living/${buildTier()}-${String(shadow)}-${String(shared)}.json`);
      const graph = parseWorldSceneWeld(input.graph), lifeRows = parseBuildingLifeRows(input.life), group = new Group();
      sceneHandles.publish('cabins.root', group);
      const geometry = new Map(graph.nodes.flatMap(node => 'geometry' in node ? [[JSON.stringify([node.geometry.library, node.geometry.model]), sceneHandles.geometry(`cabins.living.geometry.${node.geometry.library}.${node.geometry.model}`)] as const] : []));
      const materials = new Map(ctx.product.section('world/scenes').materials.filter(row => sceneHandles.has(`materials.${row.id}`)).map(row => [row.id, sceneHandles.material(`materials.${row.id}`)]));
      const life = new LivingBuildings(sceneHandles, appearance.CABIN_LIFE), owner = residentWorldScope(ctx);
      if (shared) for (let k = 0; k < Math.min(appearance.CABIN_LIGHT.count, 4); k++) {
        const light = appearance.CABIN_LIGHT;
        lifeRows.shared.push(sceneHandles.lend(LightPool.for(game.scene).acquire(light.color, light.intensity, light.distance, light.decay)));
      }
      hydrateWorldSceneWeld(graph, sceneHandles, { geometry, materials, plumbing: ctx.product.shardfile.plumbing }, owner);
      life.add(lifeRows);
      const sites = await ctx.product.json<Pick<PineCabins, 'buildings' | 'roofs'>>('world/building-sites.json');
      const cabins: PineCabins = { resources: sceneHandles, life, group, ...sites, roots: sites.buildings.filter(row => row.standalone).map(row => sceneHandles.object(row.root)) };
      game.scene.add(group);
      rt.interactables.push(...life.interactables);
      await sceneHandles.assemble('cabins.shells');
      cabins.life.persist(ctx.app.saves, residentWorldScope(ctx), { id: ctx.manifest.slug, shard: ctx.manifest.slug, group: 'cabins' });
      cabins.life.registerDoors(registry, player.position);
      const landmarks = await installPineLandmarks({ sky, registry, cabins, scenes: sceneHandles, onUpdate: retainsRuntimeServices(ctx)
        ? fn => { installEnteredRuntimeUpdate(ctx, { id: 'pine.landmarks', phase: 'update', run: fn }); } : fn => { game.onUpdate(fn, 'pine.landmarks'); } });
      const cave = landmarks.crags?.cave;
      if (cave) { cutTerrain(world.physics, cave.terrainCuts()); await world.terrain.punchSliced(cave.holeTest(), slicer(30).due); }
      cabins.life.interactables.forEach(item => { setSight(item, { slack: 0.75 }); });
      this.cabins = cabins; this.landmarks = landmarks;
    });
    const props = await step('props', async () => {
      const rocks = await sceneHandles.place('props.rocks'), stumps = await sceneHandles.place('props.stumps'), logs = await sceneHandles.place('props.log');
      return { colliderDescs: () => [...rocks.colliders, ...stumps.colliders, ...logs.colliders] };
    });
    await placeDrawnModels({ sky, renderer: game.renderer, forest, under: carpet.under, registry }, slicer(30).due);
    Object.assign(rt.objects, { cabins: this.cabins, props, streams, ...carpet });
    const eye = new Vector3(), sunColour = [1, 1, 1];
    const hearth = ctx.product.section<CustomSections['custom/cabinAppearance']>('custom/cabinAppearance').HEARTH_LOOKS.smoke;
    rt.hooks.worldUpdate = (dt, t) => {
      updatePineForest(forest.factory, rt.viewer());
      carpet.grass.update(dt, rt.viewer());
      carpet.under.update(dt, rt.viewer());
      carpet.particles.update(dt, rt.viewer(), game.camera);
      sky.viewCamera.getWorldPosition(eye);
      this.cabins?.life.tick(dt, t, eye, sky.lamps);
      sunColour[0] = sky.sunColor.r; sunColour[1] = sky.sunColor.g; sunColour[2] = sky.sunColor.b;
      setLentParam(hearth, 'sunColour', sunColour); setLentParam(hearth, 'lamps', sky.lamps); setLentParam(hearth, 'shade', 1 - 0.8 * sky.night);
    };
  }

  override async kit(ctx: ShardContext): Promise<void> {
    const audio = ctx.app.audio;
    if (audio === null) throw new Error('Pine synth bed needs its mixer');
    installRuntimeAudioEntry(ctx,'kit',{audio});
    await preparePineGrazers(ctx.product);
    registerKing();
    ctx.rows.species(ctx.product.section('actors/species-programs').page);
    ctx.rows.speciesLook(pineLooks(ctx.product.section<CustomSections['custom/thrallLook']>('custom/thrallLook')));
    ctx.rows.spawnTable(declaredSpawnTables(ctx.product.section('actors/species-programs').spawns));
    installQuestCatalogue(ctx);
    ctx.rows.compendium({ ...declaredProductCompendium(ctx.product, 'pine.journal'), id: 'pine.journal' });
    const rt = runtime(ctx), world = rt.world;
    if (world === null) throw new Error('Pine equipment needs a world');
    const held = await HeldEquipment.prepare(ctx.product);
    await preloadKingKit();
    const items = ctx.product.section('combat/items').items;
    const CROSSBOW = readItemEquipment(items, 'weapon.crossbow'), LEVER = readItemEquipment(items, 'weapon.lever'), LONGBOW = readItemEquipment(items, 'weapon.longbow');
    held.install(ctx);
    ctx.rows.encounter({ id: KING_KIND, displayName: 'The Antler King', showHeadBar: false });
    ctx.rows.weapon([CROSSBOW, LEVER, LONGBOW]);
    ctx.rows.ammo([...readItemAmmunition(ctx.product.shardfile.items, 'weapon.crossbow').values()].map(ammo => ammo.row));
    ctx.rows.effect([...HeldFinishes.current(ctx.manifest.slug).cards.map(({ id }) => heldFinishEffect(id, HeldFinishes.current(ctx.manifest.slug).get(id).weapon)), ...STARTER_EFFECTS]);
    ctx.rows.skin(HeldFinishes.current(ctx.manifest.slug).list());
  }

  override async play(ctx: ShardContext): Promise<void> {
    if (!retainsRuntimeServices(ctx)) return this.installPlay(ctx);
    const modules = await Promise.all(PREPARED_MODULES.map(name => ctx.product.file(name)));
    await withPreparedScriptMemories(modules, ctx.scope, () => presenting() ? nextDrawnFrame(ctx.scope) : macrotask(), () => this.installPlay(ctx));
  }

  private async installPlay(ctx: ShardContext): Promise<void> {
    const eliteRows = await readEliteFeature(ctx.product, 'actors/elites.json');
    const pickupStream = (id: string): (() => number) => { const stream = eliteStream(eliteRows, ctx.product.shardfile.identity.seed, 'pickup', id); return () => stream.next(); };
    const [{ WeaponPickup }, { applySkin, clearSkin }] = await Promise.all([import('@wildshard/engine/player/WeaponPickup'), import('@wildshard/engine/player/Skins')]);
    const rt = runtime(ctx), world = rt.world, h = rt.play;
    if (world === null || h === null) throw new Error('Pine gameplay needs its player host');
    const { game, sky, player, forest, registry, params } = world;
    const { animals, weapons, inventory, hud, audio, music, skins, wearSkin, menu, touchUi, nolock } = h;
    installRuntimeAudioEntry(ctx,'play',{audio,music});
    const { cabins, landmarks, particles } = this;
    const cabinAudio = { ...ctx.product.section<CustomSections['custom/cabinAmbience']>('custom/cabinAmbience') };
    if (cabins === null) { cabinAudio.floors = []; cabinAudio.firePits = []; }
    const rifle = h.rifle, longbow = h.secondary, crossbow = h.primary;
    if (!(rifle instanceof HeldFirearm) || !(longbow instanceof Bow) || !(crossbow instanceof HeldLauncher)) throw new Error('Pine ranged kit was not built');
    installAiDebug(ctx, { game, actors: () => animals.animals, player }, undefined,
      retainsRuntimeServices(ctx) ? (install) => { installEnteredRuntimeService(ctx, install); } : undefined);
    rt.hooks.wearFinish = (id) => {
      if (!HeldFinishes.current(ctx.manifest.slug).has(id)) return;
      const pick = skins.pick(id); if (!pick) return;
      if (pick.act === 'wear') { wearSkin(pick.skin); return; }
      clearSkin(pick.skin.weapon === 'rifle' ? rifle.model : crossbow.model);
      ctx.app.effects?.sync(weapons.get(pick.skin.weapon), []); skins.wear(pick.skin.weapon, null);
    };
    const pickupRows = ctx.product.section('combat/items').items.pickups;
    if (pickupRows === undefined) throw new Error('Pine requires its admitted skin pickups');
    const skinDrops = new ClaimedPickupRoster<SkinId>(pickupRows, {
      scene: game.scene, has: id => skins.has(id), random: () => ctx.app.rng.stream('loot').next(), visualRandom: pickupStream('skin-drops'),
      model: id => { const skin = HeldFinishes.current(ctx.manifest.slug).get(id), item = skin.weapon === 'rifle' ? rifle.displayModel() : crossbow.displayModel(); applySkin(item, skin, sky); return item; },
      enter: (_id, drop) => { rt.interactables.push(drop.interactable); },
      take: id => { const skin = HeldFinishes.current(ctx.manifest.slug).get(id), label = skin.weapon === 'rifle' ? 'lever-action' : 'crossbow'; skins.own(skin.id); wearSkin(skin); if (skin.weapon === 'rifle') { weapons.unlock('rifle'); weapons.select('rifle'); } audio.hitMarker(); hud.toast(`${skin.name} ${label} — ${skin.blurb}`); },
    });
    ctx.on('actor.died', ({ actor }) => {
      const animal = animals.animals.find((a) => a.combatActor() === actor);
      if (animal === undefined) return;
      const drop = skinDrops.death(animal, player.position);
      if (drop === null || rt.hooks.isElite?.(animal) === true) return;
      drop.at.y = Math.max(drop.at.y, heightAt(drop.at.x, drop.at.z));
      skinDrops.spawn(drop.id, drop.at, true);
    });
    const loadout = installHeldLoadout(ctx, ctx.product.section('held/loadout'));
    const rifleDrop = (() => {
      if (cabins === null) return null;
      const site = questScenes.sites.rifle, position = new Vector3(site.x, site.y, site.z);
      const drop = new WeaponPickup({ scene: game.scene, item: rifle.displayModel(), position, tier: 'common', prompt: 'Take the lever-action', scale: 1.3, random: pickupStream('cabin-rifle') });
      rt.interactables.push(drop.interactable);
      drop.onNear = (inside) => audio.pickupHum(inside);
      drop.onPickup = () => { weapons.unlock('rifle'); weapons.select('rifle'); audio.hitMarker(); music.sting('pickup'); hud.toast('Lever-action rifle acquired · 1/2 to switch, Q to swap, R feeds the tube'); };
      return drop;
    })();
    if (loadout.hasRifle || params.get('weapon') === 'rifle' || params.get('weapon') === 'lever') rifleDrop?.dispose();
    rt.hooks.disposeRifleDrop = () => { rifleDrop?.dispose(); };
    rt.hooks.updatePickups = (dt, t) => { rifleDrop?.update(dt, t, game.renderer, game.camera); skinDrops.update(dt, t, game.renderer, game.camera, player.position); };
    installItemEffects(ctx);
    // SF67: the King's and his parked thralls' models, each in its own task before the combat install's prewarm spawns them
    // (the same cached models it would build in one stretch; the factory builds each from its own key's seed)
    await ctx.scope.run(() => animals.factory.prepareModels([
      { kind: KING_KIND, variant: 'warden' }, { kind: 'elk', variant: thrallVariant('elk') }, { kind: 'boar', variant: thrallVariant('boar') },
    ]));
    // SF57: after the play hook's first await the owner is the page's; the boss / elite bars and the Elites service end with
    // this runtime, not with the page (one set per visit used to stay for the page's life)
    const decisions=await pageDecisionAuthority(ctx),decisionProgram=ctx.product.section('actors/species-programs').program;
    if(decisionProgram===undefined)throw new Error('Pine requires its King decision programme');
    const persistenceRows = await readAdventurePersistence(ctx);
    const fights = ctx.scope.run(() => installPineCombat({ eliteRows, pouchCapacity: ctx.product.section('held/loadout').pouch.capacity, persistenceRows, decisionProgram,decisions, context: ctx, game, sky, player, animals, weapons, crossbow, rifle, skins, wearSkin, inventory, hud, audio, music, interactables: rt.interactables, params,
      longbow: { displayModel: () => longbow.displayModel(), grant: () => { loadout.grantLongbow(); } }, ironFirst: () => { loadout.onPlayerDeath(); } }));
    ctx.answer('weather.hold', (previous) => ctx.app.render === game ? Math.max(previous, fights.weatherHold()) : previous);
    const trophyPack = ctx.product.section<CustomSections['custom/trophyMounts']>('custom/trophyMounts');
    registerPackedGeometrySource(ctx.scope, 'collection-mounts', { url: ctx.product.url(trophyPack.url), rows: trophyPack.rows, label: 'trophy-wall' });
    const compendium = installCollectionCompendium(new Map([['compendium', { context: ctx, chunkId: ctx.manifest.slug, game, camera: game.camera, hud, menu, animals, cabins, interactables: rt.interactables, weapons, touchUi, nolock }]]), { mounts: 'collection-mounts', scope: ctx.scope, product: ctx.product, pack: trophyPack, chalk: ctx.product.section<CustomSections['custom/paintedTextures']>('custom/paintedTextures').chalk, texture: ctx.product.section<CustomSections['custom/paintedTextures']>('custom/paintedTextures').textures.chalk });
    const quest = await installPineQuest(ctx, { cabins, landmarks, loadout, compendium });
    const placeSets = ctx.product.section<CustomSections['custom/placeSets']>('custom/placeSets');
    registerPlaceSets(placeSets, { file: 'generators/placeSets.ts', registry, centres: { placed: placedGroups(), point: row => row } });
    const ambience = installDeclaredAudio(runtimeAudio(ctx, ctx.product.shardfile.audio), { audio, sea: 0, floorRows: { cabins: cabinAudio.floors }, sites: { cabins: audioTerrain.CABIN_SITES }, owners: { terrain: audioTerrain, cabins: { ...cabins?.life.audioState, firePits: cabinAudio.firePits } }, ...(retainsRuntimeServices(ctx) ? { scope: ctx.scope } : {}) }, 'ambience');
    fights.useSfx(ambience.sfx); quest.useSfx(ambience.sfx);
    await installRuntimeGameplayAudio(ctx, { audio, music, camera: game.camera, ambience, ...(cabins === null ? {} : { doorChanges: cabins.life.doorChanges }), owners: { sky, animals, elites: fights.elites } });
    landmarks?.crags?.cave.spots().forEach(spot => { ambience.addSpot({ zone: 'cave', ...spot, fade: 3 }); });
    await installWeather(ctx, { game, sky, trees: forest.trees, rain: await loadPineRain(), animals, particles, ambience,
      roofAt: (x, z) => floorAtRects(cabinAudio.floors, x, z, 'first') !== undefined || (landmarks?.crags?.cave.inside(x, z) ?? false), stagAt: () => quest.stagAt(), viewer: rt.viewer, horizonVeil: rt.horizonVeil });
    if (pineMemoryTrim()) animals.shadowBatch = false;
    const life = await installPageLife(ctx, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('actors/page-life.json'))), compendium?.state ?? null, ambience.sfx);
    Object.assign(rt.objects, { pineLife: life, ambience });
    ctx.debug.expose(`harness.shard.${ctx.manifest.slug}`, { cabins, props: rt.objects['props'], streams: rt.objects['streams'], pineLife: life });
    rt.hooks.equipmentUpdate = (dt) => { loadout.update(dt); };
    rt.hooks.audioUpdate = (dt) => { ambience.update(dt, game.camera); };
    rt.hooks.dispose = () => { ambience.dispose(); };
    rt.hooks.checkpoint = () => fights.onPlayerDeath();
    rt.hooks.eliteEngaged = () => fights.eliteEngaged();
    rt.hooks.isElite = (animal) => fights.isElite(animal);
    rt.hooks.stepSurface = (at) => ambience.stepSurface(at.x, at.z, at.y);
    rt.hooks.directional = true;
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default PineHollow;
