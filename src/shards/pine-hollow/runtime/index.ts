import { installEnteredRuntimeService, installRetainedPlayerEffects, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import { installEnteredPineScore } from './audio/score';
import { bindPineItems } from './items';
import { installPineLandmarkUpdate } from './landmarkLifetime';
import { STRINGS } from '../strings';
import { installEnteredPineVoices } from './audio/entered';
import { installPineDebug } from '../debug/options';
import { PINE_SPAWNS } from '../combat/spawns';
import { PINE_SPECIES, pineElk } from '../species/rows';
import { pineLooks } from '../species/looks';
import { pineCoatSources } from '../species/hulls';
import { PINE_FEATS } from '../feats';
import { PINE_HOLLOW_COMPENDIUM } from '../compendium';
import { installPineCompendium } from '../compendium/install';
import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import type { ShardRuntime } from '@wildshard/game/shard/runtime';
import { installAiDebug } from '@wildshard/engine/ai/view/DebugOverlay';
import { macrotask } from '@wildshard/engine/boot/plan';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import * as THREE from 'three';
import { CABIN_SITES } from '../layout';
import { installStarterEffects } from '@wildshard/kit/effects/install';
import { STARTER_EFFECTS } from '@wildshard/kit/effects/starter';
import { loadParticles, loadGrassField } from '@wildshard/kit/lookApi';
import type { Particles } from '@wildshard/game/systems/looks/particles';
import { Bow } from '@wildshard/sdk/runtime/weapons/starterBow';
import { Crossbow } from './weapons/crossbow/Crossbow';
import { crossbowDisplayModel } from '../weapons/crossbow/display';
import { Cabins } from '../world/homestead';
import { Undergrowth } from '../world/undergrowth';
import { Props } from '../world/props';
import { PineStreams } from '../world/streams';
import { installPineLandmarks, pineHamletBuildings, type PineLandmarks } from '../world/landmarks';
import { placeCabins } from '../world/cabins';
import { placeDrawnModels } from '../world/drawnModels';
import { placePineHollowSets } from '../world/places';
import { installPineLoadout } from '../loadout/loadout';
import { installPineCombat } from '../combat/install';
import { installPineQuest } from '../quest/index';
import { installPineLife } from '../life/index';
import { installPineAudio } from './audio/wiring';
import { ForestAmbience } from './audio/ambience';
import { installWeather } from '../world/weather';
import { LeverRifle, preloadLeverModel } from './weapons/LeverRifle';
import { LONGBOW as LONGBOW_PROFILE } from '../weapons/longbowProfile';
import { CROSSBOW, LEVER, LONGBOW } from '../weapons/equipment';
import { AMMO_ROWS } from '../loadout/effects';
import { PINE_FINISH_EFFECTS, pineFinishes, finishPick } from '../loadout/finishes';
import { SKINS, PINE_FINISHES } from '../loadout/skins';
import { bindLoadoutDeath } from '../loadout/events';
import { mottLine } from '../quest/trades';
import { isPineItem, PINE_ITEMS } from '../items';
import { KING_KIND, registerKing } from './antlerKing';

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
    installPineDebug(ctx);
    const rt = runtime(ctx), world = rt.world, step = rt.step;
    if (world === null || step === null) throw new Error('Pine world builder needs staged services');
    const { game, sky, forest, player, registry } = world;
    rt.menu = { skins: () => rt.play ? pineFinishes(rt.play.skins) : [], onWearSkin: (id) => { rt.hooks.wearFinish?.(id); }, skinsTitle: 'Finishes', pack: { note: "Everything here trades at Mott's stall", hint: "Trade at Mott's stall", gearHint: 'Tap a weapon to hold it · a finish to wear it', line: (id) => isPineItem(id) ? mottLine(id) : null } };
    const [{ Grass }, { cutTerrain }, { setSight }] = await Promise.all([import('@wildshard/engine/world/Grass'), import('@wildshard/engine/physics/terrain'), import('@wildshard/engine/world/interact/Interactables')]);
    const { Particles: ParticleField } = await loadParticles();
    const { trample, TRAMPLE_GLSL } = await loadGrassField();
    ctx.app.registerTrample(trample, ctx.scope);
    const streams = new PineStreams(sky).build();
    game.scene.add(streams.group);
    const carpet = await step('grass', async () => {
      const grass = new Grass(sky, forest, { trample: { field: trample, glsl: TRAMPLE_GLSL } }).build();
      await macrotask();
      const under = await new Undergrowth(sky, forest).buildAsync(macrotask);
      const particles = new ParticleField(sky, forest).build();
      game.scene.add(grass.group, under.group, particles.group);
      return { grass, under, particles };
    });
    this.particles = carpet.particles;
    rt.overhead.push(carpet.grass.group, carpet.under.group, carpet.particles.group);
    await step('cabins', async () => {
      const cabins = new Cabins(sky, pineHamletBuildings());
      const built = await cabins.build();
      game.scene.add(built.group);
      rt.interactables.push(...built.interactables);
      await placeCabins({ cabins, sky, registry });
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
      const landmarks = await installPineLandmarks({ sky, registry, cabins, onUpdate: (fn) => { installPineLandmarkUpdate(ctx, game, fn); }, trees: forest.trees });
      if (landmarks.crags) { cutTerrain(world.physics, landmarks.crags.terrainCuts()); world.terrain.punch(landmarks.crags.holeTest()); }
      for (const item of cabins.interactables) setSight(item, { slack: 0.75 });
      this.cabins = cabins; this.landmarks = landmarks;
    });
    const props = await step('props', async () => {
      const placed = new Props(sky, forest, game.renderer);
      await placed.build(registry, macrotask);
      return placed;
    });
    placeDrawnModels({ sky, renderer: game.renderer, forest, under: carpet.under, registry });
    Object.assign(rt.objects, { cabins: this.cabins, props, streams, ...carpet });
    rt.hooks.worldUpdate = (dt, t) => {
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
    ctx.rows.species([...PINE_SPECIES, pineElk()]);
    ctx.rows.speciesLook(pineLooks());
    ctx.rows.spawnTable(PINE_SPAWNS);
    ctx.rows.item(PINE_ITEMS);
    ctx.rows.feat(PINE_FEATS);
    ctx.rows.compendium({ ...PINE_HOLLOW_COMPENDIUM, id: PINE_HOLLOW_COMPENDIUM.chunkId });
    const rt = runtime(ctx), world = rt.world;
    if (world === null) throw new Error('Pine equipment needs a world');
    await preloadLeverModel();
    rt.buildEquipment = async (targets, nolock) => {
      const primary = new Crossbow(world, targets, { row: CROSSBOW, allowUnlocked: nolock });
      await macrotask();
      const rifle = new LeverRifle(world, targets, { row: LEVER, allowUnlocked: nolock, woodFrom: primary.model });
      await macrotask();
      const secondary = new Bow(world, targets, { row: LONGBOW, profile: LONGBOW_PROFILE, allowUnlocked: nolock });
      const weapons = { primary, rifle, secondary };
      bindPineItems(ctx, weapons);
      return weapons;
    };
    ctx.rows.encounter({ id: KING_KIND, displayName: 'The Antler King', showHeadBar: false });
    ctx.rows.weapon([CROSSBOW, LEVER, LONGBOW]);
    ctx.rows.ammo(AMMO_ROWS);
    ctx.rows.effect([...PINE_FINISH_EFFECTS, ...STARTER_EFFECTS]);
    ctx.rows.skin(PINE_FINISHES);
  }

  override async play(ctx: ShardContext): Promise<void> {
    const [{ WeaponPickup }, { applySkin, clearSkin }] = await Promise.all([import('@wildshard/engine/player/WeaponPickup'), import('@wildshard/engine/player/Skins')]);
    const rt = runtime(ctx), world = rt.world, h = rt.play;
    if (world === null || h === null) throw new Error('Pine gameplay needs its player host');
    const { game, sky, player, forest, registry, params } = world;
    const { animals, weapons, inventory, owned, hud, audio, music, skins, wearSkin, menu, progress, fullMap, touchUi, nolock } = h;
    installEnteredPineScore(ctx, audio, music, ctx.debugRow);
    const { cabins, landmarks, particles } = this;
    const rifle = h.rifle, longbow = h.secondary, crossbow = h.primary;
    if (!(rifle instanceof LeverRifle) || !(longbow instanceof Bow) || !(crossbow instanceof Crossbow)) throw new Error('Pine ranged kit was not built');
    installAiDebug(ctx, { game, actors: () => animals.animals, player }, undefined,
      retainsRuntimeServices(ctx) ? (install) => { installEnteredRuntimeService(ctx, install); } : undefined);
    rt.hooks.wearFinish = (id) => {
      const pick = finishPick(skins, id); if (!pick) return;
      if (pick.act === 'wear') { wearSkin(pick.skin); return; }
      clearSkin(pick.skin.weapon === 'rifle' ? rifle.model : crossbow.model);
      ctx.app.effects?.sync(weapons.get(pick.skin.weapon), []); skins.wear(pick.skin.weapon, null);
    };
    const skinDrops: InstanceType<typeof WeaponPickup>[] = [];
    ctx.on('actor.died', ({ actor }) => {
      const animal = animals.animals.find((a) => a.combatActor() === actor);
      if (animal === undefined) return;
      const skin = Object.values(SKINS).find((row) => row.dropsFrom?.kind === animal.kind && row.dropsFrom.variant === animal.variant);
      if (!skin || skins.has(skin.id) || rt.hooks.isElite?.(animal) === true) return;
      const item = skin.weapon === 'rifle' ? rifle.displayModel() : crossbowDisplayModel(crossbow, sky);
      applySkin(item, skin, sky);
      const label = skin.weapon === 'rifle' ? 'lever-action' : 'crossbow';
      const toss = ctx.app.rng.stream('loot').next() * Math.PI * 2;
      const at = animal.position;
      const drop = new WeaponPickup({ scene: game.scene, item, position: new THREE.Vector3(at.x, Math.max(at.y, heightAt(at.x, at.z)), at.z), tier: 'rare', prompt: `Take the ${skin.name} ${label}`, scale: skin.weapon === 'rifle' ? 1.35 : 1.6, toss: { x: Math.sin(toss) * 1.2, y: 3.5, z: Math.cos(toss) * 1.2 } });
      rt.interactables.push(drop.interactable); skinDrops.push(drop);
      drop.onPickup = () => { skins.own(skin.id); wearSkin(skin); if (skin.weapon === 'rifle') { weapons.unlock('rifle'); weapons.select('rifle'); } audio.hitMarker(); hud.toast(`${skin.name} ${label} — ${skin.blurb}`); skinDrops.splice(skinDrops.indexOf(drop), 1); };
    });
    const loadout = installPineLoadout({ scene: game.scene, sky, weapons, crossbow, rifle, longbow, inventory, owned, hud, audio, params, scope: ctx.scope, cues: h.cues, context: ctx });
    const rifleDrop = (() => {
      const site = CABIN_SITES[0];
      if (site === undefined || cabins === null) return null;
      const lx = 1.5, lz = -1.6, c = Math.cos(site.rot), sn = Math.sin(site.rot);
      const x = site.x + lx * c + lz * sn, z = site.z - lx * sn + lz * c;
      const drop = new WeaponPickup({ scene: game.scene, item: rifle.displayModel(), position: new THREE.Vector3(x, cabins.floorHeightAt(x, z) ?? heightAt(x, z), z), tier: 'common', prompt: 'Take the lever-action', scale: 1.3 });
      rt.interactables.push(drop.interactable);
      drop.onNear = (inside) => audio.pickupHum(inside);
      drop.onPickup = () => { weapons.unlock('rifle'); weapons.select('rifle'); audio.hitMarker(); music.sting('pickup'); hud.toast('Lever-action rifle acquired · 1/2 to switch, Q to swap, R feeds the tube'); };
      return drop;
    })();
    if (loadout.hasRifle || params.get('weapon') === 'rifle' || params.get('weapon') === 'lever') rifleDrop?.dispose();
    rt.hooks.disposeRifleDrop = () => { rifleDrop?.dispose(); };
    rt.hooks.updatePickups = (dt, t) => { rifleDrop?.update(dt, t, game.renderer, game.camera); for (const drop of skinDrops) drop.update(dt, t, game.renderer, game.camera); };
    if (retainsRuntimeServices(ctx)) installRetainedPlayerEffects(ctx, { movement: player, position: () => player.position });
    installStarterEffects(ctx, { player, health: ctx.app.player, effects: ctx.app.effects },
      retainsRuntimeServices(ctx) ? (install) => { installEnteredRuntimeService(ctx, install); } : undefined);
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
    const ambience = new ForestAmbience(audio, { heightAt, cabins, ...(retainsRuntimeServices(ctx) ? { scope: ctx.scope } : {}) });
    fights.useSfx(ambience.sfx); quest.useSfx(ambience.sfx); loadout.useSfx(ambience.sfx);
    installPineAudio({ context: ctx, game, audio, sky, music, ambience, animals, cabins, eliteEngaged: () => fights.eliteEngaged(), params });
    for (const spot of landmarks?.crags?.caveSpots() ?? []) ambience.addSpot({ zone: 'cave', ...spot, fade: 3 });
    installWeather(ctx, { game, sky, trees: forest.trees, animals, particles, ambience,
      roofAt: (x, z) => cabins?.floorHeightAt(x, z) !== undefined || (landmarks?.crags?.inCave(x, z) ?? false), stagAt: () => quest.stagAt(), viewer: rt.viewer, horizonVeil: rt.horizonVeil });
    const life = installPineLife({ ctx, game, sky, player, animals, weapons, audio, sfx: ambience.sfx, trees: forest.trees, trunks: forest.factory.variants, params,
      places: compendium ? () => compendium.state.def.entries.flatMap((entry) => entry.place ? [{ id: entry.id, ...entry.place }] : []) : null,
      visited: (id) => compendium?.state.reached(id, 'seen') ?? true, inCombat: () => music.state.mode === 'combat' });
    Object.assign(rt.objects, { pineLife: life, ambience });
    ctx.debug.expose(`harness.shard.${ctx.manifest.slug}`, { cabins, props: rt.objects['props'], streams: rt.objects['streams'], pineLife: life, coats: pineCoatSources });   // coats: scripts/bake-coats.mjs (G187 cut 2)
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
