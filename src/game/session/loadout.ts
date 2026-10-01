import { weaponInputContext, type TrainingArena as Arena, type Weapon, type DiscSpot, type Targets } from '#engine';
import { GAME_STRINGS } from '../strings';
import type { worldStage } from './world';

async function buildLoadout(ctx: Awaited<ReturnType<typeof worldStage>>) {
  const { engine, kit, stage, boot, step, fieldModels, world, game, sky, player, forest, chunk, registry, nolock } = ctx;
  const { hudAdapters, app, EquipmentService, viewmodelTexturesReady, authoredTargets, onSettingChange, setting, AnimalManager, TouchControls, HUD, LockOnSystem, macrotask, listShardModels, TrainingArena, withOwner } = engine;


  const animals = await step('animals', async (p) => {
    const a = await new AnimalManager(game.scene, sky, forest).buildAsync(macrotask); // a task per herd, not one long one
    p.detail(`${a.animals.length} animals`);
    return a;
  });
  boot.runtime.hooks.animalsReady?.(animals);
  // the shard's models, for Explore World's catalog and tap-to-select (src/engine/explore/registry.ts: a shard registers what it built);
  // Driftwood's are on the model contract (E315 M1: `place` registers them)
  // the core fields' copies drawn as the shard's models (ShardManifest.fieldModels, E349: Pine Hollow's trees and forest-floor kinds, E315 M2)
  if (fieldModels) await stage('fieldModels', async () => { (await fieldModels)({ sky, renderer: game.renderer, forest, under: null, registry }); });
  const roster = await stage('roster', () => chunk.roster?.());
  await stage('roster', () => listShardModels({ roster: roster === undefined ? undefined : () => Promise.resolve(roster), style: game.level.creatureStyle ?? 'pbr', sky, renderer: game.renderer, animals: () => animals.animals, registry })); // every shard's live models in its Model Explorer (E315 M5): the shared training dummy, its creatures (its species list, alive now or not), people and gear
  const dayNight = sky.dayNight; // the backdrop's shared clock drives night activity
  if (dayNight) animals.enemyWorld.night = () => dayNight.night;
  // The resident clock drives Settings, Explore light presets and the HUD day badge.
  const worldClock = dayNight ?? app.dayCycle;
  app.registerDayCycle(worldClock, game.levelScope);
  if (worldClock) onSettingChange('time', (t) => { worldClock.setTime(t); }); // pause menu ▸ Settings ▸ Time of day (E55)

  // ── player kit: the shard's weapon + the rifle slot where the shard has one (EquipmentService.ts: 1…N / Q, the touch SWAP ring), HUD, audio ──
  const shardSword = (await step('weapon', () => Promise.all([viewmodelTexturesReady(), chunk.sword?.() ?? null])))[1]; // the viewmodels' textures from the worker + the lever-action's model (usually long done) + the shard's own sword (ShardManifest.sword); the build below is synchronous
  let arena: Arena | null = null;
  const targets: Targets = authoredTargets(app.events, { raycast: (origin, dir, maxDist) => animals.raycast(origin, dir, maxDist) }, () => arena?.entered === true ? arena : null);
  const swimArms = shardSword?.swim;
  const authoredKit = await boot.runtime.buildEquipment?.(targets, nolock, shardSword);
  if (authoredKit === undefined) throw new Error('Shard has no primary equipment factory');
  const crossbow: Weapon = authoredKit.primary;
  await macrotask(); // each viewmodel in its own task
  // the rifle slot: Pine Hollow's lever-action (PH-U5, LeverRifle.ts — the crossbow's walnut, shared), the AR-15 on Nalati
  // (the practice room's loan); none on the sword shards, Driftwood and Nine Dragon (E333, Jake: "why is there an AR-15 in Driftwood?")
  const rifle = authoredKit.rifle ?? null;
  await macrotask();
  const longbow = authoredKit.secondary ?? null;
  const weapons = new EquipmentService(crossbow, { scope: game.levelScope, events: app.events, ...(authoredKit.order === undefined ? {} : { order: [...authoredKit.order] }) });
  for (const w of [...(rifle ? [rifle] : []), ...(authoredKit.extras ?? []), ...(longbow ? [longbow] : [])]) weapons.add(w, { locked: true });
  weaponInputContext(weapons, game.levelScope);
  for (const id of game.level.loadout.tools) {
    const row = kit.tools.find((tool) => tool.id === id);
    if (row !== undefined) weapons.add(row.create(game.camera, player), { locked: !game.level.loadout.start.includes(id) });
  }
  app.registerEquipment(weapons, game.levelScope);
  const lockSys = new LockOnSystem(player, weapons, game.camera); // the Zelda lock-on (E50): LOCK / Z, orbit, flick-switch — src/engine/player/LockOnTarget.ts
  const touchControls = new TouchControls(player, weapons, setting('touch') === 'on', lockSys); // on-screen FPS controls on coarse-pointer devices (?touch=1 / main menu ▸ Settings ▸ Touch controls forces)
  authoredKit.install?.(weapons);
  await macrotask();
  const hud = withOwner(game.engineScope, () => new HUD({ pointerLock: !nolock, weaponUi: weapons.current.row.ui, maxBolts: weapons.state.magazine, ...(chunk.status === 'hidden' ? { developerBanner: GAME_STRINGS.developer.banner(chunk.slug.replace(/^_/, '')) } : {}) }));
  const shellHud = new Set(document.querySelectorAll('#hud *'));
  game.hudBaseline = shellHud.size;
  game.hudRetained = shellHud;
  arena = new TrainingArena(game, registry, world.physics, { x: chunk.spawn.x, z: chunk.spawn.z });
  // E307: the open feature playground (src/playgrounds/: Nine Dragon's grapple course, Nalati's horse track), entered from the
  // Explore hub like the arena. `away()`: the player is in a practice room, not the shard (no bounds, no map, no last place)

  lockSys.inputService = app.input;
  app.addSystem({ id: 'engine.lockon.input', phase: 'input', after: ['engine.input.collect'], before: ['engine.player.input'], run: () => {
    if (app.input.consume('lock')) lockSys.resolveToggle();
  } }, game.levelScope);
  app.registerEquipmentHost({ game, player, viewmodel: game.viewmodel, physics: world.physics, arms: shardSword?.arms ?? null, lock: lockSys,
    toast: (message) => hud.toast(message), enabled: () => hud.entered && !world.freeCamera && !world.tour.active }, game.levelScope);
  const hudRoot = document.getElementById('hud');
  if (hudRoot === null) throw new Error('HUD root is missing');
  app.levelAdapters.hud = hudAdapters(game, game.levelScope, hudRoot, (spot, hint) => touchControls.relabel(spot, hint));
  const contextLabels = new Map<DiscSpot, () => void>();
  app.input.touchSink((labels) => {
    for (const dispose of contextLabels.values()) dispose(); contextLabels.clear();
    for (const [spot, hint] of Object.entries(labels)) {
      contextLabels.set(spot as DiscSpot,
        app.levelAdapters.hud?.relabel(spot as DiscSpot, hint.label, hint.icon ?? '', hint) ?? (() => undefined));
    }
  }, game.levelScope);
  return { ...ctx, animals, arena, swimArms, crossbow, rifle, longbow, weapons, lockSys, touchControls, hud };
}

export const loadoutStage: typeof buildLoadout = buildLoadout;
