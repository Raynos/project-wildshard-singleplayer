import { ClaimedPickupRoster } from '@wildshard/game/loot/runtime';
import { SECTIONS } from './sections';
import { preloadHeldGeometry } from './boot/crossbowGeometry';
import { preloadKingKit } from './models/antlerKing';
import { installEnteredRuntimeService, installEnteredRuntimeUpdate, installRetainedPlayerEffects, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import { runtimeAudio } from '@wildshard/game/plugin/audio';
import { requireAudioProfile } from '@wildshard/engine/audio/audioProfiles';
import { installEnteredPineScore } from './audio/score';
import { bindRuntimeEquipment, runtimeEquipment } from '@wildshard/game/plugin/headless';
import { STRINGS } from '../strings';
import { installEnteredPineVoices } from './audio/entered';
import { PINE_SPAWNS } from '../combat/spawns';
import { PINE_SPECIES, pineDeer, pineElk } from '../species/rows';
import { pineLooks } from '../species/looks';
import { PINE_HOLLOW_COMPENDIUM } from '../compendium';
import { installPineCompendium } from './compendium/install';
import { ShardPlugin,type ShardContext } from '@wildshard/game/plugin/context';
import type { ShardRuntime } from '@wildshard/game/shard/runtime';
import { installAiDebug } from '@wildshard/engine/ai/view/DebugOverlay';
import { macrotask, slicer } from '@wildshard/engine/boot/plan';
import { nextDrawnFrame, presenting } from '@wildshard/engine/core/framePacing';
import { withPreparedScriptMemories } from '@wildshard/engine/script/host';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import * as THREE from 'three';
import { pineRifleFloor } from '../quest/rifleFloor';
import { STARTER_EFFECTS, installStarterEffects } from '@wildshard/sdk/runtime/effects';
import type { Particles } from '@wildshard/game/systems/looks/particles';
import { Bow } from '@wildshard/sdk/runtime/weapons/starterBow';
import { crossbowHeldRows, pineCrossbow, prepareCrossbowHands } from './weapons/crossbow/Crossbow';
import { admitPaintedTextures } from './looks/paintedTextures';
import { Cabins, loadCabinRows } from './world/homestead';
import { updatePineForest } from '../world/treeFactory';
import { lendPineLooks } from './looks/graphLooks';
import { dressPineWater } from '../world/water';
import { runtimeLookMaterials } from '@wildshard/game/shardfile/runtimeProduct';
import { loadUnderShapes } from './world/undergrowthKit';
import { loadUnderPlacements } from './world/timberSites';
import { pineModels } from './world/context';
import { Undergrowth } from '../world/undergrowth';
import { placePineProps } from './world/props';
import { PineStreams } from './world/streams';
import { installPineLandmarks, type PineLandmarks } from './world/landmarks';
import { placeCabins } from './world/cabins';
import { placeDrawnModels } from './world/drawnModels';
import { placePineHollowSets } from '../world/places';
import { installPineLoadout } from '../loadout/loadout';
import { installPineCombat } from '../combat/install';
import { pinePickupStream } from '../combat/eliteStreams';
import { installPineQuest } from '../quest/index';
import { installAmbientLife } from './life/ambientLife';
import { SkinKnife } from './models/skinningKnife';
import { pineMemoryTrim } from './debug/options';
import { loadBirdModels } from './birds';
import { WildlifeMesh,preloadPineWildlife,lendPineWildlifeLook } from './models/wildlife';
import { WILDLIFE_LOOK, FINISH_CARDS } from './const';
import * as v from 'valibot';
import { installPineAudio } from './audio/wiring';
import { ForestAmbience } from './audio/ambience';
import { isPhShot } from './audio/sfx';
import { installWeather, loadPineRain } from '../world/weather';
import { leverHeldRows, leverRifle, preloadLeverModel } from './weapons/LeverRifle';
import { HeldFirearm } from '@wildshard/game/plugin/heldFirearm';
import { HeldLauncher } from '@wildshard/game/plugin/heldLauncher';
import { LONGBOW as LONGBOW_PROFILE } from '../weapons/longbowProfile';
import { CROSSBOW, LEVER, LONGBOW } from '../weapons/equipment';
import { AMMO_ROWS, pineFinishEffect } from '../loadout/effects';
import { pineSkins, pineSkinRows, loadPineFinishes, type SkinId } from './loadout/skins';
import { bindLoadoutDeath } from '../loadout/events';
import { mottLine } from '../quest/trades';
import { isPineItem } from '../items';
import { KING_KIND, registerKing, thrallVariant } from './antlerKing';

/** A weapon's declared profile from the built `combat/items` section (data/items.ts attaches it at build). */
function declaredProfile(ctx: ShardContext, id: string): unknown {
  const row = ctx.product.section('combat/items').items.rows.find(item => item.id === id);
  if (row?.kind !== 'weapon' || row.profile === undefined) throw new Error(`Pine Hollow: combat/items declares no profile for ${id}`);
  return row.profile;
}

/** The client Wasm modules the play hook prepares before install: the four elites' brains, the night and the watch
 *  directors (named blobs of the product, hash-checked by the reader). */
const PREPARED_MODULES = ['behaviour/ironhide.wasm', 'behaviour/ghostStag.wasm', 'behaviour/blackpaw.wasm', 'behaviour/imperialBull.wasm',
  'behaviour/night.wasm', 'behaviour/director.wasm'] as const;

function runtime(ctx: ShardContext): ShardRuntime {
  const rt = ctx.game.runtime;
  if (rt?.world === undefined || rt.world === null) throw new Error('Pine plugin needs its world host');
  return rt;
}

/** Pine's authored world and gameplay; the shell supplies engine services at each hook. */
export class PineHollow extends ShardPlugin {
  private cabins: Cabins | null = null;
  private landmarks: PineLandmarks | null = null;
  private particles: Particles | null = null;

  override async world(ctx: ShardContext): Promise<void> {
    ctx.strings(STRINGS);
    admitPaintedTextures(ctx.product);
    await loadPineFinishes(ctx.product);
    const rt = runtime(ctx), world = rt.world, step = rt.step;
    if (world === null || step === null) throw new Error('Pine world builder needs staged services');
    const { game, sky, forest, player, registry } = world;
    rt.menu = { skins: () => rt.play ? rt.play.skins.cardRows(FINISH_CARDS) : [], onWearSkin: (id) => { rt.hooks.wearFinish?.(id); }, skinsTitle: 'Finishes', pack: { note: "Everything here trades at Mott's stall", hint: "Trade at Mott's stall", gearHint: 'Tap a weapon to hold it · a finish to wear it', line: (id) => isPineItem(id) ? mottLine(id) : null } };
    const [{ Grass }, { cutTerrain }, { setSight }] = await Promise.all([import('@wildshard/engine/world/Grass'), import('@wildshard/engine/physics/terrain'), import('@wildshard/engine/world/interact/Interactables')]);
    const { Particles: ParticleField } = await import('@wildshard/game/systems/looks/particles');
    const { trample, TRAMPLE_GLSL } = await import('@wildshard/game/systems/looks/trample');
    ctx.app.registerTrample(trample, ctx.scope);
    // The admitted graph list is author data; this scope still owns the compiled materials.
    const graphNames = v.parse(v.pipe(v.array(v.pipe(v.string(), v.maxLength(128))), v.maxLength(128)),
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('look/runtime-graphs.json'))));
    lendPineLooks(await runtimeLookMaterials(ctx, ctx.product.shardfile, true, graphNames));
    await dressPineWater(game);
    // the small wildlife's posed look (data/wildlifeLook.ts), before the forest's draw and any Model Explorer specimen
    lendPineWildlifeLook(await runtimeLookMaterials(ctx, ctx.product.shardfile, true, [WILDLIFE_LOOK]));
    const streams = await new PineStreams(sky).build();
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
      const content = game.scene, cabins = new Cabins(sky, content, await loadCabinRows());
      const built = await cabins.build();
      content.add(built.group);
      rt.interactables.push(...built.interactables);
      await placeCabins({ cabins, sky, registry, scope: ctx.scope });
      const at = new THREE.Vector3();
      for (const door of cabins.doorPieces()) {
        let on = true;
        registry.add({ id: door.id, name: 'Cabin door', category: 'buildings', file: 'src/shards/pine-hollow/world/homestead.ts', surface: 'wood', follows: door.pivot, colliders: door.colliders,
          active: () => {
            if (door.swinging()) on = false;
            else if (!on) on = door.pivot.getWorldPosition(at).distanceToSquared(player.position) > 1.4 * 1.4;
            return on;
          } });
      }
      const landmarks = await installPineLandmarks({ sky, registry, cabins, onUpdate: retainsRuntimeServices(ctx)
        ? fn => { installEnteredRuntimeUpdate(ctx, { id: 'pine.landmarks', phase: 'update', run: fn }); } : fn => { game.onUpdate(fn, 'pine.landmarks'); } });
      const cave = landmarks.crags?.cave;
      if (cave) { cutTerrain(world.physics, cave.terrainCuts()); await world.terrain.punchSliced(cave.holeTest(), slicer(30).due); }
      for (const item of cabins.interactables) setSight(item, { slack: 0.75 });
      this.cabins = cabins; this.landmarks = landmarks;
    });
    const props = await step('props', () => placePineProps(sky, forest, game, registry, macrotask));
    await placeDrawnModels({ sky, renderer: game.renderer, forest, under: carpet.under, registry }, slicer(30).due);
    Object.assign(rt.objects, { cabins: this.cabins, props, streams, ...carpet });
    rt.hooks.worldUpdate = (dt, t) => {
      updatePineForest(forest.factory, rt.viewer());
      carpet.grass.update(dt, rt.viewer());
      carpet.under.update(dt, rt.viewer());
      carpet.particles.update(dt, rt.viewer(), game.camera);
      this.cabins?.update(dt, t);
    };
  }

  override async kit(ctx: ShardContext): Promise<void> {
    const audio = ctx.app.audio;
    if (audio === null) throw new Error('Pine synth bed needs its mixer');
    installEnteredPineVoices(ctx, audio);
    registerKing();
    ctx.rows.species([...PINE_SPECIES, pineDeer(), pineElk()]);
    ctx.rows.speciesLook(pineLooks());
    ctx.rows.spawnTable(PINE_SPAWNS);
    const inventory = ctx.product.section('custom/questInventory', SECTIONS);
    ctx.rows.item(inventory.items);
    ctx.rows.feat(inventory.feats);
    ctx.rows.compendium({ ...PINE_HOLLOW_COMPENDIUM, id: PINE_HOLLOW_COMPENDIUM.chunkId });
    const rt = runtime(ctx), world = rt.world;
    if (world === null) throw new Error('Pine equipment needs a world');
    await Promise.all([preloadHeldGeometry(ctx.product), preloadKingKit()]);
    await preloadLeverModel(ctx.product);
    const crossbowHeld = crossbowHeldRows(ctx.product), leverHeld = leverHeldRows(ctx.product);
    rt.buildEquipment = runtimeEquipment([
      { slot: 'primary', prepare: prepareCrossbowHands, create: (targets, nolock) => pineCrossbow(world, targets, { row: CROSSBOW, allowUnlocked: nolock, held: crossbowHeld }) },
      { slot: 'rifle', create: (targets, nolock) => leverRifle(world, targets, { row: LEVER, allowUnlocked: nolock, held: leverHeld }) },
      { slot: 'secondary', create: (targets, nolock) => new Bow(world, targets, { row: LONGBOW, profile: LONGBOW_PROFILE, allowUnlocked: nolock }) },
    ], { pause: macrotask, slice: () => slicer(30).due, bind: weapons => {
      if (weapons.rifle === null || weapons.secondary === null) throw new Error('Pine requires all three ranged owners');
      bindRuntimeEquipment(ctx, ctx.product.shardfile, [
        { id: 'weapon.crossbow', weapon: weapons.primary, profile: declaredProfile(ctx, 'weapon.crossbow'), presentation: true },
        { id: 'weapon.lever', weapon: weapons.rifle, profile: declaredProfile(ctx, 'weapon.lever'), presentation: true },
        { id: 'weapon.longbow', weapon: weapons.secondary, profile: declaredProfile(ctx, 'weapon.longbow') },
      ]);
    } });
    ctx.rows.encounter({ id: KING_KIND, displayName: 'The Antler King', showHeadBar: false });
    ctx.rows.weapon([CROSSBOW, LEVER, LONGBOW]);
    ctx.rows.ammo(AMMO_ROWS);
    ctx.rows.effect([...FINISH_CARDS.map(({ id }) => pineFinishEffect(id, pineSkins()[id].weapon)), ...STARTER_EFFECTS]);
    ctx.rows.skin(pineSkinRows());
  }

  override async play(ctx: ShardContext): Promise<void> {
    if (!retainsRuntimeServices(ctx)) return this.installPlay(ctx);
    const modules = await Promise.all(PREPARED_MODULES.map(name => ctx.product.file(name)));
    await withPreparedScriptMemories(modules, ctx.scope, () => presenting() ? nextDrawnFrame(ctx.scope) : macrotask(), () => this.installPlay(ctx));
  }

  private async installPlay(ctx: ShardContext): Promise<void> {
    const [{ WeaponPickup }, { applySkin, clearSkin }] = await Promise.all([import('@wildshard/engine/player/WeaponPickup'), import('@wildshard/engine/player/Skins')]);
    const rt = runtime(ctx), world = rt.world, h = rt.play;
    if (world === null || h === null) throw new Error('Pine gameplay needs its player host');
    const { game, sky, player, forest, registry, params } = world;
    const { animals, weapons, inventory, owned, hud, audio, music, skins, wearSkin, menu, progress, fullMap, touchUi, nolock } = h;
    installEnteredPineScore(ctx, audio, music, ctx.debugRow);
    const { cabins, landmarks, particles } = this;
    const rifle = h.rifle, longbow = h.secondary, crossbow = h.primary;
    if (!(rifle instanceof HeldFirearm) || !(longbow instanceof Bow) || !(crossbow instanceof HeldLauncher)) throw new Error('Pine ranged kit was not built');
    installAiDebug(ctx, { game, actors: () => animals.animals, player }, undefined,
      retainsRuntimeServices(ctx) ? (install) => { installEnteredRuntimeService(ctx, install); } : undefined);
    rt.hooks.wearFinish = (id) => {
      if (!Object.hasOwn(pineSkins(), id)) return;
      const pick = skins.pick(id); if (!pick) return;
      if (pick.act === 'wear') { wearSkin(pick.skin); return; }
      clearSkin(pick.skin.weapon === 'rifle' ? rifle.model : crossbow.model);
      ctx.app.effects?.sync(weapons.get(pick.skin.weapon), []); skins.wear(pick.skin.weapon, null);
    };
    const skinDrops = new ClaimedPickupRoster<SkinId>(ctx.product.section('custom/skinPickups', SECTIONS), {
      scene: game.scene, has: id => skins.has(id), random: () => ctx.app.rng.stream('loot').next(), visualRandom: pinePickupStream('skin-drops'),
      model: id => { const skin = pineSkins()[id], item = skin.weapon === 'rifle' ? rifle.displayModel() : crossbow.displayModel(); applySkin(item, skin, sky); return item; },
      enter: (_id, drop) => { rt.interactables.push(drop.interactable); },
      take: id => { const skin = pineSkins()[id], label = skin.weapon === 'rifle' ? 'lever-action' : 'crossbow'; skins.own(skin.id); wearSkin(skin); if (skin.weapon === 'rifle') { weapons.unlock('rifle'); weapons.select('rifle'); } audio.hitMarker(); hud.toast(`${skin.name} ${label} — ${skin.blurb}`); },
    });
    ctx.on('actor.died', ({ actor }) => {
      const animal = animals.animals.find((a) => a.combatActor() === actor);
      if (animal === undefined) return;
      const skin = Object.values(pineSkins()).find((row) => row.dropsFrom?.kind === animal.kind && row.dropsFrom.variant === animal.variant);
      if (!skin || skins.has(skin.id) || rt.hooks.isElite?.(animal) === true) return;
      const at = animal.position;
      skinDrops.spawn(skin.id, new THREE.Vector3(at.x, Math.max(at.y, heightAt(at.x, at.z)), at.z), true);
    });
    const loadout = installPineLoadout({ scene: game.scene, sky, weapons, crossbow, rifle, longbow, inventory, owned, hud, audio, params, scope: ctx.scope, cues: h.cues, context: ctx });
    const rifleDrop = (() => {
      const position = pineRifleFloor(cabins);
      if (position === null) return null;
      const drop = new WeaponPickup({ scene: game.scene, item: rifle.displayModel(), position, tier: 'common', prompt: 'Take the lever-action', scale: 1.3, random: pinePickupStream('cabin-rifle') });
      rt.interactables.push(drop.interactable);
      drop.onNear = (inside) => audio.pickupHum(inside);
      drop.onPickup = () => { weapons.unlock('rifle'); weapons.select('rifle'); audio.hitMarker(); music.sting('pickup'); hud.toast('Lever-action rifle acquired · 1/2 to switch, Q to swap, R feeds the tube'); };
      return drop;
    })();
    if (loadout.hasRifle || params.get('weapon') === 'rifle' || params.get('weapon') === 'lever') rifleDrop?.dispose();
    rt.hooks.disposeRifleDrop = () => { rifleDrop?.dispose(); };
    rt.hooks.updatePickups = (dt, t) => { rifleDrop?.update(dt, t, game.renderer, game.camera); skinDrops.update(dt, t, game.renderer, game.camera, player.position); };
    if (retainsRuntimeServices(ctx)) installRetainedPlayerEffects(ctx, { movement: player, position: () => player.position });
    installStarterEffects(ctx, { player, health: ctx.app.player, effects: ctx.app.effects },
      retainsRuntimeServices(ctx) ? (install) => { installEnteredRuntimeService(ctx, install); } : undefined);
    // SF67: the King's and his parked thralls' models, each in its own task before the combat install's prewarm spawns them
    // (the same cached models it would build in one stretch; the factory builds each from its own key's seed)
    const warm = [[KING_KIND, 'warden'], ['elk', thrallVariant('elk')], ['boar', thrallVariant('boar')]] as const;
    for (let i = 0; i < 3; i++) {
      const [kind, variant] = warm[i] ?? warm[0];
      ctx.scope.run(() => animals.factory.model(kind, variant)); await macrotask();
    }
    // SF57: after the play hook's first await the owner is the page's; the boss / elite bars and the Elites service end with
    // this runtime, not with the page (one set per visit used to stay for the page's life)
    const fights = ctx.scope.run(() => installPineCombat({ context: ctx, game, sky, player, animals, weapons, crossbow, rifle, skins, wearSkin, inventory, hud, audio, music, interactables: rt.interactables, params,
      longbow: { displayModel: () => longbow.displayModel(), grant: () => { loadout.grantLongbow(); } }, ironFirst: () => { loadout.onPlayerDeath(); } }));
    ctx.answer('weather.hold', (previous) => ctx.app.render === game ? Math.max(previous, fights.weatherHold()) : previous);
    const compendium = installPineCompendium({ context: ctx, chunkId: ctx.manifest.slug, game, camera: game.camera, hud, menu, animals, cabins, interactables: rt.interactables, weapons, touchUi, nolock });
    const quest = await installPineQuest({ ctx, game, sky, player, animals, hud, audio, music, inventory, progress, skins, wearSkin, weapons,
      crossbow: { addBolts: (n) => { loadout.addAmmo('iron', n); }, addAmmo: (kind, n) => { loadout.addAmmo(kind, n); }, room: (kind, n) => loadout.room(kind, n) },
      menu, interactables: rt.interactables, registry, cabins, landmarks, trees: forest.trees, fullMap, compendium: compendium?.state ?? null, chunkId: ctx.manifest.slug, params, touchUi, nolock });
    placePineHollowSets(registry);
    const ambience = new ForestAmbience(audio, { heightAt, cabins, ...(retainsRuntimeServices(ctx) ? { scope: ctx.scope } : {}) }, requireAudioProfile(runtimeAudio(ctx, ctx.product.shardfile.audio).zones, 'ambience.pine'), ctx.product.shardfile.audio);
    fights.useSfx(ambience.sfx); quest.useSfx(ambience.sfx); loadout.useSfx(ambience.sfx);
    installPineAudio({ context: ctx, game, audio, sky, music, ambience, animals, cabins, eliteEngaged: () => fights.eliteEngaged(), params });
    landmarks?.crags?.cave?.spots().forEach(spot => { ambience.addSpot({ zone: 'cave', ...spot, fade: 3 }); });
    installWeather(ctx, { game, sky, trees: forest.trees, rain: await loadPineRain(), animals, particles, ambience,
      roofAt: (x, z) => cabins?.floorHeightAt(x, z) !== undefined || (landmarks?.crags?.cave?.inside(x, z) ?? false), stagAt: () => quest.stagAt(), viewer: rt.viewer, horizonVeil: rt.horizonVeil });
    await preloadPineWildlife(); // the procedural animals' baked shapes (G285), behind the loading screen
    const lifeRows = ctx.product.section('custom/ambientLife', SECTIONS);
    const wildlife=new WildlifeMesh(sky,lifeRows.scavenger.count+lifeRows.guide.count+lifeRows.forager.count+2);
    const life = installAmbientLife(lifeRows,{view:wildlife,birds:await loadBirdModels(),swapBirds:(set)=>{wildlife.useBirds(set);},knife:()=>new SkinKnife(game,sky,ctx),trimShadows:pineMemoryTrim(), ctx, game, sky, player, animals, weapons, audio, sfx: {shot:(name,options)=>{const family=Object.values(lifeRows.sounds).find(id=>id===name);if(family===undefined||!isPhShot(family))throw new Error(`Undeclared wildlife voice ${name}`);return ambience.sfx.shot(family,options);}}, trees: forest.trees,
      places: compendium ? () => compendium.state.def.entries.flatMap((entry) => entry.place ? [{ id: entry.id, ...entry.place }] : []) : null,
      visited: (id) => compendium?.state.reached(id, 'seen') ?? true, inCombat: () => music.state.mode === 'combat' });
    Object.assign(rt.objects, { pineLife: life, ambience });
    ctx.debug.expose(`harness.shard.${ctx.manifest.slug}`, { cabins, props: rt.objects['props'], streams: rt.objects['streams'], pineLife: life });
    rt.hooks.equipmentUpdate = (dt) => { loadout.update(dt); };
    rt.hooks.audioUpdate = (dt) => { ambience.update(dt, game.camera); };
    rt.hooks.dispose = () => { ambience.dispose(); };
    rt.hooks.checkpoint = () => fights.onPlayerDeath();
    const health = ctx.app.player;
    installEnteredRuntimeService(ctx, (scope) => { bindLoadoutDeath(ctx.app.events, scope, health, { active: () => ctx.app.player === health, reset: () => { loadout.onPlayerDeath(); } }); });
    rt.hooks.eliteEngaged = () => fights.eliteEngaged();
    rt.hooks.isElite = (animal) => fights.isElite(animal);
    rt.hooks.harvestBusy = () => life?.busy ?? false;
    if (life) rt.hooks.harvest = (animal, give, cancel) => { life.harvest(animal, give, cancel); };
    rt.hooks.stepSurface = (at) => ambience.stepSurface(at.x, at.z, at.y);
    rt.hooks.directional = true;
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default PineHollow;
