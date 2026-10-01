import { app } from '#engine/app/runtime';
import { pageSeed } from '#engine';
import { legacyShardId, meleeShard, hitDamage } from '#game/shard/manifest';
import { installProbe } from '#engine/debug/probe';
import { tap } from '#engine/core/harnessTap';
import * as THREE from 'three';
import { bootstrap } from '#engine/core/bootstrap';
import { installGpuRecovery, RELOAD_PARAM } from '#engine/core/GpuRecovery';
import { setPoseProvider } from '#engine/ui/ReloadPrompt';
import { CHUNK_HALF, ROAD_LENGTH } from '#engine/core/config';
import { hasPond, heightAt, normalAt, trailDistance, CABIN_SITES, TRAILS } from '#engine/world/Heightfield';
import { Boundary } from '#engine/world/Boundary';
import { Water } from '#shards/pine-hollow/world/pond';
import { PineStreams } from '#shards/pine-hollow/world/streams';
import { Ocean } from '#shards/driftwood-isle/world/Ocean';
import { Pier } from '#shards/driftwood-isle/world/Pier';
import { Boat } from '#shards/driftwood-isle/world/Boat';
import { Boulders } from '#shards/driftwood-isle/world/Boulders';
import { Hut } from '#shards/driftwood-isle/world/Hut';
import { Palms } from '#shards/driftwood-isle/world/Palms';
import { GroundCover } from '#shards/driftwood-isle/world/GroundCover';
import { tintTerrain } from '#shards/driftwood-isle/world/coverTint';
import { area as islandArea } from '#engine/world/blenderArea';
import { HUT, LOOKOUT, WRECK, SHRINE, JETTIES, BRIDGE, BOAT_MOOR, PIER_PENNANT_AT, PRACTICE_CRAB } from '#shards/driftwood-isle/manifest';
import { installFirstMinutes } from '#shards/driftwood-isle/firstMinutes';
import { RopeBridge } from '#shards/driftwood-isle/world/RopeBridge';
import { Seabed } from '#shards/driftwood-isle/world/Seabed';
import { Cove } from '#shards/driftwood-isle/world/Cove';
import { Enemies } from '#shards/driftwood-isle/creatures/Enemies';
import { Lookout } from '#shards/driftwood-isle/world/Lookout';
import { Wreck } from '#shards/driftwood-isle/world/Wreck';
import { placeDriftwoodPlaces } from '#shards/driftwood-isle/world/places';
import { Shrine } from '#shards/driftwood-isle/world/Shrine';
import { Bushes } from '#shards/driftwood-isle/world/Bushes';
import { Gulls } from '#shards/driftwood-isle/world/Gulls';
import { Trailside } from '#shards/driftwood-isle/world/Trailside';
import { Hands } from '#engine/player/Hands';
import { Sword, swordEvents } from '#engine/player/Sword';
import { CameraFX } from '#engine/player/CameraFX';
import { buildNalatiKit } from '#shards/nalati-grasslands/weapons/nalatiKit';
import { IronSwordPickup, ironSwordSite } from '#shards/driftwood-isle/weapons/IronSword';
import { installAdventure } from '#game/quest/Adventure';
import { installNalatiAdventure, CAPTIONED_EVENTS } from '#shards/nalati-grasslands/adventure';
import { kitName as nalatiKitName, nalatiFinds, skinRows as nalatiSkinRows } from '#shards/nalati-grasslands/bag';
import { FEI_ZHUA, NINE_WEAPON_NAME } from '#shards/nine-dragon-stack/bag';
import type { Weapon } from '#engine/player/Weapon';
import { Horizon } from '#engine/world/Horizon';
import { HorizonMatte } from '#engine/world/HorizonMatte';
import { Grass } from '#engine/world/Grass';
import { Undergrowth } from '#shards/pine-hollow/world/undergrowth';
import { Particles } from '#kit/looks/particles';
import { Cabins } from '#engine/world/Cabin';
import { installPineLandmarks, pineHamletBuildings } from '#shards/pine-hollow/world/landmarks';
import { Props } from '#shards/pine-hollow/world/props';
import { AnimalManager } from '#engine/entities/AnimalManager';
import { Crossbow, startViewmodelTextures, viewmodelTexturesReady, type Targets, type TargetHit } from '#engine/player/Crossbow';
import { Rifle } from '#engine/player/Rifle';
import { LeverRifle, preloadLeverModel } from '#shards/pine-hollow/weapons/LeverRifle';
import { Longbow } from '#engine/player/Longbow';
import { WeaponStrip } from '#engine/ui/WeaponStrip';
import { hudSlots } from '#engine/ui/hudSlots';
import { Weapons, type WeaponId } from '#engine/player/Weapons';
import { WeaponPickup } from '#engine/player/WeaponPickup';
import { SkinLocker, applySkin, clearSkin, crossbowDisplayModel, skinFor, type SkinDef } from '#engine/player/Skins';
import { finishPick, pineFinishes } from '#shards/pine-hollow/loadout/finishes';
import { mottLine } from '#shards/pine-hollow/quest/trades';
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
import { Inventory, ITEMS, isPineItem, type ItemId } from '#game/Inventory';
import { Owned } from '#game/loot/Owned';
import { practiceRoom } from '#engine/core/practiceRoom';
import { installLoot } from '#game/loot/install';
import { installKeepsakes } from '#shards/driftwood-isle/loot/keepsakes';
import { dodgeGuard } from '#shards/driftwood-isle/loot/perks';
import { installBodyShadow } from '#engine/player/BodyShadow';
import { getNumber, onNumber, onSettingChange, setting } from '#engine/ui/Settings';
import { dayClockClock, dayNightClock, setActiveClock } from '#engine/world/WorldClock';
import { DayNight } from '#engine/world/DayNight';
import { KeepAlive } from '#engine/core/KeepAlive';
import { Combat, aimReadout } from '#engine/ui/Combat';
import { HurtArc, deathCause, respawnWhere, type Killer } from '#engine/ui/HurtArc';
import { WindupWarn } from '#engine/ui/WindupWarn';
import { DeathFade } from '#engine/ui/DeathFade';
import { FirstHints } from '#engine/ui/FirstHints';
import { LastPlace, placeName } from '#game/LastPlace';
import { setAimTargets, meleeLock, lockOn as lockState, type AimTarget } from '#engine/player/AimTargets';
import { pastRidden, riding } from '#engine/player/riding';
import { createBootPlan, macrotask, slicer, type StepRunner } from '#engine/boot/plan';
import { useShardSteps } from '#engine/boot/steps';
import { declareTotals, installByteCounter, releaseByteCounter } from '#engine/boot/bytes';
import { bootFiles, extraFetches, startAudioPreload, startDeferredAudioPreload, startMenuPreload } from '#engine/boot/extras';
import { bootFetches, prefetch, prefetchAfter, whenPrefetched } from '#engine/boot/prefetch';
import { packFor, streamPack } from '#engine/boot/pack';
import { startShardPrefetch } from '#engine/boot/shardPrefetch';
import { getActiveChunk } from '#game/shard/registry';
import { Audio } from '#engine/audio/Audio';
import { Music } from '#engine/audio/Music';
import { ShrineHum } from '#shards/driftwood-isle/audio/shrineHum';
import { IslandSfx } from '#engine/audio/IslandSfx';
import { SurfaceMap } from '#engine/audio/Surface';
import { IslandAmbience } from '#shards/driftwood-isle/audio/ambience';
import { ForestAmbience } from '#shards/pine-hollow/audio/ambience';
import { installPineAudio } from '#shards/pine-hollow/audio/wiring';
import { installErrorModal, showError } from '#engine/ui/ErrorModal';
import { onReview, queuedCount, quickNote } from '#engine/ui/review';
import { rotateGated } from '#engine/ui/RotateGate';
import type { Feedback } from '#engine/ui/Feedback';
import type { Explore, ExploreMode } from '#engine/explore/Explore';
import { placeCabins } from '#shards/pine-hollow/world/cabins';
import { placePineHollowSets } from '#shards/pine-hollow/world/places';
import { listShardModels } from '#engine/models/roster';
import { TrainingArena } from '#engine/practice/TrainingArena';
import { loadPlayground } from '#engine/practice/playground/load';
import type { Playground } from '#engine/practice/playground/Playground';
import type { PlaygroundId } from '#engine/practice/playground/catalog';
import { TIER } from '#engine/core/tier';
import { frameCost, type Bucket } from '#engine/core/frameCost';
import { Impacts } from '#engine/fx/Impacts';
import { wireNalati, type Nalati } from '#shards/nalati-grasslands/index';
import { shardCompleteUp } from '#game/complete/ShardComplete';
import { cutTerrain } from '#engine/physics/terrain';
import { RopeChain } from '#engine/physics/ropeChain';
import { pathRampDescs } from '#engine/physics/paths';
import type { Collider } from '#engine/player/Player';
import { activePhysics } from '#engine/physics/active';
import { floorBelow, lineOfSight } from '#engine/physics/query';
import { pickInteractable, setSight } from '#engine/world/interact/Interactables';
import { installCompendium } from '#game/compendium/install';
import { installPineCombat } from '#shards/pine-hollow/combat/install';
import { installPineQuest } from '#shards/pine-hollow/quest/index';
import { installPineWeather } from '#shards/pine-hollow/world/weather';
import { installPineLoadout } from '#shards/pine-hollow/loadout/loadout';
import { installPineLife } from '#shards/pine-hollow/life/index';
import { ShardHost, textureBytes, type ShardWorld } from '#engine/shard/ShardHost';
import { consumeArenaArrival, setShardSwitcher } from '#game/travel/switch';
import { consumeTitleArrival, type TitleArrival } from '#engine/boot/titleArrival';
import { setAliveSource } from '#engine/boot/lastEnd';
import { beginNineExploreEntry, recordNineBootCheckpoint, markNineBootContextLost, markNineBootHandledError } from '#engine/boot/nineBootTrace';
import { asShell } from '#engine/core/shardScope';
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
const shell: { music: Music | null } = { music: null };
/** the page's shard host (main() makes it): each shard's GPU recovery asks it whether that shard is parked */
let hostRef: ShardHost | null = null;
let bootArrival: TitleArrival | null = null;
let bootFatalShown = false;

/** E183: how long the title idles before its one primed frame (a first glance at the deck, a swipe, stay smooth) */
const TITLE_IDLE_MS = 1200;

/** E216: every shard switch navigates, so this page owns only its one booted world. */
const SHARD_CAP = 1;

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
  const host = new ShardHost({ build: buildShard, cap: SHARD_CAP });
  setShardSwitcher({
    memory: () => host.memory(),
  });
  (window as unknown as { __shardHost: ShardHost }).__shardHost = host; // the E155 test + debugging: resident shards, switch timings, memory
  hostRef = host;
  // E179: the page's alive beat and every intentional reload record the running shard and what was resident
  setAliveSource(() => ({
    slug: host.active ?? '',
    resident: host.memory(60_000).shards.map((s) => `${s.slug}${s.running ? ' (playing)' : ''} ~${Math.round(s.textureMB)} MB`).join(' · '),
  }));
  await host.start(selected);
}

/**
 * One shard's world, built in the page (the first at page load, the others when the deck asks — src/engine/shard/ShardHost.ts).
 * This was the whole of main() when a page held one shard; it still is that boot, step for step.
 */
async function buildShard(slug: string, first: boolean): Promise<ShardWorld> {
  const loading = new Loading();
  app.setState('loading');
  if (getActiveChunk().slug !== slug) throw new Error(`buildShard: ${slug} is not the active chunk`);
  // The boot plan: DOWNLOAD = bytes read / bytes declared, SETUP = weighted steps (src/engine/boot/plan.ts).
  // Declared bytes come from the chunk's file list; every /assets fetch is counted on its way in.
  // the RESUMING screen's brand (E99): the shard's name + title art, while its URL is still the served file (the menu
  // preload swaps it for an in-memory blob: that one would not survive a recovery reload)
  const brand = (): void => { resumeScreen().brand(getActiveChunk().slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), getActiveChunk().card.portrait); };
  brand();
  const files = bootFiles(getActiveChunk()); // + the title / explore art and every audio file (project/archive/2026-09-23-preload-offline.md)
  useShardSteps(getActiveChunk().slug); // the shard's own loading nouns + weights (src/engine/boot/steps.ts)
  const bootSteps: Record<string, number> = {}; // each step's wall ms (the host's timings: what a build / rebuild spends where)
  const plan = createBootPlan((view) => { loading.paint(view); resumeProgress(view.setup); for (const r of view.rows) if (r.state === 'ok') bootSteps[r.key] = Math.round(r.ms); }, { totals: declareTotals(files) });
  installByteCounter(plan, files);
  // a boot that throws shows WHY: the loading panel's foot line + the uncaught-exception modal (src/engine/ui/ErrorModal.ts)
  window.addEventListener('unhandledrejection', (e) => plan.fail(`BOOT FAILED · ${String((e.reason as { message?: string } | null | undefined)?.message ?? e.reason)}`.slice(0, 300)));
  window.addEventListener('error', (e) => plan.fail(`BOOT FAILED · ${e.message} @ ${e.filename.split('/').pop()}:${e.lineno}`.slice(0, 300)));
  const step: StepRunner = (key, work) => plan.step(key, work).then((p) => p.value);
  // let the service worker take control first (≤ 2.5 s, never fatal) so the first visit's bytes are cached (a shard built
  // later in the page finds it long settled)
  if (first) await window.__ws_sw?.ready;
  // this shard's files in flight now, in step order; each step builds as its files land — as one pack when the build has
  // one (src/engine/boot/pack.ts), else file by file (src/engine/boot/prefetch.ts); anything the pack lacks still goes file by file
  const pack = packFor(getActiveChunk());
  const packed = new Set(pack ? pack.files.map(([p]) => p) : []);
  const packStreamed = pack ? streamPack(pack, plan, files) : Promise.resolve();
  const worldFetches = bootFetches(getActiveChunk(), files).filter((p) => !packed.has(p));
  prefetch(worldFetches);
  // then the title art and ALL audio (project/archive/2026-09-23-preload-offline.md), after the pack so they do not split the pipe with the
  // world's files; the selected style + set are decoded as their bytes land — nothing is fetched after the bar.
  // Nine Dragon has no pack: wait for its per-file queue as well, or 16 audio fetches crowd its GLBs/paint on iOS.
  const extrasBarrier = pack === null && getActiveChunk().slug === 'nine-dragon-stack'
    ? Promise.all(worldFetches.map(whenPrefetched)) : packStreamed;
  prefetchAfter(extraFetches(files), extrasBarrier);
  // Nine Dragon's world builder has a high transient CPU/GPU peak. Its art and selected audio are still
  // prefetched into the offline cache above, but decode them at their own later steps instead of at the
  // same time as the painted city and its viewmodel.
  const deferExtras = getActiveChunk().slug === 'nine-dragon-stack' && TIER === 'phone';
  const menuLoad = deferExtras ? null : startMenuPreload(files, getActiveChunk());
  const audioLoad = deferExtras ? null : startAudioPreload(files, getActiveChunk());
  const deferredAudio = deferExtras ? startDeferredAudioPreload(files, getActiveChunk()) : null;
  startViewmodelTextures((getActiveChunk().weapon) === 'crossbow'); // the crossbow's + rifle's textures, drawn in a worker while the world builds
  if (getActiveChunk().slug === 'pine-hollow') void preloadLeverModel(); // the lever-action's Blender model (PH-C11), fetched while the world builds
  const fieldModels = getActiveChunk().fieldModels?.() ?? null; // the shard's field models' code (ShardManifest.fieldModels, E349), fetched while the world builds
  const world = await bootstrap(step);
  const { game, sky, player, forest, params, chunk, registry } = world;
  // A phone can lose WebGL during Nine Dragon's large build, before the normal in-game GPU recovery
  // is installed. Show the fatal error once and let the player choose the next action.
  const fragileBoot = TIER === 'phone' && slug === 'nine-dragon-stack';
  let bootGpuGuardActive = fragileBoot;
  let bootGpuExit = false;
  const failGpuBoot = (reason: string, stack = ''): void => {
    if (!bootGpuGuardActive || bootGpuExit) return;
    bootGpuExit = true;
    bootFatalShown = true;
    game.hold = true;
    if (/context lost/i.test(reason)) markNineBootContextLost();
    else markNineBootHandledError();
    plan.fail(`GPU BOOT FAILED · ${reason}`.slice(0, 300));
    showError(`Nine Dragon GPU boot failed: ${reason}`, stack);
  };
  const onBootContextLost = (event: Event): void => {
    event.preventDefault();
    failGpuBoot('WebGL context lost during loading');
  };
  if (fragileBoot) game.canvas.addEventListener('webglcontextlost', onBootContextLost);
  // the built things' legacy boxes, for the ocean's foam rings (every one registers itself: models through
  // src/engine/models/place.ts, the world's welds — the trail, the cove — as world pieces, E315)
  const statics: Collider[] = [];
  const nolock = params.has('nolock');
  // what the view-dependent layers (ground cover, grass, mist) fill around: the player, or Explore's free camera (E66)
  const viewer = (): THREE.Vector3 => (world.freeCamera ? game.camera.position : player.position);
  const sea = chunk.ocean, isOcean = sea !== undefined; // open-water shard (Driftwood Isle): ocean + pier, no forest carpet / cabins / props
  const painterly = chunk.style === 'painterly'; // Nalati: no undergrowth / cabins / props — its world is wired by src/nalati (the props step)
  // a structure-first shard (ShardManifest.ground.structures, Nine Dragon Stack): no ground cover / cabins / props / walkways — its world is built in the props step
  const built = chunk.ground.structures;
  let nalati: Nalati | null = null;

  // ── world dressing ──
  const dressing = await step('edge', async () => {
    const slice = slicer(); // between the builders below: a task ends once it has run ~30 ms (Driftwood's pier … cove were one 0.3–0.5 s task)
    const boundary = new Boundary(sky).build();
    game.scene.add(boundary.group);
    await macrotask(); // boundary · water · horizon each in its own task
    const water = !isOcean && hasPond() ? new Water(sky, forest.trees).build() : null;
    if (water) game.scene.add(water.group);
    // PH-L9: Pine Hollow's creek, waterfall, plunge foam and spray (two draws; they run on the wind clock)
    const streams = chunk.slug === 'pine-hollow' ? new PineStreams(sky).build() : null;
    if (streams) game.scene.add(streams.group);
    const ocean = isOcean ? new Ocean(sky).build() : null;
    if (ocean) game.scene.add(ocean.group);
    // the south entry road is a wooden pier over the water; the player spawns on its deck
    // E315 M1: the pier model (src/shards/driftwood-isle/models/pier.ts) placed through src/engine/models/place.ts, which registers piece `pier`
    const pier = sea ? new Pier(sky, { x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckY: sea.level + 1.2, landing: true, pennantAt: PIER_PENNANT_AT }).place(registry, 'pier') : null;
    if (pier) {
      statics.push(...pier.colliders);
      const y = pier.floorHeightAt(player.position.x, player.position.z); if (y !== undefined) player.position.y = y;
    }
    // the little sailboat you arrived in, moored alongside the pier by the spawn (E308: half way down); you can drop into it
    // E315 M1: the sailboat model (src/shards/driftwood-isle/models/boat.ts) placed through src/engine/models/place.ts, which registers
    // piece `boat`: it rides the swell, its colliders (in the boat's own frame) follow it on a kinematic body (P4)
    const boat = pier && sea ? new Boat(sky, { x: BOAT_MOOR.x, z: BOAT_MOOR.z, heading: 0, waterY: sea.level, moorTo: pier.mooringsFor(BOAT_MOOR.x, BOAT_MOOR.z) }).place(registry) : null;
    if (boat) {
      statics.push(...boat.colliders);
      if (boat.ropes) game.scene.add(boat.ropes);
    }
    await slice();
    // faceted shore boulders along the beach
    const rockSpecs = isOcean ? Boulders.scatterShore(chunk.seed) : [];
    // E306 M0b: a model (src/shards/driftwood-isle/models/shoreBoulder.ts) placed through src/engine/models/place.ts, which registers piece `rocks`
    const rocks = isOcean ? new Boulders(sky).place(rockSpecs, registry) : null;
    if (rocks) statics.push(...rocks.colliders);
    await slice();
    // the thatched stilt hut on the plateau (porch, floor and front steps are walkable)
    // E315 M1: the hut model (src/shards/driftwood-isle/models/hut.ts) placed through src/engine/models/place.ts, which registers piece `hut`
    const hut = isOcean ? new Hut(sky, HUT).place(registry) : null;
    if (hut) statics.push(...hut.colliders);
    await slice();
    // the NE headland's lookout tower (platform + stair ramp walkable) and the wreck heeled on the east reef (deck walkable)
    // E315 M1: the lookout tower model (src/shards/driftwood-isle/models/lookout.ts) placed through src/engine/models/place.ts, which registers piece `lookout`
    const lookout = isOcean ? new Lookout(sky, LOOKOUT).place(registry) : null;
    if (lookout) statics.push(...lookout.colliders);
    await slice();
    // E315 M1: the shipwreck model (src/shards/driftwood-isle/models/shipwreck.ts) with the cove's cargo, drift logs and reef
    // rocks, placed drawnInto the wreck site's meshes (piece `wreck`: the site's colliders; the Wreck cove set)
    const wreck = isOcean ? new Wreck(sky, WRECK).place(registry) : null;
    if (wreck) { game.scene.add(wreck.group); statics.push(...wreck.colliders); }
    await slice();
    // the ring shrine in the NW jungle; the N / W / E jetties (the other entry roads); hibiscus bushes
    // E315 M1: the ring shrine model (src/shards/driftwood-isle/models/shrine.ts) placed through src/engine/models/place.ts, which registers piece `shrine`
    const shrine = isOcean ? new Shrine(sky, SHRINE).place(registry) : null;
    if (shrine) statics.push(...shrine.colliders);
    await slice();
    // the three jetties: three more placements of the pier model, pieces `jetty-0..2`
    const jetties: Pier[] = [];
    if (sea) for (const [i, j] of JETTIES.entries()) { const jetty = new Pier(sky, { x: j.x, z: j.z, rot: j.rot, length: j.length, width: 3, deckY: sea.level + 1.2 }).place(registry, `jetty-${i}`); statics.push(...jetty.colliders); jetties.push(jetty); await slice(); }
    await slice();
    const AVOID = [{ x: HUT.x, z: HUT.z, r: 11 }, { x: LOOKOUT.x, z: LOOKOUT.z, r: 12 }, { x: SHRINE.x, z: SHRINE.z, r: 13 }, { x: WRECK.x, z: WRECK.z, r: 14 }];
    // E315 M1: the hibiscus bush model (src/shards/driftwood-isle/models/hibiscusBush.ts) placed through src/engine/models/place.ts, which registers piece `bushes`
    const bushes = isOcean ? new Bushes(sky).place(Bushes.scatterIsland(chunk.seed, undefined, AVOID), registry) : null;
    await slice();
    // gulls: perched on the pier posts / bollards, the boat's bow and stern, the big shore rocks and the wet sand; flocks wheel over the lagoon
    const gulls = pier && boat && rocks && sea ? new Gulls(sky).build({
      perches: [
        ...pier.posts.map((p) => new THREE.Vector3(p.x, pier.deckY + 1.02, p.z)),
        ...pier.bollards.map((p) => new THREE.Vector3(p.x, pier.deckY + 1.41, p.z)),
        new THREE.Vector3(-4.2, sea.level + 0.78, -CHUNK_HALF + 6 - 3.0), new THREE.Vector3(-4.2, sea.level + 0.7, -CHUNK_HALF + 6 + 3.0),
        ...rockSpecs.filter((b) => b.r > 1.8).map((b) => new THREE.Vector3(b.x, heightAt(b.x, b.z) + b.r * (b.squash ?? 0.7) * 1.3, b.z)),
        ...Gulls.beachPerches(chunk.seed, 10, { x: 0, z: -195, r: 90 }),
      ],
      centre: new THREE.Vector3(0, 0, -205), radius: 90,
    }) : null;
    if (gulls) game.scene.add(gulls.group);
    await slice();
    // sand paths between the POIs: plank steps up the crag, rope fences, signposts
    const trailside = isOcean ? new Trailside(sky).build(Trailside.forIsland()) : null;
    // E315 M1: its fence posts, signposts and plank steps are models placed drawnInto the trail's weld (pieces `trail-*`, their
    // colliders with them); the trail's own piece keeps its steps' and stairs' treads
    if (trailside) { statics.push(...trailside.colliders); trailside.place(registry); }
    await slice();
    // the rope bridge over the tidal creek on the hut → lookout path (its deck: a RopeChain, below)
    // E315 M1: the rope bridge model (src/shards/driftwood-isle/models/ropeBridge.ts) placed through src/engine/models/place.ts, which registers piece `bridge`
    const bridge = isOcean ? new RopeBridge(sky, BRIDGE).place(registry) : null;
    if (bridge) statics.push(...bridge.colliders);
    await slice();
    // coral, kelp, starfish and a fish school on the lagoon shelf (what you dive for)
    const seabed = isOcean ? new Seabed(sky).build(Seabed.scatterLagoon(chunk.seed, 360, [{ x: WRECK.x, z: WRECK.z, r: 18 }])) : null;
    if (seabed) { game.scene.add(seabed.mesh); if (seabed.fish) game.scene.add(seabed.fish); }
    await slice();
    // coconut palms: where they stand (the palm itself is a model, placed below — one draw call, fronds sway in update)
    const palmSpecs = isOcean ? Palms.scatterIsland(chunk.seed, undefined, AVOID) : [];
    await slice();
    // Wreck Cove dressing: tidepools (the reef crabs' homes), the cascade + plunge pool, the glowing cave mouth
    // E315 M1: the cove is world (piece `cove`); its reef rocks are the reef-rock model
    const cove = isOcean ? new Cove(sky).place(registry, Cove.forIsland()) : null;
    if (cove) {
      statics.push(...cove.colliders);
      cutTerrain(world.physics, cove.terrainCuts()); // the drawn terrain pokes up through the sea cave: the physics ground doesn't
    }
    await slice();
    // E315 M1: the palm model (src/shards/driftwood-isle/models/palm.ts) placed through src/engine/models/place.ts, which registers piece `palms`
    const palms = isOcean ? new Palms(sky).place(palmSpecs, registry) : null;
    if (palms) statics.push(...palms.colliders);
    // ground cover near the player (M4): instanced grass / ferns / flowers / pebbles, refilled as you walk
    const cover = sea ? new GroundCover(sky, { sea: sea.level, palms: palmSpecs }).build() : null;
    if (cover) { game.scene.add(cover.group); game.onUpdate((dt) => cover.update(dt, viewer()), 'main.1'); tintTerrain(world.terrain.mesh); } // E156: the ground wears the cover
    ocean?.foamAround(statics); // foam rings around every pile, rock and hull standing in the sea (Ocean W2)
    await macrotask();
    const horizon = new Horizon(sky).build();
    game.scene.add(horizon.group);
    // the painted 360° horizon (X4): far sea stacks, islands and cloud banks on the sea, day + night; the paintings load after boot
    const matte = sea ? new HorizonMatte(sky, sea.level).build() : null;
    if (matte?.mesh) {
      game.scene.add(matte.mesh);
      game.onUpdate((dt) => { matte.update(dt, game.camera, sky.dayNight?.night ?? 0); }, 'main.2');
      document.addEventListener('ws:ready', () => { setTimeout(() => { void matte.load(horizon.group); }, 250); }, { once: true });
    }
    return { boundary, water, streams, ocean, pier, jetties, boat, palms, palmSpecs, cove, hut, lookout, wreck, shrine, bushes, gulls, bridge, seabed, horizon, rocks, cover, trailside };
  });
  const { boundary, water, ocean, pier, jetties, boat, palms, palmSpecs, cove, hut, lookout, wreck, shrine, bushes, gulls, bridge, seabed, horizon } = dressing;
  // the rope bridge's deck hangs as a jointed chain (PHYSICS.md): it sags and bounces under you, the drawn planks follow
  const bridgeDeck = bridge ? new RopeChain(world.physics, bridge.chainSpec()) : null;
  if (bridgeDeck) game.onFixed('post', () => { bridgeDeck.capture(); }, 'main.3');
  // the paths as walkways where they cross ground steeper than the motor climbs (PHYSICS P4) — now that the decks are
  // registered, none where a deck carries the path (a board there pokes up through the bridge's planks); Nalati's decks
  // register in its props step (NALATI-MERGE P1), so its paths are laid after that
  const addPaths = (): void => { registry.add({ id: 'paths', name: 'Paths', category: 'ground', file: 'src/engine/physics/paths.ts', surface: 'ground',
    colliders: pathRampDescs(TRAILS, heightAt, (x, z) => normalAt(x, z)[1], { carried: (x, z) => registry.floorAt(x, z) !== undefined }) }); };
  if (!painterly && built === undefined) addPaths();
  // the Blender-built spawn cove (DRIFTWOOD-REMASTER X2, E52; the only island since E136): it sits on the procedural cove,
  // which stays as the fallback when it fails to load
  const blenderIsland = isOcean
    ? await import('#shards/driftwood-isle/world/BlenderIsland').then(({ BlenderIsland: B }) => B.install({
      scene: game.scene, sky, colliders: player.colliders, terrain: world.terrain.mesh, palms: palms?.mesh ?? null, palmSpecs,
      replace: [bushes?.mesh ?? null], cover: dressing.cover?.group ?? null,
    })).catch((e: unknown) => { console.warn('[island] the Blender island did not load; procedural', e); return null; })
    : null;
  if (blenderIsland) { game.onUpdate(() => { blenderIsland.update(sky); }, 'main.4'); dressing.cover?.excludeArea(islandArea); } // E156: the cove dresses its own area

  const carpet = await step('grass', async () => {
    // no forest carpet over open water (grass scattered the whole sea floor for 19 s)
    const bare = isOcean || built !== undefined; // no forest carpet over open water or a built world
    const grass = bare ? null : new Grass(sky, forest).build();
    await macrotask();
    const under = bare || painterly ? null : await new Undergrowth(sky, forest).buildAsync(macrotask); // a task per placement pass
    const particles = bare ? null : new Particles(sky, forest).build(); // pine-forest mist + needle fall: nothing to fall from on the island (E7 B8)
    if (grass) game.scene.add(grass.group);
    if (under) game.scene.add(under.group);
    if (particles) game.scene.add(particles.group);
    return { grass, under, particles };
  });
  const { grass, under, particles } = carpet;

  const homestead = await step('cabins', async () => {
    if (isOcean || painterly || built !== undefined) return { cabins: null, interactables: [] as Awaited<ReturnType<Cabins['build']>>['interactables'], landmarks: null };
    const cabins = new Cabins(sky, chunk.slug === 'pine-hollow' ? pineHamletBuildings() : []); // PH-B3: + the mill hamlet, one merged cluster
    const { group: cabinGroup, interactables } = await cabins.build();
    game.scene.add(cabinGroup);
    // P3: the cabins as real colliders (walls, floors, porch + step, furniture); their doors swing as kinematic pieces that
    // collide only when fully shut or open, and never switch on around a player standing in the doorway
    // E315 M2 / E347: each building and prop is a model `place` draws (the homestead's welds) with its own colliders and floors
    await placeCabins({ cabins, sky, registry });
    const _dp = new THREE.Vector3();
    for (const d of cabins.doorPieces()) {
      // E322: the doorway check only holds a door OFF (after a swing, until the player steps clear); a door that is already
      // solid stays solid when the player walks up to it — the check used to switch a shut door off, so it could be walked through
      let on = true;
      registry.add({ id: d.id, name: 'Cabin door', category: 'buildings', file: 'src/engine/world/Cabin.ts', surface: 'wood', follows: d.pivot, colliders: d.colliders,
        active: () => {
          if (d.swinging()) on = false;
          else if (!on) on = d.pivot.getWorldPosition(_dp).distanceToSquared(player.position) > 1.4 * 1.4;
          return on;
        } });
    }
    // PH-B3: the fire lookout + zipline, the footbridge, the standing stones, waystones, dam, canoe, board and cave mouth
    const landmarks = chunk.slug === 'pine-hollow' ? await installPineLandmarks({ sky, registry, cabins, onUpdate: (fn) => { game.onUpdate(fn, 'main.5'); }, trees: forest.trees }) : null;
    // PH-B2: the bear cave — the slope runs through its first metres: the drawn ground is punched there (its hood covers the
    // gap) and the physics ground pushed under its floor (its shell and the ground over it are colliders of their own)
    if (landmarks?.crags) { cutTerrain(world.physics, landmarks.crags.terrainCuts()); world.terrain.punch(landmarks.crags.holeTest()); }
    return { cabins, interactables, landmarks };
  });
  const { cabins, interactables, landmarks } = homestead;
  const props = await step('props', async (p) => {
    if (painterly) { nalati = await wireNalati({ game, sky, player, forest, chunk }); addPaths(); return null; } // the Nalati world (src/shards/nalati-grasslands/index.ts)
    if (isOcean) return null;
    if (built !== undefined) { // the structure-first shard's world: drawn, collides and lends its floor through the registry
      const structures = await built.build();
      await structures.build({ renderer: game.renderer, scene: game.scene, camera: game.camera, registry,
        onUpdate: (fn) => { game.onUpdate(fn, 'structures'); }, progress: (f, detail) => { p.set(Math.round(f * 100), 100, detail); } });
      return null;
    }
    // E315 M2: the boulders, stumps and logs are models (src/shards/pine-hollow/models/); the scatter places and registers
    // them — rocks and stumps as hulls, logs as capsules, the pieces a task apart (the phone's 30 ms per-task collider budget)
    const propsBuilt = new Props(sky, forest, game.renderer);
    await propsBuilt.build(registry, macrotask);
    statics.push(...propsBuilt.colliders);
    return propsBuilt;
  });

  const animals = await step('animals', async (p) => {
    const a = await new AnimalManager(game.scene, sky, forest).buildAsync(macrotask); // a task per herd, not one long one
    p.detail(`${a.animals.length} animals`);
    return a;
  });
  const nalatiNow = (): Nalati | null => nalati; // (a closure: TS narrows the `let` to null after the props step's callback)
  const wildlife = nalatiNow()?.attachAnimals(animals) ?? null; // Nalati's wolves / horses / sheep over the AnimalManager (src/shards/nalati-grasslands/index.ts)
  const ride = nalatiNow()?.ride ?? null; // Nalati's riding + taming (src/shards/nalati-grasslands/ride/ride.ts): ONE prompt, always the nearest horse action
  if (ride) interactables.push(ride.interactable);
  // the island's enemies (Enemies.ts): reef crabs at the tidepools, coconut monkeys in the groves, the drowned sailor in the wreck's hold,
  // and (E308) the lone practice crab on the path at the pier's foot
  const enemies = isOcean ? new Enemies(animals, { scene: game.scene, sky, palms: palmSpecs, wreck, crabSites: cove?.crabSites ?? [], ...(chunk.slug === 'driftwood-isle' ? { practice: PRACTICE_CRAB } : {}) }).build() : null;
  // the shard's models, for Explore World's catalog and tap-to-select (src/engine/explore/registry.ts: a shard registers what it built);
  // Driftwood's are on the model contract (E315 M1: `place` registers them)
  // the core fields' copies drawn as the shard's models (ShardManifest.fieldModels, E349: Pine Hollow's trees and forest-floor kinds, E315 M2)
  if (fieldModels) (await fieldModels)({ sky, renderer: game.renderer, forest, under, registry });
  void listShardModels({ roster: chunk.roster, style: chunk.style, sky, renderer: game.renderer, animals: () => animals.animals, registry }); // every shard's live models in its Model Explorer (E315 M5): the shared training dummy, its creatures (its species list, alive now or not), people and gear
  const dayNight = sky.dayNight; // the low-poly shard's clock (DayNight.ts, D3): the sailor walks at night, the shrine glows, the jungle swaps to crickets
  if (dayNight) animals.enemyWorld.night = () => dayNight.night;
  // the day clock behind one interface (src/engine/world/WorldClock.ts, NALATI-MERGE F8): Driftwood's DayNight or Nalati's DayClock —
  // Settings ▸ Time of day, Explore's light presets and the HUD's sun / moon glyph reach either (a URL ?time= wins on Nalati)
  const nalatiClock = nalatiNow()?.weather.clock;
  // Pine Hollow's clock (PineDayNight) keeps its own Settings (Debug ▸ Time of day): only Driftwood's DayNight goes through WorldClock
  const worldClock = dayNight instanceof DayNight ? dayNightClock(dayNight) : nalatiClock ? dayClockClock(nalatiClock, params.has('time') ? 'live' : setting('time')) : null;
  setActiveClock(worldClock);
  if (worldClock) onSettingChange('time', (t) => { worldClock.setTime(t); }); // pause menu ▸ Settings ▸ Time of day (E55)

  // ── player kit: the shard's weapon + the rifle slot where the shard has one (Weapons.ts: 1…N / Q, the touch SWAP ring), HUD, audio ──
  const shardSword = (await step('weapon', () => Promise.all([viewmodelTexturesReady(), chunk.slug === 'pine-hollow' ? preloadLeverModel() : null, chunk.sword?.() ?? null])))[2]; // the viewmodels' textures from the worker + the lever-action's model (usually long done) + the shard's own sword (ShardManifest.sword); the build below is synchronous
  let arena: TrainingArena | null = null;
  const targets: Targets = {
    raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): TargetHit | null {
      if (arena?.entered) return arena.raycast(origin, dir, maxDist);
      const h = pastRidden(() => animals.raycast(origin, dir, maxDist)); // never the horse you ride (src/engine/player/riding.ts)
      const hit: TargetHit | null = h ? { animal: h.animal, point: h.point, distance: h.distance, headshot: h.headshot } : null; // E300: an Animal is a TargetAnimal (no cast), and cast() hands back animals only
      return wildlife ? nalatiNow()?.sheepTarget(origin, dir, maxDist, hit) ?? hit : hit; // Nalati: the sheep flock is a target too
    },
  };
  // the shard hands the player its weapon (ShardManifest.weapon): the wooden sword on Driftwood Isle, the crossbow elsewhere;
  // Nalati its own three (src/shards/nalati-grasslands/weapons/nalatiKit.ts: bow · sabre · spear + javelins, the weapon strip)
  const nalatiKit = chunk.slug === 'nalati-grasslands' ? buildNalatiKit({ game, sky, player, forest }, targets, nolock) : null;
  // Driftwood's castaway rig (E334) also carries the iron sword's arms and the swimming hands: those go to their own owners
  const { ironArms, swim: swimArms, ...ownSword } = shardSword ?? {};
  const crossbow: Weapon = nalatiKit ? nalatiKit.base : chunk.weapon === 'sword'
    ? new Sword({ game, sky, player, forest }, targets, { allowUnlocked: nolock, ...ownSword, ...(chunk.camera ? { portraitFov: chunk.camera.portraitFov } : {}) })
    : new Crossbow({ game, sky, player, forest }, targets, { allowUnlocked: nolock });
  await macrotask(); // each viewmodel in its own task
  // the rifle slot: Pine Hollow's lever-action (PH-U5, LeverRifle.ts — the crossbow's walnut, shared), the AR-15 on Nalati
  // (the practice room's loan); none on the sword shards, Driftwood and Nine Dragon (E333, Jake: "why is there an AR-15 in Driftwood?")
  const isPine = chunk.slug === 'pine-hollow';
  const rifle = chunk.weapon === 'sword' ? null : isPine
    ? new LeverRifle({ game, sky, player, forest }, targets, { allowUnlocked: nolock, woodFrom: crossbow instanceof Crossbow ? crossbow.model : null })
    : new Rifle({ game, sky, player, forest }, targets, { allowUnlocked: nolock, muzzleLight: !isOcean }); // the AR-15 pickup is in a cabin: no muzzle light on the island
  await macrotask();
  // Pine Hollow's third weapon: the Warden's Longbow, the Antler King's reward (PH-C11, Longbow.ts; locked until his orb)
  const longbow = isPine ? new Longbow({ game, sky, player, forest }, targets, { allowUnlocked: nolock }) : null;
  // the iron sword is FOUND on the wreck's deck (IronSword.ts) — wooden stays 1, iron becomes 2 once taken. Not on Nine
  // Dragon (E314 A): nothing there can unlock it, so its kit is the Neon Jian alone (NINE_WEAPON_NAME)
  const isNine = chunk.slug === 'nine-dragon-stack';
  const ironSword = chunk.weapon === 'sword' && !isNine ? new Sword({ game, sky, player, forest }, targets, { allowUnlocked: nolock, blade: 'iron', ...(ironArms ? { arms: ironArms } : {}) }) : null;
  const weapons = new Weapons(crossbow, rifle, nalatiKit ? nalatiKit.extras : ironSword ? [{ weapon: ironSword, id: 'sword-iron', name: 'Iron sword' }] : longbow ? [{ weapon: longbow, id: 'bow', name: "Warden's longbow" }] : [], nalatiKit?.options ?? (isOcean ? { baseName: 'Wooden sword' } : isNine ? { baseName: NINE_WEAPON_NAME } : undefined)); // Driftwood's sword is "Wooden sword" everywhere, Nine Dragon's the Neon Jian (E314 A) — Bag, touch ring, hotbar (E318 row 18); held weapon = weapons.current; the hooks below are wired once here and forwarded; the rifle is locked until its pickup
  const lockSys = new LockOnSystem(player, weapons, game.camera); // the Zelda lock-on (E50): LOCK / Z, orbit, flick-switch — src/engine/player/LockOnTarget.ts
  const touchControls = new TouchControls(player, weapons, setting('touch') === 'on', lockSys); // on-screen FPS controls on coarse-pointer devices (?touch=1 / main menu ▸ Settings ▸ Touch controls forces)
  nalatiKit?.install(weapons); // Nalati: all three slots owned, the bow in hand
  await macrotask();
  const hud = new HUD({ pointerLock: !nolock });
  arena = new TrainingArena(game, registry, world.physics, { x: chunk.spawn.x, z: chunk.spawn.z });
  // E307: the open feature playground (src/playgrounds/: Nine Dragon's grapple course, Nalati's horse track), entered from the
  // Explore hub like the arena. `away()`: the player is in a practice room, not the shard (no bounds, no map, no last place)
  let playground: Playground | null = null;
  const away = (): boolean => arena.entered || playground?.entered === true;
  await chunk.traversal?.({
    game, player, physics: world.physics, arms: shardSword?.arms ?? null, lock: lockSys,
    toast: (message) => { hud.toast(message); },
    enabled: () => hud.entered && !world.freeCamera && !world.tour.active,
    touchHint: (lockHint, jumpHint) => { touchControls.hint(lockHint, jumpHint); }, // E286: the verb re-dresses LOCK / JUMP (Nine Dragon's GRAPPLE / ZIP)
  });
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
  const audio = new Audio();
  if (params.has('mute')) { audio.muted = true; audio.master.disconnect(); } // headless tests / captures: never make a sound
  // the Wildshard theme (project/archive/2026-09-23-music.md): the same score as the trailer, adaptive in play — menu / calm / alert / combat / underwater + stings
  // the page's one score (the shell's): built with the first shard, routed through the running shard's master (Music.attach)
  const music = shell.music ?? asShell(() => new Music(audio));
  shell.music = music;
  music.attach(audio);
  const mood = chunk.ocean ? 'island' : chunk.style === 'painterly' ? 'steppe' : 'pine';
  music.setState({ shard: mood, mode: 'menu', intensity: 0, underwater: false });
  // the ring shrine hums by proximity and ducks the score up close (project/archive/2026-09-23-music.md v3 row 9)
  const shrineHum = shrine ? new ShrineHum(audio, music, { x: SHRINE.x, y: heightAt(SHRINE.x, SHRINE.z) + 2.5, z: SHRINE.z }) : null;
  const toSpawn = () => { player.spawn(chunk.spawn.x, chunk.spawn.z, chunk.spawn.yaw, chunk.spawn.y); if (pier) { const y = pier.floorHeightAt(player.position.x, player.position.z); if (y !== undefined) player.position.y = y; } };
  const respawn = () => { toSpawn(); music.sting('death'); };
  // a built fragment's limits (ShardManifest.bounds): out of them → back on the last registry floor stood on inside them (or
  // the spawn), no death. The walls keep the player in; this catches whatever gets past them (a fall into the Well)
  if (chunk.bounds !== undefined) {
    const b = chunk.bounds, safe = { x: 0, y: 0, z: 0, set: false };
    let since = 0;
    game.onUpdate((dt) => {
      if (world.freeCamera || world.tour.active || away()) return;
      const p = player.position;
      if (p.y < b.floor || p.x < b.x0 || p.x > b.x1 || p.z < b.z0 || p.z > b.z1) {
        if (safe.set) player.spawn(safe.x, safe.z, player.yaw, safe.y); else toSpawn();
        since = 0;
        return;
      }
      since += dt;
      if (since < 0.2 || !player.onGround || player.hover) return;
      const f = registry.floorAt(p.x, p.z);
      if (f !== undefined && Math.abs(f - p.y) < 0.3) { safe.x = p.x; safe.y = f; safe.z = p.z; safe.set = true; since = 0; }
    }, 'bounds');
  }
  let kills = 0, health = 100, maxHealth = 100, lastHurt = 0, swimHold = false; // maxHealth: 100, Driftwood's sturdy hearts raise it (E314, installLoot)
  const harvested = new Set<object>();
  // ── the in-game menu: MAP · INVENTORY · ACHIEVEMENTS · SETTINGS (src/engine/ui/Menu.ts) ──
  const progress = new Progress(legacyShardId(getActiveChunk().slug));     // shard achievements → titles (src/game/achievements.ts)
  const inventory = new Inventory(legacyShardId(getActiveChunk().slug));   // the pack: harvest drops
  const skins = new SkinLocker();                          // legendary skins owned / worn (persisted; wired below)
  const owned = new Owned(legacyShardId(getActiveChunk().slug));            // E314: upgrades, cosmetics, trophies, the found iron sword (src/game/loot/Owned.ts)
  // Pine Hollow's GEAR ▸ FINISHES (E314 C, src/shards/pine-hollow/loadout/finishes.ts): wear / take off — set once the weapons' models exist (below)
  let pineFinish: ((id: string) => void) | null = null;
  const menu = new GameMenu({
    fullMap, progress, inventory,
    kit: () => weapons.available.map((w) => { const worn = w.id === 'crossbow' || w.id === 'rifle' ? skins.wearing(w.id) : null; const nl = nalatiNow(); return { id: w.id, name: nl ? nalatiKitName(w.id, w.name, { golden: nl.boss.golden?.applied === true, naizagai: nl.titan.naizagai?.applied === true }) : (w.id === 'crossbow' ? 'Hunting crossbow' : w.name) + (worn ? ` · ${worn.name}` : ''), ammoLabel: w.id === 'crossbow' ? (w.ammoLabel === 'Bolts' ? 'Iron bolts' : w.ammoLabel) : w.ammoLabel, ammo: w.state.ammo ?? 0, magazine: w.state.magazine, reserve: w.state.reserve, equipped: w === weapons.current, icon: w.id === 'rifle' ? (isPine ? 'lever' : 'rifle') : w.id === 'bow' ? 'longbow' : w.id === 'crossbow' ? 'crossbow' : 'sword' }; }),
    onEquip: (id) => weapons.select(id as WeaponId),
    ...(isNine ? { tools: () => [FEI_ZHUA] } : {}), // Nine Dragon's GEAR: the Fei Zhua grapple beside the jian (E314 A)
    ...(isPine
      ? { skins: () => pineFinishes(skins), onWearSkin: (id: string) => { pineFinish?.(id); }, skinsTitle: 'Finishes',
        // E314 C: the pack is Mott's trade stock — each item says what he gives for it
        pack: { note: "Everything here trades at Mott's stall", hint: "Trade at Mott's stall", gearHint: 'Tap a weapon to hold it · a finish to wear it', line: (id: ItemId) => (isPineItem(id) ? mottLine(id) : null) } }
      : { skins: () => { const nl = nalatiNow(); return nl ? nalatiSkinRows(nl.skins) : []; }, onWearSkin: (id: string) => { nalatiNow()?.skins.toggle(id); } }), // Nalati's wearable skins (B15): every one, the locked ones dim (E314 C)
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
      yaw: Number(player.yaw.toFixed(3)), pitch: Number(player.pitch.toFixed(3)), weapon: weapons.current.id, health: Math.round(health), kills,
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
  progress.onEarned = (d) => { if (d.event === undefined || !CAPTIONED_EVENTS.has(d.event)) hud.toast(`Achievement · ${d.name} — title unlocked: ${d.title}`); if (islandSfx) islandSfx.interact('chime'); else audio.hitMarker(); }; // a Nalati chapter's own caption announces its title
  const masterGain = () => { if (!audio.muted) audio.master.gain.setTargetAtTime(0.6 * getNumber('volume'), audio.ctx.currentTime, 0.05); };
  onNumber('volume', masterGain);

  const hands = new Hands(sky, game.camera, swimArms ?? null); // the swimming hands (shown only while player.swimming): the shard's arm rig swimming (Driftwood, E334), else white gloves
  if (chunk.weapon === 'sword') (crossbow as Sword).onHeavy = () => { if (!isOcean) audio.swordHeavy(); }; // the charged overhead (Weapons does not forward it); the island's is swordEvents.onSwing
  const meleeHeld = () => chunk.weapon === 'sword' || nalatiKit?.melee(weapons.current.id) === true; // the swords / the sabre / the spear
  // Nalati's kit voices (src/shards/nalati-grasslands/sound.ts) first; the island's whoosh is swordEvents.onSwing
  weapons.onFire = () => { if (nalatiNow()?.sound?.fire(weapons.current.id) === true) { /* voiced */ } else if (weapons.current.id === 'rifle') audio.rifleFire(); else if (!meleeHeld()) audio.crossbowFire(); else if (!isOcean) audio.swordSwing(); nalatiNow()?.onShot(); };
  weapons.onDry = () => audio.dryFire();
  weapons.onReloadStart = () => (weapons.current.id === 'rifle' ? audio.rifleReload() : audio.reload());
  weapons.onSwap = () => audio.weaponSwap();
  weapons.onImpact = (surface, point) => {
    if (surface !== 'flesh') arena.miss(point);
    const dx = point.x - player.position.x, dz = point.z - player.position.z, d = Math.hypot(dx, dz);
    const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    const pan = d > 1 ? ((dx * rx + dz * rz) / d) * 0.7 : 0, gain = 1 / (1 + d / 12);
    if (nalatiNow()?.sound?.impact(weapons.current.id, surface, pan, gain) === true) { /* Nalati: arrow / javelin / sabre (src/shards/nalati-grasslands/sound.ts) */ } else if (weapons.current.id !== 'rifle' && meleeHeld()) { if (!isOcean) audio.swordHit(surface, pan, gain); } else audio.boltImpact(surface, pan, gain); // the island's: swordEvents.onStrike
    nalatiNow()?.onImpact(surface, point); // Nalati: an arrow landing by a herd / the flock spooks it
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
  setAimTargets(painterly ? aimList : animals.animals);
  // the AR-15 is found, not issued: a floating pickup on the floor of cabin 1 (the hollow), inside by the door wall
  // (cabin local frame: door on +X, chimney end -Z — Cabin.ts); "[E] Take AR-15" through the door / harvest prompt path
  const rifleDrop = (() => {
    const site = CABIN_SITES[0]; if (!site || !cabins || rifle === null) return null;
    const lx = 1.5, lz = -1.6, c = Math.cos(site.rot), sn = Math.sin(site.rot);
    const x = site.x + lx * c + lz * sn, z = site.z - lx * sn + lz * c;
    const drop = new WeaponPickup({ scene: game.scene, item: rifle.displayModel(), position: new THREE.Vector3(x, cabins.floorHeightAt(x, z) ?? heightAt(x, z), z), tier: 'common', prompt: isPine ? 'Take the lever-action' : 'Take AR-15', ...(isPine ? { scale: 1.3 } : {}) }); // the lever-action is slim: bigger, it fills its orb
    interactables.push(drop.interactable);
    drop.onNear = (inside) => audio.pickupHum(inside); // the orb hums while you stand in its prompt radius
    drop.onPickup = () => { weapons.unlock('rifle'); weapons.select('rifle'); audio.hitMarker(); music.sting('pickup'); hud.toast(isPine ? 'Lever-action rifle acquired · 1/2 to switch, Q to swap, R feeds the tube' : 'AR-15 acquired · 1/2 to switch, Q to swap'); };
    return drop;
  })();
  if (params.get('weapon') === 'rifle' || params.get('weapon') === 'lever') { weapons.unlock('rifle'); weapons.select('rifle', true); rifleDrop?.dispose(); } // dev: start with it
  const ironDrop = (() => {
    if (!wreck || !ironSword) return null;
    const drop = new IronSwordPickup({ scene: game.scene, sky, position: ironSwordSite(wreck, heightAt) });
    interactables.push(drop.interactable);
    drop.onNear = (inside) => audio.pickupHum(inside);
    drop.onPickup = () => { owned.grant('iron-sword'); weapons.unlock('sword-iron'); weapons.select('sword-iron'); audio.hitMarker(); music.sting('pickup'); hud.toast('Iron sword acquired · 1/2 to switch, Q to swap'); };
    return drop;
  })();
  // E314: the iron sword is kept between sessions — taken once, it is yours (and held) on every later visit
  if (ironSword && owned.has('iron-sword')) { weapons.unlock('sword-iron'); weapons.select('sword-iron', true); ironDrop?.dispose(); }
  if (params.get('weapon') === 'iron' && ironSword) { weapons.unlock('sword-iron'); weapons.select('sword-iron', true); ironDrop?.dispose(); }
  // ── Driftwood's adventure (plan Track A: interactables, the quest, the castaway, collectibles; src/game/quest/Adventure.ts) — null on any other shard ──
  const adventure = installAdventure({ game, sky, player, chunk, prompts: interactables, registry, hud, audio, music, inventory, progress, fullMap, animals, ironDrop, setViewmodel: (on) => { weapons.visible = on; }, stowWeapon: (on) => { weapons.stowed = on; }, bridgeFloor: bridge ? (x, z) => bridge.floorHeightAt(x, z) : undefined, pois: { hut, lookout, wreck, shrine, cave: cove }, params, gulls });
  // E315 M12: Driftwood's named places are Sets — what each place's radius holds (src/shards/driftwood-isle/world/places.ts)
  if (adventure !== null && isOcean) {
    const d = dressing;
    placeDriftwoodPlaces(adventure.place, [d.pier?.placed, d.boat?.placed, ...d.jetties.map((j) => j.placed), d.hut?.placed, d.lookout?.placed, d.shrine?.placed, d.bushes?.placed, d.palms?.placed, d.rocks?.placed, d.bridge?.placed,
      ...(d.trailside?.placed ?? []), ...(d.seabed?.placed ?? []), ...(d.cover?.placed ?? []), ...(d.wreck?.placed ?? []), ...(d.cove?.placed ?? []),
      adventure.zipline?.placed, ...adventure.kit.placed], { wreck: [...(d.wreck?.placed ?? []), ...(d.cove?.placed ?? [])] });
  }
  // ── Nalati's adventure (NALATI-MERGE Q1–Q5: the camp's people, the quest line, places with saved discovery on the full map;
  // src/shards/nalati-grasslands/adventure.ts on the shared quest core) — null on any other shard ──
  const nalatiAdventure = installNalatiAdventure({ game, sky, player, chunk, prompts: interactables, registry, hud, audio, music, progress, fullMap, ride, animals, nalati: nalatiNow(), params });
  if (nalatiAdventure) menu.setFinds(() => nalatiFinds(nalatiAdventure.flags)); // Nalati's FINDS: the elites + their prizes, the places (E314 C)
  // ── legendary skins (src/engine/player/Skins.ts): the Ghost stag drops the GHOST STAG crossbow, Old Ironhide the IRONHIDE AR-15 —
  // a big purple floating pickup where the animal fell (WeaponPickup tier 'rare'); taking it swaps the skin (and hands you the
  // rifle if you had not found it). What you own / wear persists; `?skin=ghost-stag` previews, `?drop=ironhide` spawns one ahead.
  const skinDrops: WeaponPickup[] = [];
  const weaponModel = (w: 'crossbow' | 'rifle') => (w === 'rifle' ? rifle?.model ?? null : crossbow instanceof Crossbow ? crossbow.model : null);
  const wearSkin = (skin: SkinDef) => { const m = weaponModel(skin.weapon); if (m) applySkin(m, skin, sky); skins.wear(skin.weapon, skin.id); };
  if (isPine) pineFinish = (id) => {
    const pick = finishPick(skins, id);
    if (!pick) return;
    if (pick.act === 'wear') { wearSkin(pick.skin); return; }
    const m = weaponModel(pick.skin.weapon); if (m) clearSkin(m); skins.wear(pick.skin.weapon, null); // taken off: the plain weapon
  };
  const spawnSkinDrop = (skin: SkinDef, at: THREE.Vector3) => {
    const item = skin.weapon === 'rifle' ? rifle?.displayModel() ?? null : crossbow instanceof Crossbow ? crossbowDisplayModel(crossbow, sky) : null;
    if (!item) return;
    applySkin(item, skin, sky);
    const label = skin.weapon === 'rifle' ? (isPine ? 'lever-action' : 'AR-15') : 'crossbow';
    const toss = Math.random() * Math.PI * 2; // PHYSICS P7-L2: it pops out of the carcass, bounces and settles where it lands
    const drop = new WeaponPickup({ scene: game.scene, item, position: new THREE.Vector3(at.x, Math.max(at.y, heightAt(at.x, at.z)), at.z), tier: 'rare', prompt: `Take the ${skin.name} ${label}`, scale: skin.weapon === 'rifle' ? 1.35 : 1.6, // big — a legendary fills its orb
      toss: { x: Math.sin(toss) * 1.2, y: 3.5, z: Math.cos(toss) * 1.2 } });
    interactables.push(drop.interactable);
    skinDrops.push(drop);
    drop.onPickup = () => {
      skins.own(skin.id); wearSkin(skin);
      if (skin.weapon === 'rifle') { weapons.unlock('rifle'); weapons.select('rifle'); }
      audio.hitMarker();
      hud.toast(`${skin.name} ${label} — ${skin.blurb}`);
      skinDrops.splice(skinDrops.indexOf(drop), 1);
    };
  };
  // Pine Hollow's fights (src/pinehollow/): PH-C3 the four named elites, PH-C2 the Antler King, PH-F1 the ranged kit's feel
  // PH-C11 the loadout: special bolts / cartridges / arrows, the lever gun's + the bow's sounds, the Longbow's grant
  const pineLoadout = rifle instanceof LeverRifle && longbow ? installPineLoadout({ scene: game.scene, sky, weapons, crossbow: crossbow instanceof Crossbow ? crossbow : null, rifle, longbow, inventory, owned, hud, audio, params }) : null;
  if (pineLoadout?.hasRifle === true) rifleDrop?.dispose(); // E314 C: the lever-action is kept once taken — no second one in the cabin
  const pineFights = chunk.slug === 'pine-hollow' && rifle !== null ? installPineCombat({ game, sky, player, animals, weapons, crossbow, rifle, skins, wearSkin, inventory, hud, audio, music, interactables, params,
    longbow: longbow && pineLoadout ? { displayModel: () => longbow.displayModel(), grant: () => { pineLoadout.grantLongbow(); } } : null, ironFirst: () => { pineLoadout?.onPlayerDeath(); } }) : null;
  animals.onKill = (a) => {
    // a sword kill is at arm's length: "Reef crab · 1 m" read as a marker to crabs 30 m off (E296); a shot keeps its distance
    hud.killFeed(meleeShard(chunk) ? `${a.label} killed` : `${a.label} · ${Math.round(a.position.distanceTo(player.position))} m`); progress.recordKill(a.kind, a.variant);
    const skin = isPine ? skinFor(a.kind, a.variant) : null; // the legendary skins are Pine Hollow's (E318 row 4 / E333)
    if (skin && !skins.has(skin.id) && pineFights?.isElite(a) !== true) spawnSkinDrop(skin, a.position); // the legendary's drop, once (a named elite's comes from its own orb)
  };
  // the Compendium (PH-C5 / C4, src/ui/compendium/): the hunter's journal (N, the pause menu, the touch disc) + the trophy wall; chains onKill
  const compendium = installCompendium({ chunkId: legacyShardId(getActiveChunk().slug), game, camera: game.camera, hud, menu, animals, cabins, interactables, weapons, touchUi, nolock });
  // Pine Hollow's adventure (src/shards/pine-hollow/quest/): PH-C1 the lantern quest, PH-C6 the hamlet, PH-C7 the night, PH-C8 collectibles; chains onKill
  const pineQuest = chunk.slug === 'pine-hollow' ? installPineQuest({ game, sky, player, animals, hud, audio, music, inventory, progress, skins, wearSkin, weapons, crossbow: pineLoadout ? { addBolts: (n) => { pineLoadout.addAmmo('iron', n); }, addAmmo: (k, n) => { pineLoadout.addAmmo(k, n); }, room: (k, n) => pineLoadout.room(k, n) } : crossbow, menu, interactables, registry, cabins, landmarks, trees: forest.trees, fullMap, compendium: compendium?.state ?? null, chunkId: legacyShardId(getActiveChunk().slug), params, touchUi, nolock }) : null;
  if (chunk.slug === 'pine-hollow') placePineHollowSets(registry); // E315 M12: every named place is a Set (after the quest has placed its props)
  // E314 stage 1 (src/game/loot/install.ts): the purse + coin chip + kill coin bursts on a shard with `loot.coins` (Driftwood),
  // the Bag's GEAR extras and FINDS tab; chains onKill, so it comes after main's own onKill and the quests' chains
  let shopHold = 0;
  const loot = installLoot({ owned, chunk, game, player, camera: game.camera, animals, audio, menu, flags: adventure?.flags ?? null,
    // stage 2: the trader's shop and what it sells — sharper swords, a bigger heart (topped up by what it adds), the sea chart's marks
    trader: adventure?.trader ?? null, minimap, toast: (t) => { hud.toast(t); },
    swords: [crossbow, ironSword].filter((w): w is Sword => w instanceof Sword),
    setMaxHealth: (m) => { const was = maxHealth; maxHealth = m; health = Math.max(0, Math.min(m, health + Math.max(0, m - was))); },
    hold: (on) => { // the shop screen releases the lock and the sword like Pine Hollow's slate; its close takes them back
      window.clearTimeout(shopHold);
      weapons.stowed = on;
      if (on) { hud.holdPause = true; weapons.setEnabled(false); if (document.pointerLockElement) document.exitPointerLock(); return; }
      weapons.setEnabled(!player.swimming);
      hud.onResume?.();
      shopHold = window.setTimeout(() => { hud.holdPause = false; if (!nolock && !touchUi() && !document.pointerLockElement && hud.entered && !menu.isOpen) hud.setPaused(true); }, 450);
    } });
  // E314 stage 3: the body shadow (ShardManifest.bodyShadow, src/engine/player/BodyShadow.ts) — hidden off play (the title, a practice
  // room, the free camera / tour) — and Driftwood's keepsakes (src/shards/driftwood-isle/loot/keepsakes.ts): the sea glass chime + charms,
  // the trophy plaques and drops, the captain's hat; chains onKill after the loot's coin bursts
  const bodyShadow = chunk.bodyShadow === true
    ? installBodyShadow({ game, player, hidden: () => !hud.entered || practiceRoom.open || world.freeCamera || world.tour.active || explore?.active === true })
    : null;
  if (adventure !== null && isOcean) installKeepsakes({ owned, adventure, sky, game, player, animals, hud, audio, music, registry, body: bodyShadow,
    swords: [crossbow, ironSword].filter((w): w is Sword => w instanceof Sword) });
  for (const w of ['crossbow', 'rifle'] as const) { const s = skins.wearing(w); if (s) wearSkin(s); }
  new Combat(game, animals, weapons, game.camera); // health bars over animals + MMO-style damage / MISS floats (self-wiring); Combat only taps onFire / onImpact, which the manager forwards for every weapon
  // taking a hit (B3): the arc points at the attacker (src/engine/ui/HurtArc.ts), a hurt grunt panned toward it (Audio.hurt — it
  // used to be the landing thud), and the killer is remembered for the death toast (B2)
  const hurtArc = new HurtArc();
  let killer: Killer | null = null;
  animals.onCharge = (a, raw) => {
    if (player.dodging && dodgeGuard(owned)) return; // E314 the boar tusk: a hit that lands while a dodge carries you does nothing
    const dmg = hitDamage(chunk, raw, a.kind); // the shard's per-hit cap (E294: Driftwood 20; the captain is exempt)
    health = Math.max(0, health - dmg); lastHurt = performance.now(); hud.damageFlash(); music.combat(0.9);
    killer = { kind: a.kind, label: a.label };
    if (meleeShard(chunk) || pineFights !== null) hurtArc.hit(a.position.x, a.position.z, player.position, player.yaw, dmg); // the direction arc: the melee shards (D8; Nalati F2) + Pine Hollow (PH-F1)
    if (meleeShard(chunk) || pineFights !== null) CameraFX.for(game).addTrauma(Math.min(0.85, 0.3 + dmg / 40)); // a trauma² shake (C3; Pine Hollow PH-F1)
    player.shove(a.position.x, a.position.z, 5 + Math.min(4, dmg * 0.15)); // knocked back a step, through the controller (PHYSICS P2)
    const dx = a.position.x - player.position.x, dz = a.position.z - player.position.z, d = Math.hypot(dx, dz);
    audio.hurt(dmg / 20, d > 0.3 ? ((dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)) / d) * 0.7 : 0);
  };
  // footsteps (B9): the island asks its surface map — planks on every deck, stone on the shrine dais, sand / wet sand / grass /
  // rock off them as the terrain paints it, an ankle splash in the shallows — pitched and levelled by speed; Pine Hollow as before
  const surfaces = sea ? new SurfaceMap({ sea: sea.level, heightAt, trailDistance, decks: [pier, ...jetties, boat, hut, lookout, bridge, wreck], stone: [shrine] }) : null;
  // the island's zoned soundscape + reverb rooms (S1 / S2): surf on the shoreline, palms, jungle, cove + waterfall, lookout wind; hold / cave / shrine reverb
  animals.onSound = (name, pos) => { audio.animal(name, pos, player.position, player.yaw); }; // the generated samples (E318 row 23: the island's crab / monkey / sailor / boar calls too, not the procedural bank)
  // the sword's combat layers on the island (S3 bank via IslandSfx; Pine Hollow has no sword): a whoosh per swing, an impact per blade
  // hit by material (+ a death bark), a clang where the blade meets a wall / trunk, each enemy wind-up's cue (C5)
  if (islandSfx) {
    swordEvents.onSwing = (speed, heavy, dir) => { islandSfx.whoosh(speed, { heavy, dir }); };
    swordEvents.onStrike = (kind, point, strength, killed) => {
      islandSfx.impact(kind === 'crab' ? 'shell' : kind === 'sailor' ? 'wood' : 'flesh', strength, point);
      const enemy = kind === 'boar' || kind === 'crab' || kind === 'monkey' || kind === 'sailor' ? kind : null;
      if (killed && enemy !== null) islandSfx.vocal(enemy, point, 1.3);
    };
    swordEvents.onClang = (point, strength, clang) => { islandSfx.impact(clang, strength, point); }; // stone / wood by what the tip met (P5)
    animals.onWindup = (a) => { const e = a.kind === 'crab' ? 'crab' : a.kind === 'sailor' ? 'sailor' : a.kind === 'boar' || a.kind === 'bear' ? 'boar' : null; if (e !== null) islandSfx.windup(e, a.position); };
  }
  // E297 fight rules (Driftwood): an amber edge chevron toward an enemy winding up where you can't see it (src/engine/ui/WindupWarn.ts);
  // chained after the wind-up's sound cue
  const windupWarn = chunk.fight !== undefined ? new WindupWarn<(typeof animals.animals)[number]>() : null;
  if (windupWarn !== null) { const cue = animals.onWindup; animals.onWindup = (a, dur) => { cue?.(a, dur); windupWarn.start(a, dur); }; }
  const ambience = sea ? new IslandAmbience(audio, { sea: sea.level, heightAt, palms: palmSpecs, wreck, cove: Cove.forIsland() }) : chunk.slug === 'pine-hollow' ? new ForestAmbience(audio, { heightAt, cabins }) : null; // PH-A2
  if (ambience instanceof ForestAmbience) pineFights?.useSfx(ambience.sfx); // the King's bells / stomp / roar, the thralls
  if (ambience instanceof ForestAmbience) pineQuest?.useSfx(ambience.sfx); // the NPC barks, the lanterns, the zipline, the night's thralls
  if (ambience instanceof ForestAmbience) pineLoadout?.useSfx(ambience.sfx); // the lever gun's shot / echo / cycle, the bow's draw
  // the A-rows' audio wiring: the clock → night beds + calm-night music, an engaged elite → combat, the layout's zones, deer snorts, doors
  if (ambience instanceof ForestAmbience) installPineAudio({ game, sky, music, ambience, animals, cabins, eliteEngaged: () => pineFights?.eliteEngaged() ?? false, params });
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
    return { animals: alive, near, motors, chase, flee, elite: pineFights?.eliteEngaged() === true ? 1 : 0, bodies: ph?.world.bodies.len() ?? 0, colliders: ph?.world.colliders.len() ?? 0, 'fx chips': Impacts.for(game).mesh.count };
  });
  // PH-B2: the cave's bed and reverb deeper in than the mouth's spot (the passage, the squeeze, the room)
  if (ambience instanceof ForestAmbience) for (const s of landmarks?.crags?.caveSpots() ?? []) ambience.addSpot({ zone: 'cave', ...s, fade: 3 });
  // PH-L10 / C7: the dawn fog + the showers (the sky, the fog, the wet PBR, the rain, the puddles, the rings, the herds' shelter)
  const pineWeather = chunk.slug === 'pine-hollow' ? installPineWeather({ game, sky, trees: forest.trees, animals, particles, ambience: ambience instanceof ForestAmbience ? ambience : null, roofAt: (x, z) => cabins?.floorHeightAt(x, z) !== undefined || (landmarks?.crags?.inCave(x, z) ?? false), stagAt: () => pineQuest?.stagAt() ?? null, viewer, horizonVeil: dressing.horizon.painted?.veil ?? null }) : null;
  if (pineWeather) pineLoadout?.useRain(() => pineWeather.weather.rain); // wet bolts drop, pitch-tipped ones fly true
  // PH-M5 / F2: the forest's small life (ravens to a kill, the owl, a woodpecker, hares, the ravens' breadcrumbs) in one draw,
  // and the harvest's skinning beat; the carcass waits for the ravens (src/shards/pine-hollow/life/)
  const pineLife = chunk.slug === 'pine-hollow' ? installPineLife({ game, sky, player, animals, weapons, audio, sfx: ambience instanceof ForestAmbience ? ambience.sfx : null, trees: forest.trees, trunks: forest.factory.variants, params,
    places: compendium ? () => compendium.state.def.entries.flatMap((e) => (e.place ? [{ id: e.id, ...e.place }] : [])) : null,
    visited: (id) => compendium?.state.reached(id, 'seen') ?? true, inCombat: () => music.state.mode === 'combat' }) : null;
  player.onStep = (sprinting) => {
    const p = player.position;
    if (islandSfx && surfaces && !(player.wading && player.depth > 0.3)) islandSfx.footstep(player.wading ? 'water' : surfaces.surfaceAt(p.x, p.z, p.y), Math.hypot(player.velocity.x, player.velocity.z));
    else if (player.wading) audio.wadeStep(player.depth, sprinting);
    else { const hoof = audio.hoofSurfaceAt?.(p.x, p.z); audio.footstep(sprinting, hoof !== undefined ? (hoof === 'wood' ? 'planks' : hoof) : pier?.floorHeightAt(p.x, p.z) !== undefined ? 'planks' : sea !== undefined && heightAt(p.x, p.z) - sea.level < 2.6 ? 'sand' : ambience instanceof ForestAmbience ? ambience.stepSurface(p.x, p.z, p.y) : 'litter'); } // Nalati: its hoof ground (src/shards/nalati-grasslands/sound.ts); Pine Hollow: ForestAmbience's ground (PH-A3)
  };
  // Nalati's boss fights (src/shards/nalati-grasslands/kurganBoss.ts, B13): the Golden King needs the animals, the kit and the HUD
  nalatiNow()?.bindPlay({
    kit: nalatiKit, health01: () => health / maxHealth, toast: (text) => hud.toast(text), flash: () => hud.damageFlash(),
    hurt: (dmg) => { killer = { cause: 'Thrown from the saddle' }; health = Math.max(0, health - dmg); lastHurt = performance.now(); hud.damageFlash(); audio.land(true); }, // a throw / a bolt (Mount, Taming)
  }); // Nalati's creatures: brace kills, knock-downs, howl / stampede toasts
  // Nalati's weather (src/shards/nalati-grasslands/weather.ts, B10): the storm's audio beds + thunder, and a lightning strike's 60 damage
  nalatiNow()?.sound?.bind(audio, music); // Nalati's sound (B16 audio): hoof ground, the steppe bed, the music's steppe mood
  nalatiNow()?.weather.bind({ audio, hurt: (dmg, why) => { killer = { cause: 'Struck by lightning' }; health = Math.max(0, health - dmg); lastHurt = performance.now(); hud.damageFlash(); hud.toast(why); audio.land(true); } });
  nalatiNow()?.boss.bind({
    animals, setWeaponsEnabled: (on) => { weapons.setEnabled(on); }, bow: nalatiKit?.bow ?? null, refill: () => { nalatiKit?.refill(); }, interactables, params,
    toast: (s) => { hud.toast(s); }, feed: (s) => { hud.killFeed(s); }, pickupHum: (on) => { audio.pickupHum(on); },
    music: (e) => { if (e === 'death' || e === 'pickup') music.sting(e); else if (e === 'victory') music.sting('chunk'); else music.combat(1); },
  });
  // Nalati's named elites (src/shards/nalati-grasslands/elites.ts, B12): lairs, bars, banners, drops — taming (B8) hands in when it is wired
  nalatiNow()?.elites.bind({
    animals, wildlife, taming: ride?.taming ?? null, ghosts: null, interactables, params,
    toast: (s) => { hud.toast(s); }, feed: (s) => { hud.killFeed(s); }, record: (k, v) => { progress.recordKill(k, v); progress.recordEvent(k); },
    pickupHum: (on) => { audio.pickupHum(on); }, sound: (n, at) => { audio.animal(n, at, player.position, player.yaw); },
    sting: (e) => { if (e === 'kill') music.sting('chunk'); else music.combat(e === 'phase2' ? 1 : 0.8); },
  });
  // Nalati's Storm Titan (src/shards/nalati-grasslands/stormTitan.ts, B14): the cairn prompt, the fight, Naizagai (the sabre upgrade) once won
  nalatiNow()?.titan.bind({
    animals, wildlife, ride, sabre: nalatiKit?.sabre ?? null, setWeaponsEnabled: (on) => { weapons.setEnabled(on); }, refill: () => { nalatiKit?.refill(); }, interactables, params,
    hurt: (dmg, why) => { killer = { kind: 'storm-titan', label: 'the Storm Titan' }; health = Math.max(0, health - dmg); lastHurt = performance.now(); hud.damageFlash(); if (why) hud.toast(why); audio.land(true); },
    toast: (s) => { hud.toast(s); }, feed: (s) => { hud.killFeed(s); }, record: (k, v) => { progress.recordKill(k, v); progress.recordEvent(k); }, pickupHum: (on) => { audio.pickupHum(on); },
    ownSkin: (id) => { nalatiNow()?.skins.own(id); },
    music: (e) => { if (e === 'death' || e === 'pickup') music.sting(e); else if (e === 'victory') music.sting('chunk'); else music.combat(1); },
  });
  if (ride) ride.taming.onBreaking = (on) => { weapons.visible = !on; weapons.setEnabled(!on); }; // both hands in the mane while he bucks
  if (ride) ride.taming.onBonded = () => { progress.recordEvent('tame'); }; // B15: the Horse Sense achievement
  if (gulls) gulls.onCall = (pos) => audio.gullCallAt(pos, player.position, player.yaw);
  player.onEnterWater = (impact) => audio.splash(impact);
  let submerged = false; // the score's underwater state, given back when this shard plays again (E155)
  player.onSubmerge = () => { submerged = true; audio.dive(); islandSfx?.plunge(false); audio.setUnderwater(true); ambience?.setUnderwater(true); music.setState({ underwater: true }); };
  player.onSurface = () => { submerged = false; audio.surface(); islandSfx?.plunge(true); audio.setUnderwater(false); ambience?.setUnderwater(false); music.setState({ underwater: false }); };
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
  player.onLand = (hard) => { audio.land(hard); if (hard) { health = Math.max(0, health - 8); hud.damageFlash(); if (health <= 0) killer = null; } };
  // ── death (E295): a fade to dark with a "Mauled by a brown bear / respawning at Wreck Cove" card (src/engine/ui/DeathFade.ts),
  // the respawn under the dark at the last named place you reached (src/game/LastPlace.ts; Driftwood's places, the spawn
  // when none), input frozen and no hit taken until the view is back. A boss fight's death keeps its own checkpoint. ──
  const deathFade = new DeathFade();
  const placePts = adventure?.places?.points ?? null;
  const lastPlace = placePts !== null ? new LastPlace(() => placePts) : null;
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
        && !player.carried && player.ride === null && (sea === undefined || floor > sea.level + 0.3);
      lastPlace.observe({ x: p.x, y: floor ?? p.y, z: p.z, grounded });
    }, 'last place');
  }
  const chargeHit = animals.onCharge;
  animals.onCharge = (a, dmg) => { if (!deathFade.active) chargeHit(a, dmg); }; // no hit lands while the view is dark
  const die = (by: Killer | null): void => {
    const stand = lastPlace?.stand ?? null;
    music.sting('death');
    player.carried = true; weapons.setEnabled(false); // frozen: the fixed step leaves the body alone, no swing / shot
    deathFade.play(deathCause(by), respawnWhere(chunk, stand !== null && stand.id !== 'pier' ? placeName(stand.label) : null), {
      dark: () => { if (stand !== null && stand.id !== 'pier') player.spawn(stand.x, stand.z, stand.yaw, stand.y); else toSpawn(); }, // the pier IS the spawn (E308: half way down it, facing the island)
      done: () => { player.carried = false; weapons.setEnabled(!player.swimming); },
    });
  };
  // ── first-time control hints (E308, src/engine/ui/FirstHints.ts: every shard's one system; after main's onJump / onDodge, which
  // it chains): a label + pulsing ring on the touch control the first time it matters. Driftwood feeds its six triggers
  // (src/shards/driftwood-isle/firstMinutes.ts); another shard shows none until it feeds its own ──
  const firstHints = new FirstHints(player, { touch: touchControls.active, paused: () => !hud.entered || hud.paused || deathFade.active || away() || world.freeCamera || world.tour.active });
  const promptEl = document.querySelector<HTMLElement>('#hud .ws-game-prompt');
  const firstMinutes = chunk.slug === 'driftwood-isle' ? installFirstMinutes({
    hints: firstHints, animals: () => animals.animals, player,
    onWindup: (fn) => { const prev = animals.onWindup; animals.onWindup = (a, dur) => { prev?.(a, dur); fn(a); }; },
    prompt: () => (promptEl?.classList.contains('show') === true ? promptEl.textContent : ''),
  }) : null;
  game.onUpdate((dt) => { firstMinutes?.(dt); firstHints.update(dt); }, 'first hints');

  // ── menu ↔ world: the world is fully loaded, then sits frozen and silent under the menu (hero art
  // covers the canvas) until ENTER WORLD; "Exit to main menu" freezes it again — no reload, no
  // loading screen. `?skipintro=1` (bench / screenshots) and `?tour=1` go straight to the world.
  const tour = world.tour;
  // a GPU-recovery reload (E61) skips the title: straight back into the world at the saved spot, under the pause menu
  const resuming = params.has(RELOAD_PARAM);
  const arrival = first ? bootArrival : null;
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
    arena.exit(); playground?.exit(); playground = null; minimap.setPracticeArena(null); menu.setPractice(false); setAimTargets(painterly ? aimList : animals.animals); fromTitle = true; weapons.setEnabled(false); perf.setActive(false); audio.worldMuted = true; music.setState({ mode: 'menu' }); noteDisc.classList.remove('show');
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
      pg = await loadPlayground(id, { game, player, registry, physics: world.physics, spawn: chunk.spawn, toast: (t) => { hud.toast(t); }, ride, animals });
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
    beginNineExploreEntry(mode);
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
    recordNineBootCheckpoint('explore:imported');
    explore ??= new X({ world, onExit: exitExplore, onPractice: () => { hud.enterArenaNow(); }, onPlayground: (id) => { void enterPlayground(id); }, openFeedback: () => { void noteSheet(); }, hide: [boundary.group], creatures: animals.animals,
      overhead: [grass?.group, under?.group, particles?.group, gulls?.group, dressing.cover?.group].filter((g) => g !== undefined) });
    const t2 = performance.now();
    recordNineBootCheckpoint('explore:constructed');
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
  if (cabins) for (const it of cabins.interactables) setSight(it, { slack: 0.75 });
  const carcassAt = new THREE.Vector3();
  let prompt: string | undefined;
  let nearest: (typeof interactables)[number] | undefined;
  let carcass: (typeof animals.animals)[number] | undefined;
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyE' || !hud.entered) return;
    if (nearest) { tap.use?.(nearest.label); nearest.onInteract(); }
    else if (carcass && pineLife?.busy !== true) {
      harvested.add(carcass);
      const drops = inventory.harvest(carcass.kind, carcass.variant); // Pine Hollow: only what Mott takes (E314 C)
      const give = (): void => {
        const got = drops.filter((id) => inventory.add(id)); // the toast names only what went in
        hud.toast(`${got.map((id) => ITEMS[id].label).join(' + ') || 'Nothing'} harvested · ${inventory.total} in the pack`);
        audio.hitMarker();
      };
      if (pineLife) pineLife.harvest(carcass, give); // PH-F2: the skinning beat, then the drops; the carcass stays for the ravens
      else { give(); carcass.fadeOut(); }
    }
  });

  let musicPoll = 0;
  const steppeMusic = chunk.style === 'painterly';
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
        const noticed = animals.animals.some((a) => a.alive && (a.state === 'alert' || a.state === 'stalk') && (!steppeMusic || a.aggressive) && a.position.distanceTo(player.position) < 40);
        music.setState({ mode: noticed ? 'alert' : 'calm', intensity: noticed ? 0.5 : 0 });
      }
    }
    boundary.update(dt, t);
    ocean?.update(dt);
    boat?.update(dt);
    palms?.update(dt);
    gulls?.update(dt, player.position);
    if (bridge && bridgeDeck?.awake === true) bridge.setPoses(bridgeDeck, game.alpha);
    seabed?.update(dt);
    cove?.update(dt); shrine?.update(dt); enemies?.update(dt, t, player.position);
    if (dayNight) { shrine?.setDusk(dayNight.dusk); if (ambience) ambience.night = dayNight.night; }
    if (sky.pine && ambience instanceof ForestAmbience) ambience.dawn = sky.pine.dawn; // PH-L2: the dawn chorus on Pine Hollow's clock
    mark('world');
    hands.update(dt, player);
    mark('player');
    horizon.update(dt, game.camera);
    grass?.update(dt, viewer());
    under?.update(dt, viewer());
    particles?.update(dt, viewer(), game.camera);
    cabins?.update(dt, t);
    nalati?.update(dt, t);
    mark('world');
    // swimming holsters the weapon (hands only; Hands.ts follows)
    if (player.swimming !== swimHold) { swimHold = player.swimming; weapons.visible = !swimHold; weapons.setEnabled(!swimHold); }
    unmark();
    animals.update(dt, t, player.position, player.sprinting, viewer(), game.camera); // drawn by distance to the viewer (Explore's free camera), AI by the player (E125); the camera for the far herd (PH-P2)
    if (painterly) { aimList.length = 0; for (const a of animals.animals) if (a.mem['hidden'] !== 1 && a.mem['owned'] !== 1 && a !== riding.horse) aimList.push(a); const heart = nalati?.titan.lockTarget() ?? null; if (heart !== null) aimList.push(heart); } // + Jel Ata's heart for the lock-on (NALATI-MERGE H3)
    mark('animals');
    weapons.update(dt, t); // every weapon ticks (bolts in flight keep flying while the rifle is out)
    pineLoadout?.update(dt); weaponStrip.update();
    rifleDrop?.update(dt, t, game.renderer, game.camera);
    ironDrop?.update(dt, t, game.renderer, game.camera, player.position); // walk-to-pick-me-up
    for (const d of skinDrops) d.update(dt, t, game.renderer, game.camera);
    mark('player');
    audio.listenerYaw = player.yaw;
    shrineHum?.update(game.camera);
    ambience?.update(dt, game.camera);
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
      let fighting = performance.now() - lastHurt < 3000;
      for (const a of animals.animals) {
        if (fighting) break;
        fighting = a.alive && a.aggressive && (a.state === 'attack' || a.state === 'stalk' || a.state === 'charge') && a.position.distanceToSquared(player.position) < 25;
      }
      if (fighting) prompt = undefined;
    }

    // slow health regen; death → respawn at the gate
    if (health < maxHealth && performance.now() - lastHurt > 6000) health = Math.min(maxHealth, health + dt * 4);
    // death → the fade + card name the killer and where you come back (die, E295); only a weapon with ammo is topped up.
    // A death in a boss fight is handled there (back at the phase checkpoint): Nalati's King / Titan, Pine Hollow's Antler King
    deathFade.update(dt);
    if (deathFade.active) health = maxHealth; // nothing else (a fall, lightning) kills you twice under the fade
    if (health <= 0) {
      health = maxHealth; audio.death(); hud.damageFlash();
      if (ride?.mounted === true) ride.mount.dismount();
      if (pineFights?.onPlayerDeath() !== true && nalati?.boss.onPlayerDeath() !== true && nalati?.titan.onPlayerDeath() !== true) die(killer);
      if (crossbow.hasAmmo) crossbow.addBolts(30 - (crossbow.state.bolts ?? 30));
      killer = null; nalatiKit?.refill(); pineLoadout?.onPlayerDeath();
    }
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
      ammoLabel: weapons.current.ammoLabel, weaponName: weapons.current.name, segments: weapons.current.segments,
      health, maxHealth, pos: { x: player.position.x, z: player.position.z }, yaw: player.yaw, kills,
      prompt, speed: player.speedFactor, ads: weapons.state.ads,
    });
    mark('hud');
  }, 'main');

  // `?at=x,y,z,yaw,pitch` — a review note's repro URL (src/engine/ui/Feedback.ts reproUrl) starts you on the spot it was filed from
  const at = (params.get('at') ?? '').split(',').map(Number);
  if (at.length >= 3 && at.every((v) => Number.isFinite(v))) {
    const [x = 0, y = 0, z = 0, yaw = player.yaw, pitch = 0] = at;
    player.position.set(x, y, z); player.yaw = yaw; player.pitch = pitch;
  }
  // back from a GPU-recovery reload (E54): the pose is applied; take it off the address so a later reload spawns as usual
  if (params.has(RELOAD_PARAM)) { const u = new URL(location.href); u.searchParams.delete(RELOAD_PARAM); u.searchParams.delete('at'); history.replaceState(history.state, '', u); }

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
    const banks = await step('audio', (p) => (audioLoad ?? startAudioPreload(files, chunk)).wait(p));
    if (banks.music) music.useBank(banks.music); // the title theme's first gesture plays the stems at once
    if (banks.steppe) music.steppe.useBank(banks.steppe); // Nalati's own score: its first slot + stings (NALATI-MERGE A2)
    audio.useSamples(banks.sfx);
  }
  (plan as unknown as { done: () => void }).done(); // throws unless both tracks are exactly 1
  releaseByteCounter();
  // an app switch that takes the GPU (iOS): hold the loop, restore in place or reload where the player stood (E54)
  if (resuming) hud.setPaused(true); // RESUME is the gesture that brings the audio back (enter)
  const recoveryInstalledAt = performance.now();
  installGpuRecovery({ game, rebuild: () => { sky.rebuildEnvironment(); }, pose: () => (hud.entered ? { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, pitch: player.pitch } : null), resumed: resuming,
    fragileBoot: () => TIER === 'phone' && performance.now() - recoveryInstalledAt < 20_000,
    parked: () => hostRef?.isParked(slug) === true, onLostParked: () => { hostRef?.evict(slug); } }); // a parked shard that loses its context is evicted (E155)
  bootGpuGuardActive = false;
  if (fragileBoot) game.canvas.removeEventListener('webglcontextlost', onBootContextLost);
  setPoseProvider(() => (hud.entered ? { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, pitch: player.pitch } : null)); // the Look Lab's reload prompt comes back right here (E65)
  await loading.done();
  app.events.emit('level.loaded', { id: slug });
  app.setState(hud.entered ? 'play' : 'title');
  game.start(); // keep the full render loop out of the loader's 100% fade and its transient boot-memory peak
  if (arrival?.mode === 'enter' || arrival?.mode === 'arena') enter();
  else if (arrival?.mode === 'explore') hud.startExplore(); // import the viewer only after shader compilation and the loader's peak
  const arenaArrival = consumeArenaArrival(slug);
  if (arrival?.mode === 'arena' || arenaArrival) hud.enterArenaNow();
  if (deferredAudio) {
    const decodeAfterBoot = async (): Promise<void> => {
      try {
        const banks = await deferredAudio.decode();
        if (banks.music) music.useBank(banks.music);
        audio.useSamples(banks.sfx);
      } catch (error) {
        console.info(`[audio] deferred Nine Dragon decode: ${error instanceof Error ? error.message : String(error)} — the synth plays`);
      }
    };
    requestAnimationFrame(() => { window.setTimeout(() => { void decodeAfterBoot(); }, 0); });
  }
  // E183: while the title idles, fetch the Explore code and draw the world's first frame once under the title art. The
  // first frame after the title paid every first-time cost at once — Pine Hollow's four elites built, the cover filled,
  // textures that arrived after the boot uploaded: EXPLORE WORLD's first tap stalled ~1.3 s at 4× CPU (and ENTER WORLD's
  // first frame the same). A return from the background already draws such a frame on the title (Game.start).
  if (menuFirst) window.setTimeout(() => {
    if (hostRef?.isParked(slug) === true || hud.entered || exploring()) return;
    if (chunk.explore !== undefined) void import('#engine/explore/Explore');
    game.primeFrame();
  }, TITLE_IDLE_MS);
  const handle = { ...world, boundary, water, streams: dressing.streams, ocean, pier, jetties, boat, hut, lookout, wreck, shrine, bushes, gulls, bridge, bridgeDeck, cove, enemies, hands, grass, under, particles, cabins, props, animals, interactables, crossbow, hud, audio, music, shrineHum, islandSfx, surfaces, ambience, lockSys, lockState, wildlife, nalati: nalatiNow(), ride, weapons, pineLife, arena, playground: (): Playground | null => playground };
  const probe = installProbe(handle, { bootSteps, health: () => health, quest: () => ({ driftwood: adventure?.flags.all.slice().sort() ?? [], nalati: nalatiAdventure?.flags.all.slice().sort() ?? [] }) });
  document.dispatchEvent(new Event('ws:ready')); // booted to the title: the native shell's update watchdog (src/engine/native/boot.ts) waits for this
  // E158: the other shards' boot files into the worker's cache, in the background — once a page (the shell's, not a shard's)
  if (first) asShell(() => { startShardPrefetch(getActiveChunk()); });


  // ── the shard host's handles on this world (src/engine/shard/ShardHost.ts, E155) ──
  return {
    slug, handle, renderer: game.renderer, scene: game.scene, bootSteps,
    park: () => {
      if (hud.entered) hud.exitToMenu(); // in the world (the complete card's Next shard): to its title first, as the pause menu's exit does
      weapons.setEnabled(false); perf.setActive(false);
      audio.worldMuted = true;
      game.stop();
      const freed = game.releaseTargets(); // E179: the canvas, the post chain's targets and the shadow maps, back at resume
      if (freed > 0) console.info(`[shard] ${slug} parked: ~${Math.round(freed / 1e6)} MB of render targets released`);
      audio.park(true);
    },
    activate: (req) => {
      audio.park(false);
      music.attach(audio);
      music.setState({ shard: mood, mode: 'menu', intensity: 0, underwater: submerged });
      game.resume();
      brand();
      window.__wildshard = probe;
      if (req.arena === true) hud.enterArenaNow();
      else if (req.explore === true && chunk.explore !== undefined) hud.startExplore();
      else if (req.enter === true) { fromTitle = false; hud.enterNow(); } // where the player left off: no respawn at the gate (E121 is for the same shard's title)
    },
    dispose: () => {
      loot.dispose(); // E314: the coin chip leaves #hud, the purse's last write
      windupWarn?.dispose(); // E323: its ResizeObserver off, its marks out of #hud
      game.dispose();
      world.physics.dispose();
      audio.evict();
      if ('__wildshard' in window && window.__wildshard.world === handle) Reflect.deleteProperty(window, '__wildshard');
    },
  };
}
main().catch((e: unknown) => {
  markNineBootHandledError();
  if (!bootFatalShown) showError(e instanceof Error ? `${e.name}: ${e.message}` : String(e), e instanceof Error ? e.stack ?? '' : '');
});
