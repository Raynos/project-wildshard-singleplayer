import type { Targets } from '@wildshard/engine/combat/types';
import type { Weapon } from '@wildshard/engine/combat/Weapon';
import { weaponInputContext } from '@wildshard/engine/input/gameplay';
import { type TrainingArena as Arena, TrainingArena } from '@wildshard/engine/practice/TrainingArena';
import type { DiscSpot } from '@wildshard/engine/ui/hudSlots';
import { EnteredEquipment } from '../grid/enteredEquipment';
import { GAME_STRINGS } from '../strings';
import { titleCards } from '../titleDeck';
import { buildTitleMenu } from '../mainMenu';
import { shardEntry } from '../shard/entryMode';
import { enterGrid, pageMode } from '../grid/boot';
import { travel } from '../travel/travel';
import { shards } from '../shard/list';
import { primaryShardManifest } from '../shard/legacy';
import type { worldStage } from './world';
import { withOwner } from '@wildshard/engine/app/ownership';
import { app } from '@wildshard/engine/app/runtime';
import { macrotask } from '@wildshard/engine/boot/plan';
import { EquipmentService } from '@wildshard/engine/combat/EquipmentService';
import { authoredTargets } from '@wildshard/engine/combat/targets';
import { viewmodelTexturesReady } from '@wildshard/engine/combat/view/ranged';
import { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { listShardModels } from '@wildshard/engine/models/roster';
import { LockOnSystem } from '@wildshard/engine/player/LockOnTarget';
import { TouchControls } from '@wildshard/engine/player/TouchControls';
import { HUD } from '@wildshard/engine/ui/HUD';
import { setting } from '@wildshard/engine/ui/Settings';
import { hudAdapters } from '@wildshard/engine/ui/hudAdapters';
import { bindClockSettings } from './clockSettings';

async function buildLoadout(ctx: Awaited<ReturnType<typeof worldStage>>) {
  const { kit, stage, boot, step, fieldModels, world, game, sky, player, forest, chunk, registry, nolock } = ctx;


  const animals = await step('animals', async (p) => {
    const a = await new AnimalManager(game.rootScene, sky, forest).buildAsync(macrotask); // a task per herd, not one long one
    p.detail(`${a.animals.length} animals`);
    return a;
  });
  boot.runtime.hooks.animalsReady?.(animals);
  await boot.runtime.hooks.animalsBuilt?.(animals);
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
  if (worldClock) bindClockSettings(worldClock, game.levelScope); // pause menu ▸ Settings ▸ Time of day (E55)

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
  const roadEquipment: EquipmentService = new EquipmentService(crossbow, { scope: game.levelScope, events: app.events,
    ...(ctx.session.ownedGridHome === true ? {} : { input: {
      bind: (action, run, scope, allowed) => { app.input.bind(action, run, scope, allowed ?? (() => roadEquipment.current.enabled)); },
    } } satisfies NonNullable<ConstructorParameters<typeof EquipmentService>[1]>),
    ...(authoredKit.order === undefined ? {} : { order: [...authoredKit.order] }) });
  const enteredEquipment = ctx.session.ownedGridHome === true ? new EnteredEquipment(roadEquipment) : undefined;
  const weapons = enteredEquipment?.service ?? roadEquipment;
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
  // the title deck (E318): this level's card enters or explores here, another's opens in a fresh page (travel)
  const booted = shardEntry(chunk); // SF65: the way this page entered the shard (LEGACY / SHARDFILE)
  hud.titleDeck = (here) => {
    const primary = primaryShardManifest(shards(), chunk);
    const cards = titleCards(), own = cards[cards.map((card): string => card.slug).indexOf(primary.slug)];
    return buildTitleMenu({
      cards, active: primary.slug,
      // SF65: this card in the mode this page booted with enters here; the other mode (or another card) is a fresh page
      onEnter: (c, entry) => { if (c === own && entry === booted) here.enter(); else travel({ to: c.slug, mode: 'enter' }); },
      onExplore: (c) => { if (c !== own) { travel({ to: c.slug, mode: 'explore' }); return; } here.explore(); },
      onGrid: () => { if (pageMode() === 'grid') here.enter(); else enterGrid(); }, // SF21a: the main menu's second entry
      onSettings: here.settings,
    });
  };
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
  return { ...ctx, animals, arena, swimArms, crossbow, rifle, longbow, weapons, enteredEquipment, lockSys, touchControls, hud };
}

export const loadoutStage: typeof buildLoadout = buildLoadout;
