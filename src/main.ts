import { registerLevelDebugRow } from '#engine/ui/debugOptions';
import { hudAdapters } from '#engine/ui/hudAdapters';
import { equipmentEntry, toolEntries } from '#game/bag/equipment';
import { sharedWeaponVoices, SWORD_WOOD, type MeleeProfile, installKitSpecies, KIT_ITEMS } from '#kit';
import { reportError } from '#engine/core/errorReport';
import { showLoadFailure } from '#engine/ui/errorScreen';
import { app, EffectService, CombatCues, pageSeed, LevelLoadError, installBounds, EquipmentService, type WeaponId, type Weapon, type LevelContext, type DiscSpot, CHUNK_HALF, startViewmodelTextures, viewmodelTexturesReady, loadWorldContent, authoredTargets, type Targets, getNumber, onNumber, onSettingChange, setting, floorBelow, lineOfSight } from '#engine';

import { isOwnedId, shardContext, toLevelSpec, consumeTravelHandoff, bindTravelInventory, applyTravelCarry, setShardSwitcher, type TravelHandoff, type ItemRow, type ShardContext, type GameServices, type ShardRuntime } from '#game';
import { levelSequenceDriver, type LevelSequence } from '#game/shard/sequence';
import { meleeShard, type ShardManifest } from '#game/shard/manifest';
import { installProbe } from '#engine/debug/probe';
import { tap } from '#engine/core/harnessTap';
import * as THREE from 'three';
import { bootstrap } from '#engine/core/bootstrap';
import { installGpuRecovery, RELOAD_PARAM } from '#engine/core/GpuRecovery';
import { setPoseProvider } from '#engine/ui/ReloadPrompt';

import { hasPond, heightAt, normalAt, trailDistance, TRAILS } from '#engine/world/Heightfield';
import { Boundary } from '#engine/world/Boundary';
import { SHRINE } from '#shards/driftwood-isle/manifest';
import { driftwoodWorld } from '#shards/driftwood-isle/world/build';
import { Cove } from '#shards/driftwood-isle/world/Cove';
import { Hands } from '#engine/player/Hands';
import { Sword, swordEvents } from '#kit/weapons/melee/SweptMelee';
import { CameraFX } from '#engine/player/CameraFX';
import { Horizon } from '#engine/world/Horizon';
import { HorizonMatte } from '#engine/world/HorizonMatte';
import { AnimalManager } from '#engine/entities/AnimalManager';




import { WeaponStrip } from '#engine/ui/WeaponStrip';
import { hudSlots } from '#engine/ui/hudSlots';
import { SkinLocker, applySkin, type SkinDef } from '#engine/player/Skins';
import { TouchControls } from '#engine/player/TouchControls';
import { HUD } from '#engine/ui/HUD';
import { LockOn } from '#engine/ui/LockOn';
import { LockOnSystem } from '#engine/player/LockOnTarget';
import { SpeedLines } from '#engine/ui/SpeedLines';
import { buzz, HAPTIC } from '#engine/ui/haptics';
import { Loading } from '#engine/ui/Loading';
import { resumeProgress, resumeScreen } from '#engine/ui/Resume';
import { Perf } from '#engine/ui/Perf';
import { Minimap } from '#engine/ui/Minimap';
import { FullMap } from '#engine/ui/Map';
import { BagButton } from '#game/bag/BagButton';
import { GameMenu } from '#engine/ui/Menu';
import { Progress } from '#game/Progress';
import { Inventory, ITEMS } from '#game/Inventory';
import { Owned } from '#game/loot/Owned';
import { practiceRoom } from '#engine/core/practiceRoom';
import { sharedCombatCues } from '#kit/audio/combatCues';
import { driftwoodCombatCues } from '#shards/driftwood-isle/audio/combatCues';
import { installBodyShadow } from '#engine/player/BodyShadow';

import { KeepAlive } from '#engine/core/KeepAlive';
import { Combat, aimReadout } from '#engine/ui/Combat';
import { HurtArc, deathCause, respawnWhere } from '#engine/ui/HurtArc';
import { PlayerHealth } from '#engine/combat/health';
import type { DeathCause } from '#engine/combat/pipeline';
import { PlayerHurt } from '#engine/ui/playerHurt';
import { installPlayerDeath } from '#engine/ui/playerDeath';
import { WindupWarn } from '#engine/ui/WindupWarn';
import { DeathFade } from '#engine/ui/DeathFade';
import { FirstHints } from '#engine/ui/FirstHints';
import { LastPlace, placeName } from '#game/LastPlace';
import { setAimTargets, meleeLock, lockOn as lockState, type AimTarget } from '#engine/player/AimTargets';
import { createBootPlan, macrotask, type StepProgress, type StepRunner } from '#engine/boot/plan';
import { useShardSteps } from '#engine/boot/steps';
import { declareTotals, installByteCounter, releaseByteCounter } from '#engine/boot/bytes';
import { bootFiles, extraFetches, startAudioPreload, startDeferredAudioPreload, startMenuPreload } from '#engine/boot/extras';
import { bootFetches, prefetch, prefetchAfter, whenPrefetched } from '#engine/boot/prefetch';
import { packFor, streamPack } from '#engine/boot/pack';
import { startShardPrefetch } from '#engine/boot/shardPrefetch';
import { getActiveChunk } from '#game/shard/registry';
import { runShardLoad, withShardHooks, ShardLoadError, type LoadStage, prepareShardAssets } from '#game/shard/load';
import { registerGpuFiles, setTexturePolicy } from '#engine/boot/gpuFiles';
import { Audio } from '#engine/audio/Audio';
import { Music } from '#engine/audio/Music';
import { ShrineHum } from '#shards/driftwood-isle/audio/shrineHum';
import { IslandSfx } from '#shards/driftwood-isle/audio/sfx';
import { SurfaceMap } from '#shards/driftwood-isle/audio/surface';
import { IslandAmbience } from '#shards/driftwood-isle/audio/ambience';
import { installErrorModal, showError } from '#engine/ui/ErrorModal';
import { onReview, queuedCount, quickNote } from '#engine/ui/review';
import { rotateGated } from '#engine/ui/RotateGate';
import type { Feedback } from '#engine/ui/Feedback';
import type { Explore, ExploreMode } from '#engine/explore/Explore';
import { listShardModels } from '#engine/models/roster';
import { TrainingArena } from '#engine/practice/TrainingArena';
import { loadPlayground } from '#engine/practice/playground/load';
import type { Playground } from '#engine/practice/playground/Playground';
import { registerPlayground, type PlaygroundId } from '#engine/practice/playground/catalog';
import { TIER } from '#engine/core/tier';
import { frameCost, type Bucket } from '#engine/core/frameCost';
import { Impacts } from '#engine/fx/Impacts';
import { shardCompleteUp } from '#game/complete/ShardComplete';
import { pathRampDescs } from '#engine/physics/paths';
import { activePhysics } from '#engine/physics/active';

import { pickInteractable } from '#engine/world/interact/Interactables';
import { textureBytes } from '#engine/render/textureBytes';
import { consumeTitleArrival, type TitleArrival } from '#engine/boot/titleArrival';
import { setAliveSource } from '#engine/boot/lastEnd';
import { beginExploreEntry, recordBootCheckpoint, markBootContextLost, markBootHandledError } from '#engine/boot/bootTrace';
import { LegacyCapture, installLegacyCapture, enterScope, currentScope, disposeScope, asShell, withScopeOwner } from '#engine/app/legacyCapture';
import { isDev } from '#engine/core/devMode';

// live animal positions for the compass, reused buffers (no per-frame allocations in the update loop)
const _animalXZ: { x: number; z: number }[] = [];
function animalPositions(list: { position: { x: number; z: number }; alive?: boolean }[]) {
  let n = 0;
  for (const a of list) { if (a.alive === false) continue; const p = _animalXZ[n] ??= { x: 0, z: 0 }; p.x = a.position.x; p.z = a.position.z; n++; }
  _animalXZ.length = n;
  return _animalXZ;
}

installErrorModal(); // before anything can throw

/**
 * The page's shell (SHARD-CACHE, E155): what every resident shard shares — the score (one Music on the page's one
 * AudioContext; each shard's own Audio is its world's sound). The loader, the service worker, the error modal and the
 * decoded audio / art caches (src/engine/boot/extras.ts) are page-wide by themselves.
 */
declare const __BUILD_ID__: string;

const shell: { music: Music | null } = { music: null };
let bootArrival: TitleArrival | null = null;
let bootFatalShown = false;

/** E183: how long the title idles before its one primed frame (a first glance at the deck, a swipe, stay smooth) */
const TITLE_IDLE_MS = 1200;


async function main() {
  app.rng.seed(pageSeed(getActiveChunk().seed, window.__wildshardHarness?.seed));
  const selected = getActiveChunk().slug;
  // Consume the title's one-shot intent before building. A WebContent crash cannot replay it.
  bootArrival = consumeTitleArrival(selected);
  // The registry and tier have already read ?chunk during module evaluation. Strip it before
  // the expensive build: an iOS PWA crash in Props must restart at the root selector.
  if (matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true) {
    const home = new URL(location.href);
    if (home.searchParams.has('chunk') || home.searchParams.has('v')) {
      home.searchParams.delete('chunk');
      home.searchParams.delete('v');
      history.replaceState(history.state, '', home);
    }
  }
  installLegacyCapture();
  const capture = new LegacyCapture(selected);
  enterScope(capture);
  const world = await buildShard(selected);
  let memoryAt = -Infinity, memoryMB = 0;
  const memory = (maxAgeMs = 5000) => {
    const now = app.clock.real * 1000;
    if (now - memoryAt >= maxAgeMs) { memoryAt = now; memoryMB = Math.round(textureBytes(world.scene) / 1e5) / 10; }
    return { cap: 1, shards: [{ slug: selected, running: true, textureMB: memoryMB }] };
  };
  setShardSwitcher({ memory });
  setAliveSource(() => ({ slug: selected, resident: `${selected} (playing) ~${Math.round(memory(60_000).shards[0]?.textureMB ?? 0)} MB` }));
}

interface BuiltWorld { readonly scene: THREE.Scene; dispose: () => void }

/** The page builds one level; all navigation uses a fresh page. */
function buildShard(slug: string): Promise<BuiltWorld> {
  const manifest = getActiveChunk();
  const scope = currentScope();
  return runShardLoad(manifest, (stage) => withShardHooks(manifest, stage, () => buildShardWorld(slug, manifest, stage)), {
    build: __BUILD_ID__,
    dispose: () => {
      if (app.render !== null) app.render.hold = true;
      if (scope !== null) disposeScope(scope);
    },
    report: reportError,
    show: (failure) => { bootFatalShown = true; showLoadFailure(failure); },
  });
}

interface StagedBoot {
  runtime: ShardRuntime;
  skins: readonly SkinDef[];
  progress: StepProgress;
  worldHook: (work: () => Promise<void>) => Promise<void>;
  handoff: TravelHandoff | null;
  items: ReadonlyMap<string, ItemRow>;
  featTotal: number | undefined;
}

async function buildShardWorld(slug: string, manifest: ShardManifest, stage: LoadStage): Promise<BuiltWorld> {
  const boot: StagedBoot = { handoff: null, items: new Map(), featTotal: undefined, skins: [], runtime: { world: null, step: null, play: null, interactables: [], overhead: [], objects: {}, hooks: {}, viewer: () => new THREE.Vector3(), horizonVeil: null }, progress: { set: () => undefined, detail: () => undefined }, worldHook: (work) => work() };
  const sequence = buildShardStages(slug, manifest, stage, boot);
  if (manifest.load === undefined) {
    let next = await sequence.next();
    while (!next.done) next = await sequence.next();
    return next.value;
  }
  const scope = currentScope()?.resources;
  if (scope === undefined) throw new Error('Plugin boot needs a level scope');
  const { default: Plugin } = await stage('manifest.load', manifest.load);
  const plugin = new Plugin();
  const game: GameServices = { runtime: boot.runtime, shard: manifest, rows: new Map(), bag: {
    tab: () => { throw new Error('Bag plugin tabs are not installed'); },
    fragment: (tab, fragment) => { const menu = boot.runtime.play?.menu; if (menu === undefined) throw new Error('Bag plugin fragments require the play host'); return menu.addBagFragment(tab, fragment); },
  } };
  let context: ShardContext | undefined;
  const ctx = (level: LevelContext): ShardContext => { context ??= shardContext(level, manifest, game); return context; };
  const staged = levelSequenceDriver(sequence, scope, () => boot.progress, () => {
    if (app.render !== null) {
      app.render.captureLevelResources();
      app.render.hold = true;
      app.render.frameGate = () => false;
    }
  });
  app.levelDriver = { ...staged.driver, data: async (spec, level) => {
    await staged.driver.data(spec, level);
    if (boot.handoff?.arrive) spec.spawn = boot.handoff.arrive;
  } };
  app.levelAdapters.inputContext = (def) => {
    const child = scope.child(`input.${def.id}`); app.input.register(def, child);
    return () => child.dispose();
  };
  app.levelAdapters.debugRow = (spec) => registerLevelDebugRow(spec, manifest.slug);
  app.levelAdapters.playground = (spec) => registerPlayground(manifest.slug, spec);
  try {
    await app.loadLevel(toLevelSpec(manifest), {
      world: (level) => boot.worldHook(async () => { await plugin.world?.(ctx(level)); }),
      kit: async (level) => {
        ctx(level).rows.item(KIT_ITEMS);
        await plugin.kit?.(ctx(level));
        boot.skins = [...(game.rows.get('skin')?.values() ?? [])] as SkinDef[];
        boot.items = game.rows.get('item') ?? new Map();
        boot.featTotal = game.rows.get('feat')?.size;
      },
      play: (level) => plugin.play?.(ctx(level)),
    });
  } catch (error) {
    if (error instanceof LevelLoadError) throw new ShardLoadError(error.stage, error);
    throw error;
  }
  return staged.result();
}

async function* buildShardStages(slug: string, manifest: ShardManifest, stage: LoadStage, boot: StagedBoot): LevelSequence<BuiltWorld> {
  // level.data consumes the per-tab intent before any expensive build can fail.
  boot.handoff = consumeTravelHandoff(manifest.slug);
  if (boot.handoff !== null) bootArrival = { slug: boot.handoff.to, mode: boot.handoff.mode };
  setTexturePolicy(manifest.tiers?.[TIER]?.textures);
  const loading = new Loading();
  app.setState('loading');
  if (manifest.slug !== slug) throw new Error(`buildShard: ${slug} is not the active chunk`);
  // The boot plan: DOWNLOAD = bytes read / bytes declared, SETUP = weighted steps (src/engine/boot/plan.ts).
  // Declared bytes come from the chunk's file list; every /assets fetch is counted on its way in.
  // the RESUMING screen's brand (E99): the shard's name + title art, while its URL is still the served file (the menu
  // preload swaps it for an in-memory blob: that one would not survive a recovery reload)
  const brand = (): void => { resumeScreen().brand(manifest.name, manifest.card.portrait); };
  brand();
  await stage('ktx2', () => prepareShardAssets(manifest, registerGpuFiles));
  const audioProfile = await stage('audio.preload', () => manifest.audio?.preload?.());
  const files = bootFiles(getActiveChunk(), undefined, audioProfile); // + the title / explore art and every audio file (project/archive/2026-09-23-preload-offline.md)
  useShardSteps(manifest.slug, manifest.boot?.steps, manifest.boot?.bytes); // the shard's own loading nouns + weights (src/engine/boot/steps.ts)
  const bootSteps: Record<string, number> = {}; // each step's wall ms (the host's timings: what a build / rebuild spends where)
  const plan = createBootPlan((view) => { loading.paint(view); resumeProgress(view.setup); for (const r of view.rows) if (r.state === 'ok') bootSteps[r.key] = Math.round(r.ms); }, { totals: declareTotals(files) });
  installByteCounter(plan, files);
  // a boot that throws shows WHY: the loading panel's foot line + the uncaught-exception modal (src/engine/ui/ErrorModal.ts)
  window.addEventListener('unhandledrejection', (e) => plan.fail(`BOOT FAILED · ${String((e.reason as { message?: string } | null | undefined)?.message ?? e.reason)}`.slice(0, 300)));
  window.addEventListener('error', (e) => plan.fail(`BOOT FAILED · ${e.message} @ ${e.filename.split('/').pop()}:${e.lineno}`.slice(0, 300)));
  const step: StepRunner = (key, work) => stage(key, () => plan.step(key, work).then((p) => p.value));
  boot.worldHook = manifest.boot?.stagedWorld === true ? (work) => work() : (work) => step('props', (p) => { boot.progress = p; return work(); });
  // let the service worker take control first (≤ 2.5 s, never fatal) so the first visit's bytes are cached (a shard built
  // later in the page finds it long settled)
  await window.__ws_sw?.ready;
  // this shard's files in flight now, in step order; each step builds as its files land — as one pack when the build has
  // one (src/engine/boot/pack.ts), else file by file (src/engine/boot/prefetch.ts); anything the pack lacks still goes file by file
  const pack = packFor(getActiveChunk());
  const packed = new Set(pack ? pack.files.map(([p]) => p) : []);
  const packStreamed = pack ? streamPack(pack, plan, files) : Promise.resolve();
  const worldFetches = bootFetches(getActiveChunk(), files).filter((p) => !packed.has(p));
  prefetch(worldFetches);
  // then the title art and ALL audio (project/archive/2026-09-23-preload-offline.md), after the pack so they do not split the pipe with the
  // world's files; the selected style + set are decoded as their bytes land — nothing is fetched after the bar.
  // A level may hold extras behind its complete world file queue.
  const extrasBarrier = manifest.boot?.barrier === true
    ? Promise.all([packStreamed, ...worldFetches.map(whenPrefetched)]) : packStreamed;
  prefetchAfter(extraFetches(files), extrasBarrier);
  // High-peak builds may defer extras decoding until their later loading steps.
  const deferExtras = manifest.boot?.phone?.deferExtras === true && TIER === 'phone';
  const menuLoad = deferExtras ? null : startMenuPreload(files, getActiveChunk());
  const audioLoad = deferExtras ? null : startAudioPreload(files, getActiveChunk(), audioProfile);
  const deferredAudio = deferExtras ? startDeferredAudioPreload(files, getActiveChunk(), audioProfile) : null;
  startViewmodelTextures((getActiveChunk().weapon) === 'crossbow'); // the crossbow's + rifle's textures, drawn in a worker while the world builds
  const fieldModels = getActiveChunk().fieldModels?.() ?? null; // the shard's field models' code (ShardManifest.fieldModels, E349), fetched while the world builds
  const level = yield 'world';
  const world = await bootstrap(step, toLevelSpec({ ...manifest, spawn: boot.handoff?.arrive ?? manifest.spawn }));
  const { game, sky, player, forest, params, chunk, registry } = world;
  app.params = params;
  boot.runtime.world = world; boot.runtime.step = step;
  if (level !== undefined) game.scene.add(level.root);
  // Fragile phone builds need a GPU guard before normal in-game recovery is installed.
  const fragileBoot = TIER === 'phone' && manifest.boot?.phone?.fragile === true;
  let bootGpuGuardActive = fragileBoot;
  let bootGpuExit = false;
  const failGpuBoot = (reason: string, stack = ''): void => {
    if (!bootGpuGuardActive || bootGpuExit) return;
    bootGpuExit = true;
    bootFatalShown = true;
    game.hold = true;
    if (/context lost/i.test(reason)) markBootContextLost();
    else markBootHandledError();
    plan.fail(`GPU BOOT FAILED · ${reason}`.slice(0, 300));
    showError(`${manifest.name} GPU boot failed: ${reason}`, stack);
  };
  const onBootContextLost = (event: Event): void => {
    event.preventDefault();
    failGpuBoot('WebGL context lost during loading');
  };
  if (fragileBoot) game.canvas.addEventListener('webglcontextlost', onBootContextLost);
  const nolock = params.has('nolock');
  // what the view-dependent layers (ground cover, grass, mist) fill around: the player, or Explore's free camera (E66)
  const viewer = (): THREE.Vector3 => (world.freeCamera ? game.camera.position : player.position);
  boot.runtime.viewer = viewer;
  const sea = chunk.ocean, isOcean = sea !== undefined; // open-water shard (Driftwood Isle): ocean + pier, no forest carpet / cabins / props
  // a structure-first shard (ShardManifest.ground.structures, Nine Dragon Stack): no ground cover / cabins / props / walkways — its world is built in the props step
  const built = game.level.ground.structures;

  // ── world dressing ──
  const edgeDressing = await step('edge', async () => {
    const boundary = new Boundary(sky).build();
    game.scene.add(boundary.group);
    await macrotask(); // boundary · water · horizon each in its own task
    const water = hasPond() ? new (await loadWorldContent()).Water(sky, forest.trees, { ...(chunk.pondClip === undefined ? {} : { clip: chunk.pondClip }), ...(chunk.pondLilyExclusions === undefined ? {} : { lilyExclusions: chunk.pondLilyExclusions }) }).build() : null;
    if (water) game.scene.add(water.group);
    // PH-L9: Pine Hollow's creek, waterfall, plunge foam and spray (two draws; they run on the wind clock)
    const streams = null;
    await macrotask();
    const horizon = new Horizon(sky).build();
    game.scene.add(horizon.group);
    // the painted 360° horizon (X4): far sea stacks, islands and cloud banks on the sea, day + night; the paintings load after boot
    const seaBody = app.world.water.sea; // registered at level.data, before the edge step
    const matte = seaBody !== null ? new HorizonMatte(sky, seaBody.level).build() : null;
    if (matte?.mesh) {
      game.scene.add(matte.mesh);
      game.onUpdate((dt) => { matte.update(dt, game.camera, sky.dayNight?.night ?? 0); }, 'main.2');
      document.addEventListener('ws:ready', () => { setTimeout(() => { void matte.load(horizon.group); }, 250); }, { once: true });
    }
    return { boundary, water, streams, horizon };
  });
  const { boundary, water, horizon } = edgeDressing;
  boot.runtime.horizonVeil = horizon.painted?.veil ?? null;
  // the paths as walkways where they cross ground steeper than the motor climbs (PHYSICS P4) — now that the decks are
  // registered, none where a deck carries the path (a board there pokes up through the bridge's planks); Nalati's decks
  // register in its props step (NALATI-MERGE P1), so its paths are laid after that
  const addPaths = (): void => { registry.add({ id: 'paths', name: 'Paths', category: 'ground', file: 'src/engine/physics/paths.ts', surface: 'ground',
    colliders: pathRampDescs(TRAILS, heightAt, (x, z) => normalAt(x, z)[1], { carried: (x, z) => registry.floorAt(x, z) !== undefined }) }); };
  if (chunk.ground.paths !== 'plugin' && built === undefined) addPaths();

  if (manifest.boot?.stagedWorld !== true) {
    await step('grass', () => undefined);
    await step('cabins', () => undefined);
  }
  const interactables = boot.runtime.interactables;
  const props = manifest.load === undefined ? await step('props', async (p) => {
    if (isOcean) return null;
    if (typeof chunk.ground.structures === 'object') { // legacy builder before its plugin migration
      const structures = await chunk.ground.structures.build();
      await structures.build({ renderer: game.renderer, scene: game.scene, camera: game.camera, registry,
        onUpdate: (fn) => { game.onUpdate(fn, 'structures'); }, progress: (f, detail) => { p.set(Math.round(f * 100), 100, detail); } });
      return null;
    }
    return null;
  }) : null;
  // Plugins need their audio service in kit; legacy levels retain their original allocation order.
  let preparedAudio: { audio: Audio; music: Music } | undefined;
  const prepareAudio = (): { audio: Audio; music: Music } => {
    if (preparedAudio) return preparedAudio;
    const audio = new Audio(manifest.audio);
    if (params.has('mute')) { audio.muted = true; audio.master.disconnect(); } // headless tests / captures: never make a sound
    // the Wildshard theme (project/archive/2026-09-23-music.md): the same score as the trailer, adaptive in play — menu / calm / alert / combat / underwater + stings
    // the page's one score (the shell's): built with the first shard, routed through the running shard's master (Music.attach)
    const music = shell.music ?? asShell(() => new Music(audio));
    shell.music = music;
    music.attach(audio);
    const mood = chunk.ocean ? 'island' : 'pine';
    music.setState({ shard: mood, mode: 'menu', intensity: 0, underwater: false });
    audio.music = music;
    audio.listenerPosition = player.position;
    app.audio = audio;
    preparedAudio = { audio, music };
    return preparedAudio;
  };
  if (audioProfile) prepareAudio();
  yield 'kit';
  // Species and their looks must be installed by plugin.kit before animals build (E357 R1).
  yield 'loadout';

  // Driftwood's world, built by its plugin's world hook (src/shards/driftwood-isle/world/build.ts, E357 S4.1); its readers
  // below move into the plugin at S4.2–S4.4 (nothing built off Driftwood)
  const dressing = { ...edgeDressing, ...driftwoodWorld(boot.runtime) };
  const { ocean, pier, jetties, boat, palmSpecs, cove, hut, lookout, wreck, shrine, bushes, gulls, bridge, bridgeDeck } = dressing;
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
  await stage('roster', () => listShardModels({ roster: roster === undefined ? undefined : () => Promise.resolve(roster), style: chunk.style, sky, renderer: game.renderer, animals: () => animals.animals, registry })); // every shard's live models in its Model Explorer (E315 M5): the shared training dummy, its creatures (its species list, alive now or not), people and gear
  const dayNight = sky.dayNight; // the backdrop's shared clock drives night activity
  if (dayNight) animals.enemyWorld.night = () => dayNight.night;
  // The resident clock drives Settings, Explore light presets and the HUD day badge.
  const worldClock = dayNight ?? app.dayCycle;
  app.registerDayCycle(worldClock, game.levelScope);
  if (worldClock) onSettingChange('time', (t) => { worldClock.setTime(t); }); // pause menu ▸ Settings ▸ Time of day (E55)

  // ── player kit: the shard's weapon + the rifle slot where the shard has one (EquipmentService.ts: 1…N / Q, the touch SWAP ring), HUD, audio ──
  const shardSword = (await step('weapon', () => Promise.all([viewmodelTexturesReady(), chunk.sword?.() ?? null])))[1]; // the viewmodels' textures from the worker + the lever-action's model (usually long done) + the shard's own sword (ShardManifest.sword); the build below is synchronous
  let arena: TrainingArena | null = null;
  const targets: Targets = authoredTargets(app.events, { raycast: (origin, dir, maxDist) => animals.raycast(origin, dir, maxDist) }, () => arena?.entered === true ? arena : null);
  // Driftwood's castaway rig (E334) also carries the iron sword's arms and the swimming hands: those go to their own owners
  const { ironArms: _ironArms, swim: swimArms, ...ownSword } = shardSword ?? {};
  const heldRow = chunk.loadout?.weapons[0];
  const authoredMelee = heldRow === undefined ? undefined : app.levelRegistrations.get('weapon', heldRow);
  const meleeProfile = authoredMelee !== undefined && 'moves' in authoredMelee ? authoredMelee as MeleeProfile : SWORD_WOOD;
  const authoredKit = await boot.runtime.buildEquipment?.(targets, nolock, shardSword);
  const crossbow: Weapon = authoredKit?.primary ?? (chunk.weapon === 'sword'
    ? new Sword({ game, sky, player, forest }, targets, { row: meleeProfile, profile: meleeProfile, allowUnlocked: nolock, ...ownSword, ...(chunk.camera ? { portraitFov: chunk.camera.portraitFov } : {}) })
    : (() => { throw new Error('Shard has no primary equipment factory'); })());
  await macrotask(); // each viewmodel in its own task
  // the rifle slot: Pine Hollow's lever-action (PH-U5, LeverRifle.ts — the crossbow's walnut, shared), the AR-15 on Nalati
  // (the practice room's loan); none on the sword shards, Driftwood and Nine Dragon (E333, Jake: "why is there an AR-15 in Driftwood?")
  const rifle = authoredKit?.rifle ?? null;
  await macrotask();
  const longbow = authoredKit?.secondary ?? null;
  const weapons = new EquipmentService(crossbow, { scope: game.levelScope, events: app.events, ...(authoredKit?.order === undefined ? {} : { order: [...authoredKit.order] }) });
  for (const w of [...(rifle ? [rifle] : []), ...(authoredKit?.extras ?? []), ...(longbow ? [longbow] : [])]) weapons.add(w, { locked: true });
  app.registerEquipment(weapons, game.levelScope);
  const lockSys = new LockOnSystem(player, weapons, game.camera); // the Zelda lock-on (E50): LOCK / Z, orbit, flick-switch — src/engine/player/LockOnTarget.ts
  const touchControls = new TouchControls(player, weapons, setting('touch') === 'on', lockSys); // on-screen FPS controls on coarse-pointer devices (?touch=1 / main menu ▸ Settings ▸ Touch controls forces)
  authoredKit?.install?.(weapons);
  await macrotask();
  const hud = withScopeOwner(game.engineScope, () => new HUD({ pointerLock: !nolock, weaponUi: weapons.current.row.ui, maxBolts: weapons.state.magazine }));
  const shellHud = new Set(document.querySelectorAll('#hud *'));
  game.hudBaseline = shellHud.size;
  game.hudRetained = shellHud;
  arena = new TrainingArena(game, registry, world.physics, { x: chunk.spawn.x, z: chunk.spawn.z });
  // E307: the open feature playground (src/playgrounds/: Nine Dragon's grapple course, Nalati's horse track), entered from the
  // Explore hub like the arena. `away()`: the player is in a practice room, not the shard (no bounds, no map, no last place)
  let playground: Playground | null = null;
  const away = (): boolean => arena.entered || playground?.entered === true;
  lockSys.inputService = app.input;
  app.addSystem({ id: 'engine.lockon.input', phase: 'input', after: ['engine.input.collect'], before: ['engine.player.input'], run: () => {
    if (app.input.consume('lock')) lockSys.resolveToggle();
  } }, game.levelScope);
  app.registerEquipmentHost({ game, player, physics: world.physics, arms: shardSword?.arms ?? null, lock: lockSys,
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
  yield 'play';
  const weaponStrip = new WeaponStrip(weapons); // every shard's one swap control (E303 / E319): the SWAP ring + pie on touch, a hotbar on desktop
  const lockOn = new LockOn(game.camera); // sword lunge target brackets (meleeLock, Sword.ts)
  const speedLines = new SpeedLines(); // dodge / lunge edge streaks
  const perf = new Perf(game); // frame meter top-right (?perf=0 hides)
  const minimap = new Minimap(); // circular minimap (Heightfield is installed by now)
  if (chunk.hud?.dayBadge === true) minimap.showDayBadge(); // the sun / moon on its rim (Nalati)
  const fullMap = new FullMap(minimap); // the menu's MAP tab (Menu.ts mounts it); tap the minimap / M to open
  const keepAlive = new KeepAlive();
  await macrotask();
  await step('menu', async (p) => { // the cards' art in memory before the title builds its deck (showIntro below)
    const practice = isDev() ? arena.preload() : null; // + the practice room's dummies in Developer mode: full on its first frame (E291)
    await (menuLoad ?? startMenuPreload(files, chunk)).wait(p);
    await practice;
  });
  const { audio, music } = prepareAudio();
  // the ring shrine hums by proximity and ducks the score up close (project/archive/2026-09-23-music.md v3 row 9)
  const shrineHum = shrine ? new ShrineHum(audio, music, { x: SHRINE.x, y: heightAt(SHRINE.x, SHRINE.z) + 2.5, z: SHRINE.z }) : null;
  const arrivalSpawn = boot.handoff?.arrive ?? chunk.spawn;
  const toSpawn = () => { player.spawn(arrivalSpawn.x, arrivalSpawn.z, arrivalSpawn.yaw, arrivalSpawn.y); if (pier && !boot.handoff?.arrive) { const y = pier.floorHeightAt(player.position.x, player.position.z); if (y !== undefined) player.position.y = y; } };
  const respawn = () => { toSpawn(); music.sting('death'); };
  installBounds(app, game.levelScope, game.level.bounds, { player, toSpawn,
    floorAt: (x, z) => registry.floorAt(x, z), suspended: () => world.freeCamera || world.tour.active || away() });
  let kills = 0, swimHold = false;
  const owned = new Owned(getActiveChunk().slug);            // E314: upgrades, cosmetics, trophies, the found iron sword (src/game/loot/Owned.ts)
  const playerHealth = new PlayerHealth(app.events, {
    now: () => performance.now(), position: () => player.position,
    dodging: () => player.dodging, dodgeGuard: () => false,
  });
  app.registerPlayer(playerHealth, game.levelScope);
  const effects = new EffectService(app.levelRegistrations.list('effect'), game.levelScope, app.events);
  app.registerEffects(effects, game.levelScope);
  playerHealth.attributes.incomingCap = chunk.fight?.maxHitDamage ?? Infinity;
  app.combat.playerRules(game.levelScope, { target: playerHealth, bossGod: params.has('bossGod'), capExempt: chunk.fight?.capExempt ?? [] });
  const harvested = new Set<object>();
  // ── the in-game menu: MAP · INVENTORY · ACHIEVEMENTS · SETTINGS (src/engine/ui/Menu.ts) ──
  const progress = new Progress(getActiveChunk().slug);     // shard achievements → titles (src/game/achievements.ts)
  const inventory = new Inventory(getActiveChunk().slug);   // the pack: harvest drops
  if (boot.featTotal !== undefined) progress.setFeatTotal(boot.featTotal);
  applyTravelCarry(boot.handoff, inventory);
  game.levelScope.onDispose(bindTravelInventory({ shard: chunk.slug, inventory, rows: boot.items }));
  const skins = new SkinLocker(chunk.slug, boot.skins);                          // legendary skins owned / worn (persisted; wired below)
  const menu = new GameMenu({
    fullMap, progress, inventory,
    kit: () => weapons.available.map((w) => { const worn = skins.wearing(w.id); return equipmentEntry(w, weapons.current, worn ? ` · ${worn.name}` : ''); }),
    onEquip: (id) => weapons.select(id as WeaponId),
    tools: () => toolEntries(weapons.tools, (key) => app.levelRegistrations.findText(key) ?? key),
    ...boot.runtime.menu,
  });
  hud.menu = menu; // pause → Settings tab; the menu's CLOSE → hud.onResume
  game.onUpdate((dt) => { if (hud.entered && !menu.isOpen) progress.addPlay(dt); }, 'main.6'); // E132: this shard's time played (the complete card shows it), in the world only
  fullMap.bindMinimap(() => { if (hud.entered) menu.open('map'); }); // in a practice room: its own map (E321)
  // E124: the BAG button squaring out the minimap's top-right corner (src/game/bag/BagButton.ts) — opens on GEAR (E314)
  new BagButton(minimap.root, () => { if (hud.entered) menu.openBag(); });
  // M / I / Esc are the menu's own keys (src/engine/ui/Menu.ts, gated by the HUD: E130)
  menu.onOpen = () => { if (document.pointerLockElement) document.exitPointerLock(); }; // the map wants a cursor; the lock comes back on close (onResume)

  // ── the review inbox (project/archive/2026-09-22-feedback-inbox.md): unlocked in Settings → REVIEW, then F8 (desktop), the ✎ disc under
  // PAUSE (touch) and the menu's FEEDBACK tab. The composer (src/engine/ui/Feedback.ts) loads on first use; while its overlay is up
  // the world is frozen on the captured frame (frameGate) and the weapons / pointer lock are released.
  let feedbackHeld = false;
  let feedback: Promise<Feedback> | null = null;
  const touchUi = () => document.getElementById('hud')?.classList.contains('touch') === true;
  let explore: Explore | null = null; // Explore World (below) — while it is up, notes describe the viewer, not the player
  const exploring = (): boolean => explore?.active === true;
  const loadFeedback = (): Promise<Feedback> => { feedback ??= import('#engine/ui/Feedback').then(({ Feedback: F }) => new F({
    capture: () => game.captureFrame(1280),
    context: () => (explore?.active === true ? { shard: getActiveChunk().slug, ...explore.context(), tier: TIER, fps: game.stats.fps, calls: game.lastFrame.calls, tris: game.lastFrame.triangles } : {
      shard: getActiveChunk().slug, pos: [player.position.x, player.position.y, player.position.z].map((v) => Number(v.toFixed(2))),
      yaw: Number(player.yaw.toFixed(3)), pitch: Number(player.pitch.toFixed(3)), weapon: weapons.current.id, health: Math.round(playerHealth.attributes.health), kills,
      swimming: player.swimming, hover: player.hover, tier: TIER, fps: game.stats.fps, calls: game.lastFrame.calls, tris: game.lastFrame.triangles,
    }),
    hold: (on) => {
      if (explore?.active === true) { feedbackHeld = on; explore.hold(on); return; }
      feedbackHeld = on; hud.holdPause = on;
      if (on) { weapons.setEnabled(false); if (document.pointerLockElement) document.exitPointerLock(); return; }
      weapons.setEnabled(!player.swimming);
      if (nolock || touchUi()) return;
      player.lock(); // Enter / a click on SEND is the user gesture; if the lock is refused, fall back to the pause menu
      setTimeout(() => { if (!document.pointerLockElement && hud.entered && !menu.isOpen && !feedbackHeld) hud.setPaused(true); }, 400);
    },
    toast: (t) => { if (explore?.active === true) explore.toast(t); else hud.toast(t); },
    touch: touchUi,
  })); return feedback; };
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'F8' || e.repeat || !quickNote() || !hud.entered || menu.isOpen || feedbackHeld) return;
    e.preventDefault();
    void loadFeedback().then((f) => f.openQuick());
  });
  menu.onFeedbackTab = (panel) => { void loadFeedback().then((f) => f.mountTab(panel)); };
  // the ✎ NOTE tag: a tag of the base HUD's status column (src/engine/ui/hudSlots.ts), under the rows
  const noteDisc = document.createElement('button'); noteDisc.type = 'button'; noteDisc.className = 'ws-fb-disc';
  noteDisc.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 20l1-4L16 5l3 3L8 19z M14 7l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>Note<b class="ws-fb-badge"></b>';
  hudSlots.pill(noteDisc, () => { if (hud.entered && !feedbackHeld) void loadFeedback().then((f) => f.openSheet()); });
  const noteBadge = noteDisc.querySelector('b');
  const syncNoteDisc = () => {
    noteDisc.classList.toggle('show', quickNote() && touchUi() && hud.entered);
    const q = queuedCount(); noteDisc.classList.toggle('queued', q > 0); if (noteBadge) noteBadge.textContent = String(q);
  };
  onReview(syncNoteDisc);
  // the island's sound bank (IslandSfx: footsteps, the sword's layers, the adventure kit's sounds) — null off Driftwood
  const islandSfx = sea ? new IslandSfx(audio) : null;
  // an achievement: the island's interact chime there (E318 row 14: not the combat hit-tick), the hit-tick elsewhere
  progress.onEarned = (d) => { if (app.events.ask('feat.toast', { id: d.id, ...(d.event === undefined ? {} : { event: d.event }), allowed: true }).allowed) hud.toast(`Achievement · ${d.name} — title unlocked: ${d.title}`); if (islandSfx) islandSfx.interact('chime'); else audio.hitMarker(); }; // a Nalati chapter's own caption announces its title
  const masterGain = () => { if (!audio.muted) audio.master.gain.setTargetAtTime(0.6 * getNumber('volume'), audio.ctx.currentTime, 0.05); };
  onNumber('volume', masterGain);

  const hands = new Hands(sky, game.camera, swimArms ?? null); // the swimming hands (shown only while player.swimming): the shard's arm rig swimming (Driftwood, E334), else white gloves
  const combatCues = new CombatCues(sharedCombatCues(sharedWeaponVoices(audio), isOcean));
  if (chunk.weapon === 'sword') (crossbow as Sword).onHeavy = () => { combatCues.cue(crossbow.row.cues?.heavy ?? 'cue.sword.heavy'); };
  // Content cue routing retains each weapon's existing sound source and fallback.
  weapons.onFire = () => {
    combatCues.fire(weapons.current.row);
  };
  weapons.onDry = () => { combatCues.cue(weapons.current.row.cues?.dry ?? 'cue.dry'); };
  weapons.onReloadStart = () => { combatCues.reload(weapons.current.row); };
  weapons.onSwap = () => { combatCues.cue('cue.swap'); };
  weapons.onImpact = (surface, point) => {
    if (surface !== 'flesh') arena.miss(point);
    const dx = point.x - player.position.x, dz = point.z - player.position.z, d = Math.hypot(dx, dz);
    const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    const pan = d > 1 ? ((dx * rx + dz * rz) / d) * 0.7 : 0, gain = 1 / (1 + d / 12);
    combatCues.impact(weapons.current.row, { surface, point, pan, gain });
  };
  weapons.onHit = (_kind, headshot, killed) => {
    music.combat(0.7);
    hud.showHitMarker(headshot, killed);
    audio.hitMarker();
    if (killed) { kills++; audio.kill(); }
    buzz(killed ? HAPTIC.kill : HAPTIC.hit);
  };
  // aim assist reads the live array; Nalati hands it a filtered copy each frame (B9 / B15: a wolf hidden in long grass, the
  // horse you ride and the camp horses / Tulpar are not targets — the sabre's pass side reads the same list)
  const aimList: AimTarget[] = [];
  setAimTargets(aimList);
  // the AR-15 is found, not issued: a floating pickup on the floor of cabin 1 (the hollow), inside by the door wall
  // (cabin local frame: door on +X, chimney end -Z — Cabin.ts); "[E] Take AR-15" through the door / harvest prompt path
  if (params.get('weapon') === 'rifle' || params.get('weapon') === 'lever') { weapons.unlock('rifle'); weapons.select('rifle', true); boot.runtime.hooks.disposeRifleDrop?.(); } // dev: start with it
  weapons.placePickups(chunk.loadout ?? {}, { prompts: interactables, owned: {
    has: (id) => { if (!isOwnedId(id)) throw new Error(`Unknown owned equipment: ${id}`); return owned.has(id); },
    grant: (id) => { if (!isOwnedId(id)) throw new Error(`Unknown owned equipment: ${id}`); owned.grant(id); },
  },
    onNear: (inside) => audio.pickupHum(inside),
    onPickup: (_row, toast) => { audio.hitMarker(); music.sting('pickup'); hud.toast(toast); },
    hold: params.get('weapon') === 'iron' ? 'weapon.sword-iron' : undefined });
  // ── Nalati's adventure (NALATI-MERGE Q1–Q5: the camp's people, the quest line, places with saved discovery on the full map;
  // src/shards/nalati-grasslands/adventure.ts on the shared quest core) — null on any other shard ──
  // Registered cosmetics restyle the held model and persist in this shard's locker.
  const weaponModel = (w: SkinDef['weapon']) => { const model = weapons.get(w).model; return model instanceof THREE.Group ? model : null; };
  const wearSkin = (skin: SkinDef) => { const m = weaponModel(skin.weapon); if (m) { applySkin(m, skin, sky); effects.sync(weapons.get(skin.weapon), [{ id: `effect.finish.${skin.id}` }]); } skins.wear(skin.weapon, skin.id); };
  animals.onKill = (a) => {
    // a sword kill is at arm's length: "Reef crab · 1 m" read as a marker to crabs 30 m off (E296); a shot keeps its distance
    hud.killFeed(meleeShard(chunk) ? `${a.label} killed` : `${a.label} · ${Math.round(a.position.distanceTo(player.position))} m`); progress.recordKill(a.kind, a.variant);
  };
  // E314 stage 3: the body shadow (ShardManifest.bodyShadow, src/engine/player/BodyShadow.ts) — hidden off play (the title, a practice
  // room, the free camera / tour) — and Driftwood's keepsakes (src/shards/driftwood-isle/loot/keepsakes.ts): the sea glass chime + charms,
  // the trophy plaques and drops, the captain's hat; chains onKill after the loot's coin bursts
  const bodyShadow = chunk.bodyShadow === true
    ? installBodyShadow({ game, player, hidden: () => !hud.entered || practiceRoom.open || world.freeCamera || world.tour.active || explore?.active === true })
    : null;
  for (const { id: w } of weapons.list) { const s = skins.wearing(w); if (s) wearSkin(s); }
  new Combat(game, animals, weapons, game.camera); // health bars over animals + MMO-style damage / MISS floats (self-wiring); Combat only taps onFire / onImpact, which the manager forwards for every weapon
  // taking a hit (B3): the arc points at the attacker (src/engine/ui/HurtArc.ts), a hurt grunt panned toward it (Audio.hurt — it
  // used to be the landing thud), and the killer is remembered for the death toast (B2)
  const hurtArc = new HurtArc();
  const playerHurt = new PlayerHurt(app.events, game.levelScope, app.combat, playerHealth, {
    player, directional: () => meleeShard(chunk) || boot.runtime.hooks.directional === true,
    flash: () => hud.damageFlash(), toast: (text) => hud.toast(text),
    combat: (value) => music.combat(value), hurt: (strength, pan) => audio.hurt(strength, pan), land: (hard) => audio.land(hard),
    arc: (x, z, at, yaw, damage) => hurtArc.hit(x, z, at, yaw, damage),
    trauma: (value) => CameraFX.for(game).addTrauma(value),
  });
  animals.onCharge = (a, raw) => playerHurt.creature(a, raw);
  // footsteps (B9): the island asks its surface map — planks on every deck, stone on the shrine dais, sand / wet sand / grass /
  // rock off them as the terrain paints it, an ankle splash in the shallows — pitched and levelled by speed; Pine Hollow as before
  const surfaces = sea ? new SurfaceMap({ sea: sea.level, heightAt, trailDistance, decks: [pier, ...jetties, boat, hut, lookout, bridge, wreck], stone: [shrine] }) : null;
  // the island's zoned soundscape + reverb rooms (S1 / S2): surf on the shoreline, palms, jungle, cove + waterfall, lookout wind; hold / cave / shrine reverb
  animals.onSound = (name, pos) => { audio.animal(name, pos, player.position, player.yaw); }; // the generated samples (E318 row 23: the island's crab / monkey / sailor / boar calls too, not the procedural bank)
  // the sword's combat layers on the island (S3 bank via IslandSfx; Pine Hollow has no sword): a whoosh per swing, an impact per blade
  // hit by material (+ a death bark), a clang where the blade meets a wall / trunk, each enemy wind-up's cue (C5)
  if (islandSfx) {
    const islandCues = new CombatCues(driftwoodCombatCues(islandSfx));
    swordEvents.onSwing = (speed, heavy, dir) => { islandCues.cue('cue.sword.swing', { speed, heavy, dir }); };
    swordEvents.onStrike = (kind, point, strength, killed) => { islandCues.cue('cue.sword.hit', { kind, point, strength, killed }); };
    swordEvents.onClang = (point, strength, clang) => { islandCues.cue('cue.sword.clang', { point, strength, clang }); }; // stone / wood by what the tip met (P5)
    animals.onWindup = (a) => { const e = a.kind === 'crab' ? 'crab' : a.kind === 'sailor' ? 'sailor' : a.kind === 'boar' || a.kind === 'bear' ? 'boar' : null; if (e !== null) islandSfx.windup(e, a.position); };
  }
  // E297 fight rules (Driftwood): an amber edge chevron toward an enemy winding up where you can't see it (src/engine/ui/WindupWarn.ts);
  // chained after the wind-up's sound cue
  const windupWarn = Number.isFinite(game.level.fight.attackers) ? new WindupWarn<(typeof animals.animals)[number]>() : null;
  // one chain: the typed 'ai.windup' event first, then the wind-up's sound cue, then the edge chevron (today's order)
  const windupCue = animals.onWindup;
  animals.onWindup = (a, duration) => { app.events.emit('ai.windup', { actor: a.combatActor(), duration }); windupCue?.(a, duration); windupWarn?.start(a, duration); };
  const ambience = sea ? new IslandAmbience(audio, { sea: sea.level, heightAt, palms: palmSpecs, wreck, cove: Cove.forIsland() }) : null;
  // the dev fps panel's COUNTS (src/engine/ui/perfHud.ts; read ≤ 4× a second while it is open): who is running AI near you
  perf.addCounts(() => {
    let alive = 0, near = 0, motors = 0, chase = 0, flee = 0;
    for (const a of animals.animals) {
      if (!a.alive || a.hidden) continue;
      alive++;
      const d = a.position.distanceTo(player.position);
      if (d < 60) near++;
      if (a.motor !== null) motors++;
      if (a.state === 'charge' || a.state === 'stalk' || a.state === 'attack' || (a.state === 'sidestep' && d < 80)) chase++; // 'sidestep' = a Pine Hollow fight owns it (pinehollow/ctx.ts SCRIPTED): the elite, the bull's rivals
      else if (a.state === 'flee') flee++;
    }
    const ph = activePhysics();
    return { animals: alive, near, motors, chase, flee, elite: boot.runtime.hooks.eliteEngaged?.() === true ? 1 : 0, bodies: ph?.world.bodies.len() ?? 0, colliders: ph?.world.colliders.len() ?? 0, 'fx chips': Impacts.for(game).mesh.count };
  });
  player.onStep = (sprinting) => {
    const p = player.position;
    if (islandSfx && surfaces && !(player.wading && player.depth > 0.3)) islandSfx.footstep(player.wading ? 'water' : surfaces.surfaceAt(p.x, p.z, p.y), Math.hypot(player.velocity.x, player.velocity.z));
    else if (player.wading) audio.wadeStep(player.depth, sprinting);
    else { const hoof = audio.hoofSurfaceAt?.(p.x, p.z); audio.footstep(sprinting, hoof !== undefined ? (hoof === 'wood' ? 'planks' : hoof) : pier?.floorHeightAt(p.x, p.z) !== undefined ? 'planks' : sea !== undefined && heightAt(p.x, p.z) - sea.level < 2.6 ? 'sand' : boot.runtime.hooks.stepSurface?.(p) ?? 'litter'); } // Nalati: its hoof ground (src/shards/nalati-grasslands/sound.ts); Pine Hollow: ForestAmbience's ground (PH-A3)
  };
  if (gulls && islandSfx) gulls.onCall = (pos) => { islandSfx.gullCallAt(pos, player.position, player.yaw); };
  player.onEnterWater = (impact) => audio.splash(impact);
  player.onSubmerge = () => { audio.dive(); islandSfx?.plunge(false); audio.setUnderwater(true); ambience?.setUnderwater(true); music.setState({ underwater: true }); };
  player.onSurface = () => { audio.surface(); islandSfx?.plunge(true); audio.setUnderwater(false); ambience?.setUnderwater(false); music.setState({ underwater: false }); };
  player.onExitWater = () => audio.waterExit();
  player.onStroke = () => audio.swimStroke();
  player.onJump = () => audio.jump();
  player.onDodge = () => { audio.dodge(); buzz(HAPTIC.dodge); };
  lockSys.onLock = () => { audio.lockOn(); buzz(HAPTIC.lock); };
  lockSys.onSwitch = () => { audio.lockSwitch(); buzz(HAPTIC.lockSwitch); };
  lockSys.onUnlock = () => { audio.lockOff(); buzz(HAPTIC.lockBreak); };
  lockSys.onNone = () => { audio.lockNone(); };
  lockSys.onFlickMiss = (dir) => { lockOn.flashMiss(dir); };
  player.onLunge = () => { audio.lunge(); buzz(HAPTIC.lunge); };
  player.onLand = (hard) => playerHurt.fall(hard);
  // ── death (E295): a fade to dark with a "Mauled by a brown bear / respawning at Wreck Cove" card (src/engine/ui/DeathFade.ts),
  // the respawn under the dark at the last named place you reached (src/game/LastPlace.ts; Driftwood's places, the spawn
  // when none), input frozen and no hit taken until the view is back. A boss fight's death keeps its own checkpoint. ──
  const deathFade = new DeathFade();
  const placePts = boot.runtime.hooks.places;
  const lastPlace = placePts !== undefined ? new LastPlace(placePts) : null;
  if (lastPlace !== null) {
    let since = 0;
    game.onUpdate((dt) => {
      since += dt;
      if (since < 0.25) return;
      since = 0;
      if (deathFade.active || !hud.entered || world.freeCamera || world.tour.active || away() || practiceRoom.open) return; // a practice room is never the checkpoint (E321)
      const p = player.position, ph = activePhysics();
      const floor = ph ? floorBelow(ph, p.x, p.z, p.y + 0.6, 1.2) : undefined; // real walkable footing under the feet
      const grounded = floor !== undefined && Math.abs(floor - p.y) < 0.3 && player.onGround && !player.swimming && !player.wading && !player.hover
        && !player.carried && player.ride === null && floor > (app.world.water.level ?? -Infinity) + 0.3;
      lastPlace.observe({ x: p.x, y: floor ?? p.y, z: p.z, grounded });
    }, 'last place');
  }
  const die = (by: DeathCause | undefined): void => {
    const stand = lastPlace?.stand ?? null;
    music.sting('death');
    player.carried = true; weapons.setEnabled(false); // frozen: the fixed step leaves the body alone, no swing / shot
    deathFade.play(deathCause(by ?? null), respawnWhere(chunk, stand !== null && stand.id !== 'pier' ? placeName(stand.label) : null, app.levelRegistrations.findText('respawn.default', game.levelScope)), {
      dark: () => { if (stand !== null && stand.id !== 'pier') player.spawn(stand.x, stand.z, stand.yaw, stand.y); else toSpawn(); }, // the pier IS the spawn (E308: half way down it, facing the island)
      done: () => { player.carried = false; weapons.setEnabled(!player.swimming); },
    });
  };
  playerHealth.bindLifecycle({ fading: () => deathFade.active, updateFade: (dt) => deathFade.update(dt) });
  installPlayerDeath(app.events, game.levelScope, playerHealth, {
    active: () => app.player === playerHealth, position: () => player.position,
    died: (cause, checkpoint) => {
      audio.death(); hud.damageFlash();
      if (!checkpoint) die(cause);
    },
  });
  // ── first-time control hints (E308, src/engine/ui/FirstHints.ts: every shard's one system; after main's onJump / onDodge, which
  // it chains): a label + pulsing ring on the touch control the first time it matters. Driftwood feeds its six triggers
  // (src/shards/driftwood-isle/firstMinutes.ts); another shard shows none until it feeds its own ──
  const firstHints = new FirstHints(player, { touch: touchControls.active, paused: () => !hud.entered || hud.paused || deathFade.active || away() || world.freeCamera || world.tour.active });
  game.onUpdate((dt) => { firstHints.update(dt); }, 'first hints');

  // ── menu ↔ world: the world is fully loaded, then sits frozen and silent under the menu (hero art
  // covers the canvas) until ENTER WORLD; "Exit to main menu" freezes it again — no reload, no
  // loading screen. `?skipintro=1` (bench / screenshots) and `?tour=1` go straight to the world.
  const tour = world.tour;
  // a GPU-recovery reload (E61) skips the title: straight back into the world at the saved spot, under the pause menu
  const resuming = params.has(RELOAD_PARAM);
  const arrival = bootArrival;
  const menuFirst = arrival === null && !params.has('skipintro') && !params.has('tour') && !resuming;
  let firstIn = true;
  let fromTitle = false; // pause → "Exit to main menu" → ENTER WORLD starts over at the spawn (E121), a plain resume does not
  const enter = () => {
    if (fromTitle) { fromTitle = false; toSpawn(); lastPlace?.reset(); }
    audio.resume();
    audio.worldMuted = false;
    if (!music.isPlaying) music.play('theme'); // normally already playing: the title screen's first gesture started it
    if (firstIn) { firstIn = false; music.sting('chunk'); } // the resolve chord on the first frame in
    music.setState({ mode: 'calm', intensity: 0 }); // title → the shard's theme, crossfaded on a bar
    void keepAlive.start(); // screen wake lock — needs this user gesture
    weapons.setEnabled(true);
    weapons.visible = true;
    perf.setActive(true);
    if (tour.active && !params.has('tour')) { tour.active = false; respawn(); }
    if (!nolock) player.lock();
  };
  hud.onArena = () => { arena.enter(player, weapons); setAimTargets(arena.targets); minimap.setPracticeArena(chunk.spawn); menu.setPractice(true); };
  hud.onResume = enter;
  hud.onExitToMenu = () => {
    arena.exit(); playground?.exit(); playground = null; minimap.setPracticeArena(null); menu.setPractice(false); setAimTargets(aimList); fromTitle = true; weapons.setEnabled(false); perf.setActive(false); audio.worldMuted = true; music.setState({ mode: 'menu' }); noteDisc.classList.remove('show');
  };

  // ── Explore World (project/archive/2026-09-23-explore-world.md): the title's EXPLORE WORLD panel — the viewer over this same loaded shard (a
  // lazy chunk). God-mode camera, Model Explorer, one ✎ to the review inbox; ✕ comes back here to the title.
  const exitExplore = () => {
    perf.setActive(false); audio.worldMuted = true; music.setState({ mode: 'menu' }); hud.showIntro(enter);
  };
  const noteSheet = async (): Promise<void> => { const f = await loadFeedback(); await f.openSheet(); };
  // E307: a playground's card — its scene loads (and builds, the first time) while Explore's last frame stays up, then the
  // world is entered straight into it, the pause menu's exit leading back to the hub, as from the Practice arena
  const enterPlayground = async (id: PlaygroundId): Promise<void> => {
    let pg: Playground;
    try {
      pg = await loadPlayground(id, { game, player, registry, physics: world.physics, spawn: chunk.spawn, toast: (t) => { hud.toast(t); }, animals });
    } catch (error) {
      console.warn(`[playground] ${id} did not load`, error);
      hud.startExplore();
      return;
    }
    hud.enterNow();
    if (!hud.entered) return;
    playground = pg;
    pg.enter();
    setAimTargets([]); minimap.setRoom(pg.map); menu.setPractice(true, pg.title); // E321: the room's own map, not the shard's
  };
  const openExplore = async (mode: ExploreMode, opts: { cam?: number[]; model?: string } = {}): Promise<void> => {
    beginExploreEntry(mode);
    audio.resume();
    audio.worldMuted = false;
    if (!music.isPlaying) music.play('theme');
    music.setState({ mode: 'calm', intensity: 0 });
    void keepAlive.start();
    weapons.setEnabled(false); weapons.visible = false;
    perf.setActive(false); // the Explore readout carries fps / calls / tris
    const t0 = performance.now();
    const { Explore: X } = await import('#engine/explore/Explore');
    const t1 = performance.now();
    recordBootCheckpoint('explore:imported');
    explore ??= new X({ world, onExit: exitExplore, onPractice: () => { hud.enterArenaNow(); }, onPlayground: (id) => { void enterPlayground(id); }, openFeedback: () => { void noteSheet(); }, hide: [boundary.group], creatures: animals.animals,
      overhead: [...boot.runtime.overhead, gulls?.group, dressing.cover?.group].filter((g) => g !== undefined) });
    const t2 = performance.now();
    recordBootCheckpoint('explore:constructed');
    explore.open(mode, opts);
    if (isDev()) void arena.preload(); // the hub's Practice card (Developer mode): its dummies load now, not when it opens (E291)
    console.info(`[explore] open: import ${Math.round(t1 - t0)} ms · build ${Math.round(t2 - t1)} ms · open ${Math.round(performance.now() - t2)} ms`);
  };
  const exploreParam = params.get('explore');
  const exploreMode: ExploreMode = exploreParam === 'world' || exploreParam === 'model' || exploreParam === 'sets' ? exploreParam : 'hub';
  hud.onExplore = () => { void openExplore('hub'); };
  // Not a frame is rendered or ticked while the menu is up: hud.entered is the gate.
  game.frameGate = () => ((hud.entered && !hud.paused) || exploring()) && !feedbackHeld && !rotateGated() && !shardCompleteUp(); // … and the review composer freezes it on the captured frame; the rotate page (E38) stops it too
  if (menuFirst) { weapons.setEnabled(false); weapons.visible = false; perf.setActive(false); audio.worldMuted = true; hud.showIntro(enter); }
  else if (arrival?.mode === 'explore') { weapons.setEnabled(false); weapons.visible = false; perf.setActive(false); hud.setOnEnter(enter); } // Explore ▸ Practice enters through it without the title: no handler left the weapon off and the DODGE disc dead (E285)
  else { hud.markEntered(enter); weapons.setEnabled(!nolock || params.has('skipintro')); }
  // ?explore=hub|world|model|sets[&cam=x,y,z,yaw,pitch][&model=id] — straight into the viewer (a shard with ShardManifest.explore — D4, E66; a note's "go there")
  if (exploreParam !== null && chunk.explore !== undefined) {
    const cam = (params.get('cam') ?? '').split(',').filter((v) => v !== '').map(Number);
    const model = params.get('model');
    hud.onExplore = () => { hud.onExplore = () => { void openExplore('hub'); }; void openExplore(exploreMode, { ...(cam.length >= 3 ? { cam } : {}), ...(model !== null ? { model } : {}) }); };
    hud.startExplore();
  }
  // the first gesture builds the AudioContext; on the title screen it also starts the title theme (synth, then the title stems)
  const firstGesture = () => { audio.resume(); if (!hud.entered && !music.isPlaying) music.play('theme'); };
  document.addEventListener('keydown', firstGesture, { once: true });
  document.addEventListener('mousedown', firstGesture, { once: true });

  // ── interaction (doors, chests, pickups, carcasses): the nearest one within its radius that the eye can SEE (PHYSICS P5 —
  // a Rapier ray from the camera; a door or chest behind a wall neither prompts nor opens) ──
  // a cabin door's prompt stands 0.5 m out from its leaf: seen from inside, the shut leaf is its own body, not a wall
  const carcassAt = new THREE.Vector3();
  let prompt: string | undefined;
  let nearest: (typeof interactables)[number] | undefined;
  let carcass: (typeof animals.animals)[number] | undefined;
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyE' || !hud.entered) return;
    if (nearest) { tap.use?.(nearest.label); nearest.onInteract(); }
    else if (carcass && boot.runtime.hooks.harvestBusy?.() !== true) {
      harvested.add(carcass);
      const drops = inventory.harvest(carcass.kind, carcass.variant); // Pine Hollow: only what Mott takes (E314 C)
      const give = (): void => {
        const got = drops.filter((id) => inventory.add(id)); // the toast names only what went in
        hud.toast(`${got.map((id) => ITEMS[id].label).join(' + ') || 'Nothing'} harvested · ${inventory.total} in the pack`);
        audio.hitMarker();
      };
      if (boot.runtime.hooks.harvest) boot.runtime.hooks.harvest(carcass, give); // PH-F2: the skinning beat, then the drops; the carcass stays for the ravens
      else { give(); carcass.fadeOut(); }
    }
  });

  let musicPoll = 0;
  const alertOnlyHostile = manifest.audio?.alertOnlyHostile === true;
  // the dev fps panel's split of this updater (src/engine/core/frameCost.ts; free while the panel is closed): `mark(b)` books the
  // time since the last mark to bucket b, `unmark()` leaves it in 'other'
  let markT = 0;
  const mark = (b: Bucket): void => { if (frameCost.on) { const now = performance.now(); frameCost.section(b, markT); markT = now; } };
  const unmark = (): void => { if (frameCost.on) markT = performance.now(); };
  game.onUpdate((dt, t) => {
    unmark();
    // music: once a second (not per frame) — an animal that has noticed you within 40 m lifts calm → alert; combat comes from the hit hooks and decays by itself
    if (t - musicPoll > 1) {
      musicPoll = t;
      syncNoteDisc(); // the ✎ disc follows entered / the touch layer / the Quick note switch, once a second
      if (music.state.mode !== 'combat' && music.state.mode !== 'menu') {
        // (the steppe's herds and the flock dog go 'alert' as you ride by: only a hostile one lifts Nalati's score — NALATI-MERGE A2)
        const noticed = animals.animals.some((a) => a.alive && (a.state === 'alert' || a.state === 'stalk') && (!alertOnlyHostile || a.aggressive) && a.position.distanceTo(player.position) < 40);
        music.setState({ mode: noticed ? 'alert' : 'calm', intensity: noticed ? 0.5 : 0 });
      }
    }
    boundary.update(dt, t);
    // Driftwood's ocean · boat · palms · gulls · bridge planks · seabed · cove · shrine: its plugin's systems (src/shards/driftwood-isle/world/systems.ts)
    if (dayNight) { shrine?.setDusk(dayNight.dusk); if (ambience) ambience.night = dayNight.night; }
    mark('world');
    hands.update(dt, player);
    mark('player');
    horizon.update(dt, game.camera);
    boot.runtime.hooks.worldUpdate?.(dt, t);
    mark('world');
    // swimming holsters the weapon (hands only; Hands.ts follows)
    if (player.swimming !== swimHold) { swimHold = player.swimming; weapons.visible = !swimHold; weapons.setEnabled(!swimHold); }
    unmark();
  }, 'main.world');
  app.addSystem({ id: 'engine.creatures.update', phase: 'update', after: ['main.world'], before: ['main.frame'], run: (dt, t) => {
    animals.update(dt, t, player.position, player.sprinting, viewer(), game.camera);
    aimList.length = 0; aimList.push(...app.events.ask('combat.aimTargets', animals.animals.filter((a) => a !== player.mountedOn)));
  } }, game.levelScope);
  app.addSystem({ id: 'main.frame', phase: 'update', after: ['engine.creatures.update'], before: ['engine.player.hud'], run: (dt, t) => {
    mark('animals');
    weapons.update(dt, t); // every weapon ticks (bolts in flight keep flying while the rifle is out)
    boot.runtime.hooks.equipmentUpdate?.(dt); weaponStrip.update();
    boot.runtime.hooks.updatePickups?.(dt, t);
    weapons.updatePickups(dt, t);
    mark('player');
    audio.listenerYaw = player.yaw;
    shrineHum?.update(game.camera);
    ambience?.update(dt, game.camera);
    boot.runtime.hooks.audioUpdate?.(dt);
    mark('audio');

    // nearest interactable
    const physics = activePhysics();
    nearest = pickInteractable(interactables, game.camera.position, physics);
    carcass = undefined;
    if (!nearest) for (const a of animals.animals) {
      if (a.alive || harvested.has(a) || a.position.distanceTo(player.position) >= 2.6) continue;
      if (inventory.harvest(a.kind, a.variant).length === 0) continue; // nothing to take (Pine Hollow's elk: E314 C) (the drowned sailor / captain fade): no [E] Harvest (E318 row 17)
      if (physics && !lineOfSight(physics, game.camera.position, carcassAt.copy(a.position).setY(a.position.y + 0.4), 0.6)) continue; // not through a wall (animals aren't physics yet: their body blocks nothing)
      carcass = a; break;
    }
    prompt = nearest ? `[E] ${nearest.label}` : carcass ? `[E] Harvest ${carcass.label || carcass.kind}` : undefined; // "Harvest Royal bull", not "Harvest elk"
    // E296: no prompt over a fight on a melee shard — in the wreck's hold the guarded sword's and the jammed winch's (on the
    // phone the big USE band) sat across the drowned sailor. A fight = a hit in the last 3 s, or an enemy on you within 5 m;
    // E still works
    if (prompt !== undefined && meleeShard(chunk)) {
      let fighting = performance.now() - playerHealth.lastHurt < 3000;
      for (const a of animals.animals) {
        if (fighting) break;
        fighting = a.alive && a.aggressive && (a.state === 'attack' || a.state === 'stalk' || a.state === 'charge') && a.position.distanceToSquared(player.position) < 25;
      }
      if (fighting) prompt = undefined;
    }

  } }, game.levelScope);
  game.onUpdate((dt) => {
    unmark();
    hurtArc.update(dt, player.position, player.yaw);
    windupWarn?.update(dt, game.camera, player.position, player.yaw, animals.isThreat);

    const edge = CHUNK_HALF - Math.max(Math.abs(player.position.x), Math.abs(player.position.z));
    hud.setBoundaryWarning(!away() && edge < 14 && hud.entered);
    hud.setAimInfo(aimReadout(weapons.aimInfo)); // a boss by its name (PH-C1)
    lockOn.update();
    speedLines.update(dt, player.dashing, meleeLock.lunging);
    if (hud.entered) { hud.setAnimals(away() ? [] : animalPositions(animals.animals)); minimap.update(player.position, player.yaw, away() ? [] : animals.animals); fullMap.update(player.position, player.yaw); } // a practice room's map is its own (Minimap.setRoom, E321), not the shard's terrain
    hud.setState({
      bolts: weapons.state.ammo, maxBolts: weapons.state.magazine, reserve: weapons.state.reserve, loaded: weapons.state.loaded, reloading: weapons.state.reloading, reloadProgress: weapons.state.reloadProgress,
      weaponUi: weapons.current.row.ui,
      health: playerHealth.attributes.health, maxHealth: playerHealth.attributes.maxHealth, pos: { x: player.position.x, z: player.position.z }, yaw: player.yaw, kills,
      prompt, speed: player.speedFactor, ads: weapons.state.ads,
    });
    mark('hud');
  }, 'engine.player.hud');
  playerHealth.checkpoint(game.levelScope, () => boot.runtime.hooks.checkpoint?.() === true, () => app.player === playerHealth);
  app.events.on('player.respawned', () => {
    if (app.player !== playerHealth) return;
    if (crossbow.hasAmmo) crossbow.addBolts(30 - (crossbow.state.bolts ?? 30));
  }, game.levelScope);
  app.addSystem({ id: 'engine.player.regen', phase: 'update', after: ['main.frame'], before: ['engine.player.hud'], run: (dt) => playerHealth.update(dt) }, game.levelScope);

  // `?at=x,y,z,yaw,pitch` — a review note's repro URL (src/engine/ui/Feedback.ts reproUrl) starts you on the spot it was filed from
  const at = (params.get('at') ?? '').split(',').map(Number);
  if (at.length >= 3 && at.every((v) => Number.isFinite(v))) {
    const [x = 0, y = 0, z = 0, yaw = player.yaw, pitch = 0] = at;
    player.position.set(x, y, z); player.yaw = yaw; player.pitch = pitch;
  }
  // back from a GPU-recovery reload (E54): the pose is applied; take it off the address so a later reload spawns as usual
  if (params.has(RELOAD_PARAM)) { const u = new URL(location.href); u.searchParams.delete(RELOAD_PARAM); u.searchParams.delete('at'); history.replaceState(history.state, '', u); }

  boot.runtime.play = { animals, weapons, primary: crossbow, rifle, secondary: longbow, inventory, owned, progress, hud, menu, fullMap, audio, music, skins, wearSkin, touchUi, nolock, disposeRifleDrop: () => { boot.runtime.hooks.disposeRifleDrop?.(); }, cues: combatCues, firstHints, minimap, bodyShadow };
  yield 'finish';
  await macrotask();
  game.buildComposer();
  // Compile programs in batches with a visible count, then draw the first frames as a step —
  // instead of the first render() compiling ~100 programs in one stall (minutes on iOS).
  const programs = () => `${game.renderer.info.programs?.length ?? 0} programs`;
  try {
    await step('shaders', (p) => game.precompile((d, n, what) => p.set(d, n, `${what} · ${programs()}`)));
    if (fragileBoot && game.renderer.getContext().isContextLost()) throw new Error('WebGL context lost during shader compile');
    await step('firstFrame', (p) => game.firstFrame((d, n, what) => p.set(d, n, `${what} · ${programs()}`)));
    if (fragileBoot && game.renderer.getContext().isContextLost()) throw new Error('WebGL context lost during first frame');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (fragileBoot && /WebGLShader|WebGL context lost|shaderSource/i.test(message)) failGpuBoot(message.slice(0, 120), error instanceof Error ? error.stack ?? '' : '');
    throw error;
  }
  loading.setTextureBytes(textureBytes(game.scene));
  // Nine Dragon phone counts and caches the same files, then decodes selected audio after the loader's peak.
  if (deferredAudio) {
    await step('audio', (p) => deferredAudio.wait(p));
    // The synth bridges the short delay. This empty bank prevents Music.prepare() from decoding the
    // same selected style again if the player taps before the deferred decode finishes.
    music.useBank({ style: deferredAudio.style, set: 'base', slots: new Map(), stings: new Map(), log: [] });
  } else {
    const banks = await step('audio', (p) => (audioLoad ?? startAudioPreload(files, chunk, audioProfile)).wait(p));
    if (banks.music) music.useBank(banks.music); // the title theme's first gesture plays the stems at once
    if (banks.profile) audio.useLevelBank(banks.profile); else audio.useSamples(banks.sfx);
  }
  (plan as unknown as { done: () => void }).done(); // throws unless both tracks are exactly 1
  releaseByteCounter();
  // an app switch that takes the GPU (iOS): hold the loop, restore in place or reload where the player stood (E54)
  if (resuming) hud.setPaused(true); // RESUME is the gesture that brings the audio back (enter)
  const recoveryInstalledAt = performance.now();
  installGpuRecovery({ game, rebuild: () => { sky.rebuildEnvironment(); }, pose: () => (hud.entered ? { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, pitch: player.pitch } : null), resumed: resuming,
    fragileBoot: () => TIER === 'phone' && performance.now() - recoveryInstalledAt < 20_000,
  });
  bootGpuGuardActive = false;
  if (fragileBoot) game.canvas.removeEventListener('webglcontextlost', onBootContextLost);
  setPoseProvider(() => (hud.entered ? { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, pitch: player.pitch } : null)); // the Look Lab's reload prompt comes back right here (E65)
  await loading.done();
  if (level === undefined) app.events.emit('level.loaded', { id: slug });
  app.setState(hud.entered ? 'play' : 'title');
  game.start(); // keep the full render loop out of the loader's 100% fade and its transient boot-memory peak
  if (arrival?.mode === 'enter' || arrival?.mode === 'arena') enter();
  else if (arrival?.mode === 'explore') hud.startExplore(); // import the viewer only after shader compilation and the loader's peak
  if (arrival?.mode === 'arena') hud.enterArenaNow();
  if (deferredAudio) {
    const decodeAfterBoot = async (): Promise<void> => {
      try {
        const banks = await deferredAudio.decode();
        if (banks.music) music.useBank(banks.music);
        if (banks.profile) audio.useLevelBank(banks.profile); else audio.useSamples(banks.sfx);
      } catch (error) {
        console.info(`[audio] deferred level decode: ${error instanceof Error ? error.message : String(error)} — the synth plays`);
      }
    };
    requestAnimationFrame(() => { window.setTimeout(() => { void decodeAfterBoot(); }, 0); });
  }
  // E183: while the title idles, fetch the Explore code and draw the world's first frame once under the title art. The
  // first frame after the title paid every first-time cost at once — Pine Hollow's four elites built, the cover filled,
  // textures that arrived after the boot uploaded: EXPLORE WORLD's first tap stalled ~1.3 s at 4× CPU (and ENTER WORLD's
  // first frame the same). A return from the background already draws such a frame on the title (Game.start).
  if (menuFirst) window.setTimeout(() => {
    if (hud.entered || exploring()) return;
    if (chunk.explore !== undefined) void import('#engine/explore/Explore');
    game.primeFrame();
  }, TITLE_IDLE_MS);
  const handle = { ...world, boundary, water, streams: dressing.streams, ocean, pier, jetties, boat, hut, lookout, wreck, shrine, bushes, gulls, bridge, bridgeDeck, cove, hands, props, animals, interactables, crossbow, hud, audio, music, shrineHum, islandSfx, surfaces, ambience, lockSys, lockState, weapons, arena, playground: (): Playground | null => playground, ...boot.runtime.objects };
  app.audio = audio;
  game.retainKitResources();
  game.captureLevelResources();
  game.levelScope.onDispose(() => { windupWarn?.dispose(); weapons.setEnabled(false); ambience?.dispose(); boot.runtime.hooks.dispose?.(); audio.unloadLevel(); });
  installProbe(handle, { bootSteps, health: () => playerHealth.attributes.health, quest: () => ({ driftwood: boot.runtime.hooks.adventureFlags?.() ?? [], nalati: boot.runtime.hooks.questFlags?.() ?? [] }) });
  document.dispatchEvent(new Event('ws:ready')); // booted to the title: the native shell's update watchdog (src/engine/native/boot.ts) waits for this
  // E158: the other shards' boot files into the worker's cache, in the background — once a page (the shell's, not a shard's)
  asShell(() => { startShardPrefetch(getActiveChunk()); });


  const levelWorld: BuiltWorld = { scene: game.scene, dispose: () => {
    weapons.setEnabled(false); perf.setActive(false); audio.unloadLevel();
  } };
  game.levelScope.onDispose(levelWorld.dispose);
  return levelWorld;
}
installKitSpecies();
main().catch((e: unknown) => {
  markBootHandledError();
  if (!bootFatalShown) showError(e instanceof Error ? `${e.name}: ${e.message}` : String(e), e instanceof Error ? e.stack ?? '' : '');
});
