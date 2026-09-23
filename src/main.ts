import * as THREE from 'three';
import { bootstrap } from './core/bootstrap';
import { CHUNK_HALF, ROAD_LENGTH } from './core/config';
import { hasPond, heightAt, trailDistance, CABIN_SITES } from './world/Heightfield';
import { Boundary } from './world/Boundary';
import { Water } from './world/Water';
import { Ocean } from './world/Ocean';
import { Pier } from './world/Pier';
import { Boat } from './world/Boat';
import { Boulders } from './world/Boulders';
import { Hut } from './world/Hut';
import { Palms } from './world/Palms';
import { GroundCover } from './world/GroundCover';
import { HUT, LOOKOUT, WRECK, SHRINE, JETTIES, BRIDGE } from './chunks/driftwood-isle';
import { RopeBridge } from './world/RopeBridge';
import { Seabed } from './world/Seabed';
import { Cove } from './world/Cove';
import { Enemies } from './entities/Enemies';
import { Lookout } from './world/Lookout';
import { Wreck } from './world/Wreck';
import { Shrine } from './world/Shrine';
import { Bushes } from './world/Bushes';
import { Gulls } from './world/Gulls';
import { Trailside } from './world/Trailside';
import { Hands } from './player/Hands';
import { Sword, swordEvents } from './player/Sword';
import { CameraFX } from './player/CameraFX';
import { IronSwordPickup, ironSwordSite } from './player/IronSword';
import { installAdventure } from './game/quest/Adventure';
import type { Weapon } from './player/Weapon';
import { Horizon } from './world/Horizon';
import { Grass } from './world/Grass';
import { Undergrowth } from './world/Undergrowth';
import { Particles } from './world/Particles';
import { Cabins } from './world/Cabin';
import { Props } from './world/Props';
import { AnimalManager } from './entities/AnimalManager';
import { Crossbow, startViewmodelTextures, viewmodelTexturesReady, type Targets, type TargetHit } from './player/Crossbow';
import { Rifle } from './player/Rifle';
import { Weapons, type WeaponId } from './player/Weapons';
import { WeaponPickup } from './player/WeaponPickup';
import { SKINS, SkinLocker, applySkin, crossbowDisplayModel, skinFor, type SkinDef, type SkinId } from './player/Skins';
import { TouchControls } from './player/TouchControls';
import { HUD } from './ui/HUD';
import { LockOn } from './ui/LockOn';
import { SpeedLines } from './ui/SpeedLines';
import { buzz, HAPTIC } from './ui/haptics';
import { Loading } from './ui/Loading';
import { Perf } from './ui/Perf';
import { Minimap } from './ui/Minimap';
import { FullMap } from './ui/Map';
import { GameMenu } from './ui/Menu';
import { Progress } from './game/Progress';
import { Inventory, harvestOf, ITEMS } from './game/Inventory';
import { getNumber, onNumber } from './ui/Settings';
import { KeepAlive } from './core/KeepAlive';
import { Combat } from './ui/Combat';
import { HurtArc, deathLine } from './ui/HurtArc';
import { setAimTargets, meleeLock } from './player/AimTargets';
import { createBootPlan, macrotask, slicer, type StepRunner } from './boot/plan';
import { declareTotals, installByteCounter } from './boot/bytes';
import { bootFiles, extraFetches, startAudioPreload, startMenuPreload } from './boot/extras';
import { bootFetches, prefetch, prefetchAfter } from './boot/prefetch';
import { packFor, streamPack } from './boot/pack';
import { getActiveChunk } from './chunks/registry';
import { Audio } from './audio/Audio';
import { Music } from './audio/Music';
import { ShrineHum } from './audio/ShrineHum';
import { IslandSfx } from './audio/IslandSfx';
import { SurfaceMap } from './audio/Surface';
import { IslandAmbience } from './audio/IslandAmbience';
import { installErrorModal, showError } from './ui/ErrorModal';
import { onReview, queuedCount, quickNote } from './ui/review';
import { rotateGated } from './ui/RotateGate';
import type { Feedback } from './ui/Feedback';
import type { Explore, ExploreMode } from './explore/Explore';
import { TIER } from './core/tier';

// live animal positions for the compass, reused buffers (no per-frame allocations in the update loop)
const _animalXZ: { x: number; z: number }[] = [];
function animalPositions(list: { position: { x: number; z: number }; alive?: boolean }[]) {
  let n = 0;
  for (const a of list) { if (a.alive === false) continue; const p = _animalXZ[n] ??= { x: 0, z: 0 }; p.x = a.position.x; p.z = a.position.z; n++; }
  _animalXZ.length = n;
  return _animalXZ;
}

installErrorModal(); // before anything can throw
async function main() {
  const loading = new Loading();
  // The boot plan: DOWNLOAD = bytes read / bytes declared, SETUP = weighted steps (src/boot/plan.ts).
  // Declared bytes come from the chunk's file list; every /assets fetch is counted on its way in.
  const files = bootFiles(getActiveChunk()); // + the title / explore art and every audio file (project/archive/2026-09-23-preload-offline.md)
  const plan = createBootPlan((view) => loading.paint(view), { totals: declareTotals(files) });
  installByteCounter(plan, files);
  // a boot that throws shows WHY: the loading panel's foot line + the uncaught-exception modal (src/ui/ErrorModal.ts)
  window.addEventListener('unhandledrejection', (e) => plan.fail(`BOOT FAILED · ${String((e.reason as { message?: string } | null | undefined)?.message ?? e.reason)}`.slice(0, 300)));
  window.addEventListener('error', (e) => plan.fail(`BOOT FAILED · ${e.message} @ ${e.filename.split('/').pop()}:${e.lineno}`.slice(0, 300)));
  const step: StepRunner = (key, work) => plan.step(key, work).then((p) => p.value);
  // let the service worker take control first (≤ 2.5 s, never fatal) so the first visit's bytes are cached
  await window.__ws_sw?.ready;
  // this shard's files in flight now, in step order; each step builds as its files land — as one pack when the build has
  // one (src/boot/pack.ts), else file by file (src/boot/prefetch.ts); anything the pack lacks still goes file by file
  const pack = packFor(getActiveChunk());
  const packed = new Set(pack ? pack.files.map(([p]) => p) : []);
  const packStreamed = pack ? streamPack(pack, plan, files) : Promise.resolve();
  prefetch(bootFetches(getActiveChunk(), files).filter((p) => !packed.has(p)));
  // then the title art and ALL audio (project/archive/2026-09-23-preload-offline.md), after the pack so they do not split the pipe with the
  // world's files; the selected style + set are decoded as their bytes land — nothing is fetched after the bar
  prefetchAfter(extraFetches(files), packStreamed);
  const menuLoad = startMenuPreload(files, getActiveChunk()), audioLoad = startAudioPreload(files, getActiveChunk());
  startViewmodelTextures(getActiveChunk().weapon !== 'sword'); // the crossbow's + rifle's textures, drawn in a worker while the world builds
  const world = await bootstrap(step);
  const { game, sky, player, forest, params, chunk } = world;
  const nolock = params.has('nolock');
  const sea = chunk.ocean, isOcean = sea !== undefined; // open-water shard (Driftwood Isle): ocean + pier, no forest carpet / cabins / props

  // ── world dressing ──
  const dressing = await step('edge', async () => {
    const slice = slicer(); // between the builders below: a task ends once it has run ~30 ms (Driftwood's pier … cove were one 0.3–0.5 s task)
    const boundary = new Boundary(sky).build();
    game.scene.add(boundary.group);
    await macrotask(); // boundary · water · horizon each in its own task
    const water = !isOcean && hasPond() ? new Water(sky).build() : null;
    if (water) game.scene.add(water.mesh);
    const ocean = isOcean ? new Ocean(sky).build() : null;
    if (ocean) game.scene.add(ocean.group);
    // the south entry road is a wooden pier over the water; the player spawns on its deck
    const pier = sea ? new Pier(sky, { x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckY: sea.level + 1.2, landing: true }).build() : null;
    if (pier) {
      game.scene.add(pier.group);
      player.colliders.push(...pier.colliders);
      player.platforms.push((x, z) => pier.floorHeightAt(x, z));
      const y = pier.floorHeightAt(player.position.x, player.position.z); if (y !== undefined) player.position.y = y;
    }
    // the little sailboat you arrived in, moored to the pier's sea-end bollards; you can drop into it
    const boat = pier && sea ? new Boat(sky, { x: -4.2, z: -CHUNK_HALF + 6, heading: 0, waterY: sea.level, moorTo: pier.mooringsFor(-4.2, -CHUNK_HALF + 6) }).build() : null;
    if (boat) {
      game.scene.add(boat.group); if (boat.ropes) game.scene.add(boat.ropes);
      player.colliders.push(...boat.colliders);
      player.platforms.push((x, z) => boat.floorHeightAt(x, z));
    }
    await slice();
    // faceted shore boulders along the beach
    const rockSpecs = isOcean ? Boulders.scatterShore(chunk.seed) : [];
    const rocks = isOcean ? new Boulders(sky).build(rockSpecs) : null;
    if (rocks) { game.scene.add(rocks.mesh); player.colliders.push(...rocks.colliders); }
    await slice();
    // the thatched stilt hut on the plateau (porch, floor and front steps are walkable)
    const hut = isOcean ? new Hut(sky, HUT).build() : null;
    if (hut) { game.scene.add(hut.group); player.colliders.push(...hut.colliders); player.platforms.push((x, z) => hut.floorHeightAt(x, z)); }
    await slice();
    // the NE headland's lookout tower (platform + stair ramp walkable) and the wreck heeled on the east reef (deck walkable)
    const lookout = isOcean ? new Lookout(sky, LOOKOUT).build() : null;
    if (lookout) { game.scene.add(lookout.group); player.colliders.push(...lookout.colliders); player.platforms.push((x, z) => lookout.floorHeightAt(x, z)); }
    await slice();
    const wreck = isOcean ? new Wreck(sky, WRECK).build() : null;
    if (wreck) { game.scene.add(wreck.group); player.colliders.push(...wreck.colliders); player.platforms.push((x, z) => wreck.floorHeightAt(x, z)); }
    await slice();
    // the ring shrine in the NW jungle; the N / W / E jetties (the other entry roads); hibiscus bushes
    const shrine = isOcean ? new Shrine(sky, SHRINE).build() : null;
    if (shrine) { game.scene.add(shrine.group); player.colliders.push(...shrine.colliders); player.platforms.push((x, z) => shrine.floorHeightAt(x, z)); }
    await slice();
    const jetties: ReturnType<Pier['build']>[] = [];
    if (sea) for (const j of JETTIES) { jetties.push(new Pier(sky, { x: j.x, z: j.z, rot: j.rot, length: j.length, width: 3, deckY: sea.level + 1.2 }).build()); await slice(); }
    for (const j of jetties) { game.scene.add(j.group); player.colliders.push(...j.colliders); player.platforms.push((x, z) => j.floorHeightAt(x, z)); }
    await slice();
    const AVOID = [{ x: HUT.x, z: HUT.z, r: 11 }, { x: LOOKOUT.x, z: LOOKOUT.z, r: 12 }, { x: SHRINE.x, z: SHRINE.z, r: 13 }, { x: WRECK.x, z: WRECK.z, r: 14 }];
    const bushes = isOcean ? new Bushes(sky).build(Bushes.scatterIsland(chunk.seed, undefined, AVOID)) : null;
    if (bushes) game.scene.add(bushes.mesh);
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
    if (trailside) { game.scene.add(trailside.mesh); player.colliders.push(...trailside.colliders); }
    await slice();
    // the swaying rope bridge over the tidal creek on the hut → lookout path
    const bridge = isOcean ? new RopeBridge(sky, BRIDGE).build() : null;
    if (bridge) { game.scene.add(bridge.mesh); player.colliders.push(...bridge.colliders); player.platforms.push((x, z) => bridge.floorHeightAt(x, z)); }
    await slice();
    // coral, kelp, starfish and a fish school on the lagoon shelf (what you dive for)
    const seabed = isOcean ? new Seabed(sky).build(Seabed.scatterLagoon(chunk.seed, 360, [{ x: WRECK.x, z: WRECK.z, r: 18 }])) : null;
    if (seabed) { game.scene.add(seabed.mesh); if (seabed.fish) game.scene.add(seabed.fish); }
    await slice();
    // coconut palms (one draw call, fronds sway in update)
    const palmSpecs = isOcean ? Palms.scatterIsland(chunk.seed, undefined, AVOID) : [];
    const palms = isOcean ? new Palms(sky).build(palmSpecs) : null;
    await slice();
    // Wreck Cove dressing: tidepools (the reef crabs' homes), the cascade + plunge pool, the glowing cave mouth
    const cove = isOcean ? new Cove(sky).build(Cove.forIsland()) : null;
    if (cove) { game.scene.add(cove.group); player.colliders.push(...cove.colliders); player.platforms.push((x, z) => cove.floorHeightAt(x, z)); }
    await slice();
    if (palms) { game.scene.add(palms.mesh); player.colliders.push(...palms.colliders); }
    // ground cover near the player (M4): instanced grass / ferns / flowers / pebbles, refilled as you walk
    const cover = sea ? new GroundCover(sky, { sea: sea.level, palms: palmSpecs }).build() : null;
    if (cover) { game.scene.add(cover.group); game.onUpdate((dt) => cover.update(dt, player.position)); }
    ocean?.foamAround(player.colliders); // foam rings around every pile, rock and hull standing in the sea (Ocean W2)
    await macrotask();
    const horizon = new Horizon(sky).build();
    game.scene.add(horizon.group);
    return { boundary, water, ocean, pier, jetties, boat, palms, palmSpecs, cove, hut, lookout, wreck, shrine, bushes, gulls, bridge, seabed, horizon };
  });
  const { boundary, water, ocean, pier, jetties, boat, palms, palmSpecs, cove, hut, lookout, wreck, shrine, bushes, gulls, bridge, seabed, horizon } = dressing;

  const carpet = await step('grass', async () => {
    // no forest carpet over open water (grass scattered the whole sea floor for 19 s)
    const grass = isOcean ? null : new Grass(sky, forest).build();
    await macrotask();
    const under = isOcean ? null : await new Undergrowth(sky, forest).buildAsync(macrotask); // a task per placement pass
    const particles = isOcean ? null : new Particles(sky, forest).build(); // pine-forest mist + needle fall: nothing to fall from on the island (E7 B8)
    if (grass && under) game.scene.add(grass.group, under.group);
    if (particles) game.scene.add(particles.group);
    return { grass, under, particles };
  });
  const { grass, under, particles } = carpet;

  const homestead = await step('cabins', async () => {
    if (isOcean) return { cabins: null, interactables: [] as Awaited<ReturnType<Cabins['build']>>['interactables'] };
    const cabins = new Cabins(sky);
    const { group: cabinGroup, colliders, interactables } = await cabins.build();
    game.scene.add(cabinGroup);
    player.colliders.push(...colliders);
    player.platforms.push((x, z) => cabins.floorHeightAt(x, z));
    return { cabins, interactables };
  });
  const { cabins, interactables } = homestead;
  const props = await step('props', async () => {
    if (isOcean) return null;
    const built = new Props(sky, forest);
    game.scene.add(await built.build());
    player.colliders.push(...built.colliders);
    return built;
  });

  const animals = await step('animals', async (p) => {
    const a = await new AnimalManager(game.scene, sky, forest).buildAsync(macrotask); // a task per herd, not one long one
    p.detail(`${a.animals.length} animals`);
    return a;
  });
  // the island's enemies (Enemies.ts): reef crabs at the tidepools, coconut monkeys in the groves, the drowned sailor in the wreck's hold
  const enemies = isOcean ? new Enemies(animals, { scene: game.scene, sky, palms: palmSpecs, wreck, crabSites: cove?.crabSites ?? [] }).build() : null;
  const dayNight = sky.dayNight; // the low-poly shard's clock (DayNight.ts, D3): the sailor walks at night, the shrine glows, the jungle swaps to crickets
  if (dayNight) animals.enemyWorld.night = () => dayNight.night;

  // ── player kit: the shard's weapon + the AR-15 (Weapons.ts: 1 / 2 / Q, touch SWAP; the rifle is a cabin pickup), HUD, audio ──
  await step('weapon', () => viewmodelTexturesReady()); // the viewmodels' textures from the worker (usually long done); the build below is synchronous
  const targets: Targets = {
    raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): TargetHit | null {
      const h = animals.raycast(origin, dir, maxDist);
      return h ? { animal: h.animal as unknown as TargetHit['animal'], point: h.point, distance: h.distance, headshot: h.headshot } : null; // Animal.kind is any species id; the weapons only read deer / boar
    },
  };
  // the shard hands the player its weapon (ChunkDef.weapon): the wooden sword on Driftwood Isle, the crossbow elsewhere
  const crossbow: Weapon = chunk.weapon === 'sword'
    ? new Sword({ game, sky, player, forest }, targets, { allowUnlocked: nolock })
    : new Crossbow({ game, sky, player, forest }, targets, { allowUnlocked: nolock });
  await macrotask(); // each viewmodel in its own task
  const rifle = new Rifle({ game, sky, player, forest }, targets, { allowUnlocked: nolock });
  await macrotask();
  // the iron sword is FOUND on the wreck's deck (IronSword.ts) — wooden stays 1, iron becomes 2 once taken
  const ironSword = chunk.weapon === 'sword' ? new Sword({ game, sky, player, forest }, targets, { allowUnlocked: nolock, blade: 'iron' }) : null;
  const weapons = new Weapons(crossbow, rifle, ironSword ? [{ weapon: ironSword, id: 'sword-iron', name: 'Iron sword' }] : []); // held weapon = weapons.current; the hooks below are wired once here and forwarded; the rifle is locked until its pickup
  new TouchControls(player, weapons, params.has('touch')); // on-screen FPS controls on coarse-pointer devices (?touch=1 forces)
  weapons.adsHeld = params.has('ads');
  await macrotask();
  const hud = new HUD({ pointerLock: !nolock });
  const lockOn = new LockOn(game.camera); // sword lunge target brackets (meleeLock, Sword.ts)
  const speedLines = new SpeedLines(); // dodge / lunge edge streaks
  const perf = new Perf(game); // frame meter top-right (?perf=0 hides)
  const minimap = new Minimap(); // circular minimap (Heightfield is installed by now)
  const fullMap = new FullMap(minimap); // the menu's MAP tab (Menu.ts mounts it); tap the minimap / M to open
  const keepAlive = new KeepAlive();
  await macrotask();
  await step('menu', (p) => menuLoad.wait(p)); // the cards' art in memory before the title builds its deck (showIntro below)
  const audio = new Audio();
  // the Wildshard theme (docs/plans/MUSIC.md): the same score as the trailer, adaptive in play — menu / calm / alert / combat / underwater + stings
  const music = new Music(audio);
  music.setState({ shard: chunk.ocean ? 'island' : 'pine', mode: 'menu', intensity: 0, underwater: false });
  // the ring shrine hums by proximity and ducks the score up close (docs/plans/MUSIC.md v3 row 9)
  const shrineHum = shrine ? new ShrineHum(audio, music, { x: SHRINE.x, y: heightAt(SHRINE.x, SHRINE.z) + 2.5, z: SHRINE.z }) : null;
  const respawn = () => { player.spawn(chunk.spawn.x, chunk.spawn.z, chunk.spawn.yaw); if (pier) { const y = pier.floorHeightAt(player.position.x, player.position.z); if (y !== undefined) player.position.y = y; } music.sting('death'); };
  let kills = 0, health = 100, lastHurt = 0, swimHold = false;
  const harvested = new Set<object>();
  // ── the in-game menu: MAP · INVENTORY · ACHIEVEMENTS · SETTINGS (src/ui/Menu.ts) ──
  const progress = new Progress(getActiveChunk().id);     // shard achievements → titles (src/game/achievements.ts)
  const inventory = new Inventory(getActiveChunk().id);   // the pack: harvest drops
  const skins = new SkinLocker();                          // legendary skins owned / worn (persisted; wired below)
  const menu = new GameMenu({
    fullMap, progress, inventory,
    kit: () => weapons.available.map((w) => { const worn = w.id === 'crossbow' || w.id === 'rifle' ? skins.wearing(w.id) : null; return { id: w.id, name: (w.id === 'crossbow' ? 'Hunting crossbow' : w.id === 'sword' ? 'Wooden sword' : w.name) + (worn ? ` · ${worn.name}` : ''), ammoLabel: w.id === 'crossbow' ? 'Iron bolts' : w.id === 'rifle' ? 'Rounds' : '', ammo: w.state.ammo ?? 0, magazine: w.state.magazine, reserve: w.state.reserve, equipped: w === weapons.current, icon: w.id === 'rifle' ? 'rifle' : w.id === 'crossbow' ? 'crossbow' : 'sword' }; }),
    onEquip: (id) => weapons.select(id as WeaponId),
  });
  hud.menu = menu; // pause → Settings tab; the menu's CLOSE → hud.onResume
  fullMap.bindMinimap(() => { if (hud.entered) menu.open('map'); });
  document.addEventListener('keydown', (e) => { if (e.code === 'KeyM' && hud.entered && !menu.isOpen) menu.open('map'); });
  menu.onOpen = () => { if (document.pointerLockElement) document.exitPointerLock(); }; // the map wants a cursor; the lock comes back on close (onResume)

  // ── the review inbox (project/archive/2026-09-22-feedback-inbox.md): unlocked in Settings → REVIEW, then F8 (desktop), the ✎ disc under
  // PAUSE (touch) and the menu's FEEDBACK tab. The composer (src/ui/Feedback.ts) loads on first use; while its overlay is up
  // the world is frozen on the captured frame (frameGate) and the weapons / pointer lock are released.
  let feedbackHeld = false;
  let feedback: Promise<Feedback> | null = null;
  const touchUi = () => document.getElementById('hud')?.classList.contains('touch') === true;
  let explore: Explore | null = null; // Explore World (below) — while it is up, notes describe the viewer, not the player
  const exploring = (): boolean => explore?.active === true;
  const loadFeedback = (): Promise<Feedback> => { feedback ??= import('./ui/Feedback').then(({ Feedback: F }) => new F({
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
  const noteDisc = document.createElement('button'); noteDisc.type = 'button'; noteDisc.className = 'ws-fb-disc';
  noteDisc.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 20l1-4L16 5l3 3L8 19z M14 7l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>Note<b class="ws-fb-badge"></b>';
  noteDisc.addEventListener('click', () => { if (hud.entered && !feedbackHeld) void loadFeedback().then((f) => f.openSheet()); });
  (document.getElementById('hud') ?? document.body).append(noteDisc);
  const noteBadge = noteDisc.querySelector('b');
  const syncNoteDisc = () => {
    noteDisc.classList.toggle('show', quickNote() && touchUi() && hud.entered);
    const q = queuedCount(); noteDisc.classList.toggle('queued', q > 0); if (noteBadge) noteBadge.textContent = String(q);
  };
  onReview(syncNoteDisc);
  progress.onEarned = (d) => { hud.toast(`Achievement · ${d.name} — title unlocked: ${d.title}`); audio.hitMarker(); };
  const masterGain = () => { if (!audio.muted) audio.master.gain.setTargetAtTime(0.6 * getNumber('volume'), audio.ctx.currentTime, 0.05); };
  onNumber('volume', masterGain);

  const hands = new Hands(sky, game.camera); // white-gloved swimming hands (shown only while player.swimming)
  if (chunk.weapon === 'sword') (crossbow as Sword).onHeavy = () => { if (!isOcean) audio.swordHeavy(); }; // the charged overhead (Weapons does not forward it); the island's is swordEvents.onSwing
  weapons.onFire = () => { if (weapons.current.id === 'rifle') audio.rifleFire(); else if (chunk.weapon !== 'sword') audio.crossbowFire(); else if (!isOcean) audio.swordSwing(); }; // the island's whoosh: swordEvents.onSwing
  weapons.onDry = () => audio.dryFire();
  weapons.onReloadStart = () => (weapons.current.id === 'rifle' ? audio.rifleReload() : audio.reload());
  weapons.onSwap = () => audio.weaponSwap();
  weapons.onImpact = (surface, point) => {
    const dx = point.x - player.position.x, dz = point.z - player.position.z, d = Math.hypot(dx, dz);
    const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    const pan = d > 1 ? ((dx * rx + dz * rz) / d) * 0.7 : 0, gain = 1 / (1 + d / 12);
    if (weapons.current.id !== 'rifle' && chunk.weapon === 'sword') { if (!isOcean) audio.swordHit(surface, pan, gain); } else audio.boltImpact(surface, pan, gain); // the island's: swordEvents.onStrike
  };
  weapons.onHit = (_kind, headshot, killed) => {
    music.combat(0.7);
    hud.showHitMarker(headshot, killed);
    audio.hitMarker();
    if (killed) { kills++; audio.kill(); }
    buzz(killed ? HAPTIC.kill : HAPTIC.hit);
  };
  setAimTargets(animals.animals); // aim assist reads the live array
  // the AR-15 is found, not issued: a floating pickup on the floor of cabin 1 (the hollow), inside by the door wall
  // (cabin local frame: door on +X, chimney end -Z — Cabin.ts); "[E] Take AR-15" through the door / harvest prompt path
  const rifleDrop = (() => {
    const site = CABIN_SITES[0]; if (!site || !cabins) return null;
    const lx = 1.5, lz = -1.6, c = Math.cos(site.rot), sn = Math.sin(site.rot);
    const x = site.x + lx * c + lz * sn, z = site.z - lx * sn + lz * c;
    const drop = new WeaponPickup({ scene: game.scene, item: rifle.displayModel(), position: new THREE.Vector3(x, cabins.floorHeightAt(x, z) ?? heightAt(x, z), z), tier: 'common', prompt: 'Take AR-15' });
    interactables.push(drop.interactable);
    drop.onNear = (inside) => audio.pickupHum(inside); // the orb hums while you stand in its prompt radius
    drop.onPickup = () => { weapons.unlock('rifle'); weapons.select('rifle'); audio.hitMarker(); music.sting('pickup'); hud.toast('AR-15 acquired · 1/2 to switch, Q to swap'); };
    return drop;
  })();
  if (params.get('weapon') === 'rifle') { weapons.unlock('rifle'); weapons.select('rifle', true); rifleDrop?.dispose(); } // dev: start with it
  const ironDrop = (() => {
    if (!wreck || !ironSword) return null;
    const drop = new IronSwordPickup({ scene: game.scene, sky, position: ironSwordSite(wreck, heightAt) });
    interactables.push(drop.interactable);
    drop.onNear = (inside) => audio.pickupHum(inside);
    drop.onPickup = () => { weapons.unlock('sword-iron'); weapons.select('sword-iron'); audio.hitMarker(); music.sting('pickup'); hud.toast('Iron sword acquired · 1/2 to switch, Q to swap'); };
    return drop;
  })();
  if (params.get('weapon') === 'iron' && ironSword) { weapons.unlock('sword-iron'); weapons.select('sword-iron', true); ironDrop?.dispose(); }
  // ── Driftwood's adventure (plan Track A: interactables, the quest, the castaway, collectibles; src/game/quest/Adventure.ts) — null on any other shard ──
  installAdventure({ game, sky, player, chunk, prompts: interactables, hud, audio, music, inventory, progress, fullMap, animals, ironDrop, setViewmodel: (on) => { weapons.visible = on; }, bridgeFloor: bridge ? (x, z) => bridge.floorHeightAt(x, z) : undefined, pois: { hut, lookout, wreck, shrine, cave: cove }, params });
  // ── legendary skins (src/player/Skins.ts): the Ghost stag drops the GHOST STAG crossbow, Old Ironhide the IRONHIDE AR-15 —
  // a big purple floating pickup where the animal fell (WeaponPickup tier 'rare'); taking it swaps the skin (and hands you the
  // rifle if you had not found it). What you own / wear persists; `?skin=ghost-stag` previews, `?drop=ironhide` spawns one ahead.
  const skinDrops: WeaponPickup[] = [];
  const weaponModel = (w: 'crossbow' | 'rifle') => (w === 'rifle' ? rifle.model : crossbow instanceof Crossbow ? crossbow.model : null);
  const wearSkin = (skin: SkinDef) => { const m = weaponModel(skin.weapon); if (m) applySkin(m, skin, sky); skins.wear(skin.weapon, skin.id); };
  const spawnSkinDrop = (skin: SkinDef, at: THREE.Vector3) => {
    const item = skin.weapon === 'rifle' ? rifle.displayModel() : crossbow instanceof Crossbow ? crossbowDisplayModel(crossbow, sky) : null;
    if (!item) return;
    applySkin(item, skin, sky);
    const label = skin.weapon === 'rifle' ? 'AR-15' : 'crossbow';
    const drop = new WeaponPickup({ scene: game.scene, item, position: new THREE.Vector3(at.x, heightAt(at.x, at.z), at.z), tier: 'rare', prompt: `Take the ${skin.name} ${label}`, scale: skin.weapon === 'rifle' ? 1.35 : 1.6 }); // big — a legendary fills its orb
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
  animals.onKill = (a) => {
    hud.killFeed(`${a.label} · ${Math.round(a.position.distanceTo(player.position))} m`); progress.recordKill(a.kind, a.variant);
    const skin = skinFor(a.kind, a.variant); if (skin && !skins.has(skin.id)) spawnSkinDrop(skin, a.position); // the legendary's drop, once
  };
  for (const w of ['crossbow', 'rifle'] as const) { const s = skins.wearing(w); if (s) wearSkin(s); }
  const skinParam = params.get('skin'), dropParam = params.get('drop');
  if (skinParam && skinParam in SKINS) { const s = SKINS[skinParam as SkinId]; skins.own(s.id); wearSkin(s); if (s.weapon === 'rifle') { weapons.unlock('rifle'); weapons.select('rifle', true); } }
  if (dropParam && dropParam in SKINS) { const f = 4.5; spawnSkinDrop(SKINS[dropParam as SkinId], new THREE.Vector3(player.position.x - Math.sin(player.yaw) * f, 0, player.position.z - Math.cos(player.yaw) * f)); }
  new Combat(game, animals, weapons, game.camera); // health bars over animals + MMO-style damage / MISS floats (self-wiring); Combat only taps onFire / onImpact, which the manager forwards for every weapon
  // taking a hit (B3): the arc points at the attacker (src/ui/HurtArc.ts), a hurt grunt panned toward it (Audio.hurt — it
  // used to be the landing thud), and the killer is remembered for the death toast (B2)
  const hurtArc = new HurtArc();
  let killer: { kind: string; label: string } | null = null;
  animals.onCharge = (a, dmg) => {
    health = Math.max(0, health - dmg); lastHurt = performance.now(); hud.damageFlash(); music.combat(0.9);
    killer = { kind: a.kind, label: a.label };
    if (chunk.weapon === 'sword') hurtArc.hit(a.position.x, a.position.z, player.position, player.yaw, dmg); // the direction arc: the island only (D8)
    if (chunk.weapon === 'sword') CameraFX.for(game).addTrauma(Math.min(0.85, 0.3 + dmg / 40)); // a trauma² shake (C3, the island only)
    const dx = a.position.x - player.position.x, dz = a.position.z - player.position.z, d = Math.hypot(dx, dz);
    audio.hurt(dmg / 20, d > 0.3 ? ((dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)) / d) * 0.7 : 0);
  };
  // footsteps (B9): the island asks its surface map — planks on every deck, stone on the shrine dais, sand / wet sand / grass /
  // rock off them as the terrain paints it, an ankle splash in the shallows — pitched and levelled by speed; Pine Hollow as before
  const islandSfx = sea ? new IslandSfx(audio) : null;
  const surfaces = sea ? new SurfaceMap({ sea: sea.level, heightAt, trailDistance, decks: [pier, ...jetties, boat, hut, lookout, bridge, wreck], stone: [shrine] }) : null;
  // the island's zoned soundscape + reverb rooms (S1 / S2): surf on the shoreline, palms, jungle, cove + waterfall, lookout wind; hold / cave / shrine reverb
  animals.onSound = (name, pos) => { if (!islandSfx?.animal(name, pos)) audio.animal(name, pos, player.position, player.yaw); }; // the island's enemies from the bank (S3)
  // the sword's combat layers on the island (S3 bank via IslandSfx; Pine Hollow has no sword): a whoosh per swing, an impact per blade
  // hit by material (+ a death bark), a clang where the blade meets a wall / trunk, each enemy wind-up's cue (C5)
  if (islandSfx) {
    swordEvents.onSwing = (speed, heavy, dir) => { islandSfx.whoosh(speed, { heavy, dir }); };
    swordEvents.onStrike = (kind, point, strength, killed) => {
      islandSfx.impact(kind === 'crab' ? 'shell' : kind === 'sailor' ? 'wood' : 'flesh', strength, point);
      const enemy = kind === 'boar' || kind === 'crab' || kind === 'monkey' || kind === 'sailor' ? kind : null;
      if (killed && enemy !== null) islandSfx.vocal(enemy, point, 1.3);
    };
    swordEvents.onClang = (point, strength) => { islandSfx.impact('wood', strength, point); };
    animals.onWindup = (a) => { const e = a.kind === 'crab' ? 'crab' : a.kind === 'sailor' ? 'sailor' : a.kind === 'boar' || a.kind === 'bear' ? 'boar' : null; if (e !== null) islandSfx.windup(e, a.position); };
  }
  const ambience = sea ? new IslandAmbience(audio, { sea: sea.level, heightAt, palms: palmSpecs, wreck, cove: Cove.forIsland() }) : null;
  player.onStep = (sprinting) => {
    const p = player.position;
    if (islandSfx && surfaces && !(player.wading && player.depth > 0.3)) islandSfx.footstep(player.wading ? 'water' : surfaces.surfaceAt(p.x, p.z, p.y), Math.hypot(player.velocity.x, player.velocity.z));
    else if (player.wading) audio.wadeStep(player.depth, sprinting);
    else audio.footstep(sprinting, pier?.floorHeightAt(p.x, p.z) !== undefined ? 'planks' : sea !== undefined && heightAt(p.x, p.z) - sea.level < 2.6 ? 'sand' : 'litter');
  };
  if (gulls) gulls.onCall = (pos) => audio.gullCallAt(pos, player.position, player.yaw);
  player.onEnterWater = (impact) => audio.splash(impact);
  player.onSubmerge = () => { audio.dive(); islandSfx?.plunge(false); audio.setUnderwater(true); ambience?.setUnderwater(true); music.setState({ underwater: true }); };
  player.onSurface = () => { audio.surface(); islandSfx?.plunge(true); audio.setUnderwater(false); ambience?.setUnderwater(false); music.setState({ underwater: false }); };
  player.onExitWater = () => audio.waterExit();
  player.onStroke = () => audio.swimStroke();
  player.onJump = () => audio.jump();
  player.onDodge = () => { audio.dodge(); buzz(HAPTIC.dodge); };
  player.onLunge = () => { audio.lunge(); buzz(HAPTIC.lunge); };
  player.onLand = (hard) => { audio.land(hard); if (hard) { health = Math.max(0, health - 8); hud.damageFlash(); if (health <= 0) killer = null; } };
  hud.onSoundToggle = (on) => { audio.muted = !on; masterGain(); };

  // ── menu ↔ world: the world is fully loaded, then sits frozen and silent under the menu (hero art
  // covers the canvas) until ENTER WORLD; "Exit to main menu" freezes it again — no reload, no
  // loading screen. `?skipintro=1` (bench / screenshots) and `?tour=1` go straight to the world.
  const tour = world.tour;
  const menuFirst = !params.has('skipintro') && !params.has('tour');
  let firstIn = true;
  const enter = () => {
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
  hud.onResume = enter;
  hud.onExitToMenu = () => { weapons.setEnabled(false); perf.setActive(false); audio.worldMuted = true; music.setState({ mode: 'menu' }); noteDisc.classList.remove('show'); }; // the world hushes, the title theme comes back; the HUD clears `entered`, the gate does the rest

  // ── Explore World (docs/plans/EXPLORE-WORLD.md): the title's EXPLORE WORLD panel — the viewer over this same loaded shard (a
  // lazy chunk). God-mode camera, Model Explorer, one ✎ to the review inbox; ✕ comes back here to the title.
  const exitExplore = () => { perf.setActive(false); audio.worldMuted = true; music.setState({ mode: 'menu' }); hud.showIntro(enter); };
  const noteSheet = async (): Promise<void> => { const f = await loadFeedback(); await f.openSheet(); };
  const openExplore = async (mode: ExploreMode, opts: { cam?: number[]; model?: string } = {}): Promise<void> => {
    audio.resume();
    audio.worldMuted = false;
    if (!music.isPlaying) music.play('theme');
    music.setState({ mode: 'calm', intensity: 0 });
    void keepAlive.start();
    weapons.setEnabled(false); weapons.visible = false;
    perf.setActive(false); // the Explore readout carries fps / calls / tris
    const { Explore: X } = await import('./explore/Explore');
    explore ??= new X({ world, onExit: exitExplore, openFeedback: () => { void noteSheet(); }, hide: [boundary.group], models: { hut, lookout, wreck, shrine, pier, jetties, boat, bridge, cove, palmSpecs, palms, bushes, creatures: animals.animals } });
    explore.open(mode, opts);
  };
  const exploreParam = params.get('explore');
  const exploreMode: ExploreMode = exploreParam === 'world' || exploreParam === 'model' ? exploreParam : 'hub';
  hud.onExplore = () => { void openExplore('hub'); };
  // Not a frame is rendered or ticked while the menu is up: hud.entered is the gate.
  game.frameGate = () => (hud.entered || exploring()) && !feedbackHeld && !rotateGated(); // … and the review composer freezes it on the captured frame; the rotate page (E38) stops it too
  if (menuFirst) { weapons.setEnabled(false); weapons.visible = false; perf.setActive(false); audio.worldMuted = true; hud.showIntro(enter); }
  else { hud.markEntered(); weapons.setEnabled(!nolock || params.has('skipintro')); }
  // ?explore=hub|world|model[&cam=x,y,z,yaw,pitch][&model=id] — straight into the viewer (Driftwood only, D4; a note's "go there")
  if (exploreParam !== null && sea !== undefined) {
    const cam = (params.get('cam') ?? '').split(',').filter((v) => v !== '').map(Number);
    const model = params.get('model');
    hud.onExplore = () => { hud.onExplore = () => { void openExplore('hub'); }; void openExplore(exploreMode, { ...(cam.length >= 3 ? { cam } : {}), ...(model !== null ? { model } : {}) }); };
    hud.startExplore();
  }
  // the first gesture builds the AudioContext; on the title screen it also starts the title theme (synth, then the title stems)
  const firstGesture = () => { audio.resume(); if (!hud.entered && !music.isPlaying) music.play('theme'); };
  document.addEventListener('keydown', firstGesture, { once: true });
  document.addEventListener('mousedown', firstGesture, { once: true });

  // ── interaction (doors) ──
  let prompt: string | undefined;
  let nearest: (typeof interactables)[number] | undefined;
  let carcass: (typeof animals.animals)[number] | undefined;
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyE' || !hud.entered) return;
    if (nearest) nearest.onInteract();
    else if (carcass) {
      harvested.add(carcass);
      const drops = harvestOf(carcass.kind, carcass.variant);
      for (const id of drops) inventory.add(id);
      hud.toast(`${drops.map((id) => ITEMS[id].label).join(' + ') || 'Nothing'} harvested · ${inventory.total} in the pack`);
      audio.hitMarker();
      carcass.fadeOut();
    }
  });

  let musicPoll = 0;
  game.onUpdate((dt, t) => {
    // music: once a second (not per frame) — an animal that has noticed you within 40 m lifts calm → alert; combat comes from the hit hooks and decays by itself
    if (t - musicPoll > 1) {
      musicPoll = t;
      syncNoteDisc(); // the ✎ disc follows entered / the touch layer / the Quick note switch, once a second
      if (music.state.mode !== 'combat' && music.state.mode !== 'menu') {
        const noticed = animals.animals.some((a) => a.alive && (a.state === 'alert' || a.state === 'stalk') && a.position.distanceTo(player.position) < 40);
        music.setState({ mode: noticed ? 'alert' : 'calm', intensity: noticed ? 0.5 : 0 });
      }
    }
    boundary.update(dt, t);
    water?.update(dt);
    ocean?.update(dt);
    boat?.update(dt);
    palms?.update(dt);
    gulls?.update(dt, player.position);
    bridge?.update(dt);
    seabed?.update(dt);
    cove?.update(dt); shrine?.update(dt); enemies?.update(dt, t, player.position);
    if (dayNight) { shrine?.setDusk(dayNight.dusk); if (ambience) ambience.night = dayNight.night; }
    hands.update(dt, player);
    horizon.update(dt, game.camera);
    grass?.update(dt, player.position);
    under?.update(dt, player.position);
    particles?.update(dt, player.position, game.camera);
    cabins?.update(dt, t);
    // swimming holsters the weapon (hands only; Hands.ts follows)
    if (player.swimming !== swimHold) { swimHold = player.swimming; weapons.visible = !swimHold; weapons.setEnabled(!swimHold); }
    animals.update(dt, t, player.position, player.sprinting);
    weapons.update(dt, t); // every weapon ticks (bolts in flight keep flying while the rifle is out)
    rifleDrop?.update(dt, t, game.renderer, game.camera);
    ironDrop?.update(dt, t, game.renderer, game.camera, player.position); // walk-to-pick-me-up
    for (const d of skinDrops) d.update(dt, t, game.renderer, game.camera);
    audio.listenerYaw = player.yaw;
    shrineHum?.update(game.camera);
    ambience?.update(dt, game.camera);

    // nearest interactable
    nearest = undefined; let best = 1e9;
    for (const it of interactables) { const d = it.position.distanceTo(game.camera.position); if (d < it.radius && d < best) { best = d; nearest = it; } }
    carcass = undefined;
    if (!nearest) for (const a of animals.animals) { if (!a.alive && !harvested.has(a) && a.position.distanceTo(player.position) < 2.6) { carcass = a; break; } }
    prompt = nearest ? `[E] ${nearest.label}` : carcass ? `[E] Harvest ${carcass.label || carcass.kind}` : undefined; // "Harvest Royal bull", not "Harvest elk"

    // slow health regen; death → respawn at the gate
    if (health < 100 && performance.now() - lastHurt > 6000) health = Math.min(100, health + dt * 4);
    // death → the toast names the killer and this shard's respawn point (deathLine); only a weapon with ammo is topped up
    if (health <= 0) { health = 100; audio.death(); hud.toast(deathLine(killer, isOcean)); killer = null; hud.damageFlash(); respawn(); if (crossbow.hasAmmo) crossbow.addBolts(30 - (crossbow.state.bolts ?? 30)); }
    hurtArc.update(dt, player.position, player.yaw);

    const edge = CHUNK_HALF - Math.max(Math.abs(player.position.x), Math.abs(player.position.z));
    hud.setBoundaryWarning(edge < 14 && hud.entered);
    hud.setAimInfo(weapons.aimInfo);
    lockOn.update();
    speedLines.update(dt, player.dashing, meleeLock.lunging);
    if (hud.entered) { hud.setAnimals(animalPositions(animals.animals)); minimap.update(player.position, player.yaw, animals.animals); fullMap.update(player.position, player.yaw); } // compass paw + minimap (hidden under the menu)
    hud.setState({
      bolts: weapons.state.ammo, maxBolts: weapons.state.magazine, reserve: weapons.state.reserve, loaded: weapons.state.loaded, reloading: weapons.state.reloading, reloadProgress: weapons.state.reloadProgress,
      ammoLabel: weapons.current.ammoLabel, weaponName: weapons.current.name, segments: weapons.current.segments,
      health, fps: game.stats.fps, pos: { x: player.position.x, z: player.position.z }, yaw: player.yaw, kills,
      prompt, speed: player.speedFactor, ads: weapons.state.ads,
    });
  });

  // `?at=x,y,z,yaw,pitch` — a review note's repro URL (src/ui/Feedback.ts reproUrl) starts you on the spot it was filed from
  const at = (params.get('at') ?? '').split(',').map(Number);
  if (at.length >= 3 && at.every((v) => Number.isFinite(v))) {
    const [x = 0, y = 0, z = 0, yaw = player.yaw, pitch = 0] = at;
    player.position.set(x, y, z); player.yaw = yaw; player.pitch = pitch;
  }

  await macrotask();
  game.buildComposer();
  // Compile programs in batches with a visible count, then draw the first frames as a step —
  // instead of the first render() compiling ~100 programs in one stall (minutes on iOS).
  const programs = () => `${game.renderer.info.programs?.length ?? 0} programs`;
  await step('shaders', (p) => game.precompile((d, n, what) => p.set(d, n, `${what} · ${programs()}`)));
  await step('firstFrame', (p) => game.firstFrame((d, n, what) => p.set(d, n, `${what} · ${programs()}`)));
  // last: the audio downloads while the shaders compile; the selected style + set are decoded as their bytes land
  const banks = await step('audio', (p) => audioLoad.wait(p));
  if (banks.music) music.useBank(banks.music); // the title theme's first gesture plays the stems at once
  audio.useSamples(banks.sfx);
  (plan as unknown as { done: () => void }).done(); // throws unless both tracks are exactly 1
  game.start();
  await loading.done();
  document.dispatchEvent(new Event('ws:ready')); // booted to the title: the native shell's update watchdog (src/native/boot.ts) waits for this
  (window as unknown as { __world: unknown }).__world = { ...world, boundary, water, ocean, pier, jetties, boat, hut, lookout, wreck, shrine, bushes, gulls, cove, enemies, hands, grass, under, particles, cabins, props, animals, crossbow, hud, audio, music, shrineHum, islandSfx, surfaces, ambience };
}
main().catch((e: unknown) => showError(e instanceof Error ? `${e.name}: ${e.message}` : String(e), e instanceof Error ? e.stack ?? '' : ''));
