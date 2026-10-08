import { resolveLevelBounds } from '../shard/runtime';
import { SkinLocker } from '../cosmetics/locker';
import { BagMenu } from '../bag/tabs';
import { equipmentEntry, toolEntries } from '../bag/equipment';
import type { WeaponId } from '@wildshard/engine/combat/Equipment';
import type { DeathCause } from '@wildshard/engine/combat/pipeline';
import { type Bucket, frameCost } from '@wildshard/engine/core/frameCost';
import type { Explore, ExploreMode } from '@wildshard/engine/explore/Explore';
import { type AimTarget, meleeLock, setAimTargets } from '@wildshard/engine/player/AimTargets';
import { type SkinDef, applySkin } from '@wildshard/engine/player/Skins';
import type { PlaygroundId } from '@wildshard/engine/practice/playground/catalog';
import type { Playground } from '@wildshard/engine/practice/playground/Playground';
import type { Feedback } from '@wildshard/engine/ui/Feedback';
import { installBodyShadow } from '../cosmetics/bodyShadow';
import { isOwnedId, Owned } from '../loot/Owned';
import { bindTravelInventory, applyTravelCarry } from '../travel/travel';
import * as THREE from 'three';
import { BagButton } from '../bag/BagButton';
import { Progress } from '../Progress';
import { Inventory } from '../Inventory';
import { legacyHomeCheckpoint } from '../grid/homeCheckpoint';
import { ITEMS } from '../bag/itemCatalog';
import { LastPlace, placeName } from '../LastPlace';
import { shardCompleteUp } from '../complete/ShardComplete';
import type { loadoutStage } from './loadout';
import { animalPositions } from './positions';
import { describeKeyBindings } from '../keyBindings';
import { app } from '@wildshard/engine/app/runtime';
import { beginExploreEntry, recordBootCheckpoint } from '@wildshard/engine/boot/bootTrace';
import { startMenuPreload } from '@wildshard/engine/boot/extras';
import { macrotask } from '@wildshard/engine/boot/plan';
import { loadExplore, loadFeedback as loadFeedbackModule } from '@wildshard/engine/boot/runtime';
import { CombatCues } from '@wildshard/engine/combat/cues';
import { EffectService } from '@wildshard/engine/combat/effects/EffectService';
import { PlayerHealth } from '@wildshard/engine/combat/health';
import { KeepAlive } from '@wildshard/engine/core/KeepAlive';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { isDev } from '@wildshard/engine/core/devMode';
import { tap } from '@wildshard/engine/core/harnessTap';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { TIER } from '@wildshard/engine/core/tier';
import { Impacts } from '@wildshard/engine/fx/Impacts';
import { floorBelow, lineOfSight } from '@wildshard/engine/physics/query';
import { CameraFX } from '@wildshard/engine/player/CameraFX';
import { Hands } from '@wildshard/engine/player/Hands';
import { loadPlayground } from '@wildshard/engine/practice/playground/load';
import { Combat, aimReadout } from '@wildshard/engine/ui/Combat';
import { DeathFade } from '@wildshard/engine/ui/DeathFade';
import { FirstHints } from '@wildshard/engine/ui/FirstHints';
import { HurtArc, deathCause, respawnWhere } from '@wildshard/engine/ui/HurtArc';
import { LockOn } from '@wildshard/engine/ui/LockOn';
import { FullMap } from '@wildshard/engine/ui/Map';
import { GameMenu } from '@wildshard/engine/ui/Menu';
import { Minimap } from '@wildshard/engine/ui/Minimap';
import { Perf } from '@wildshard/engine/ui/Perf';
import { rotateGated } from '@wildshard/engine/ui/RotateGate';
import { getNumber, onNumber, setting } from '@wildshard/engine/ui/Settings';
import { SpeedLines } from '@wildshard/engine/ui/SpeedLines';
import { WeaponStrip } from '@wildshard/engine/ui/WeaponStrip';
import { WindupWarn } from '@wildshard/engine/ui/WindupWarn';
import { HAPTIC, buzz } from '@wildshard/engine/ui/haptics';
import { hudSlots } from '@wildshard/engine/ui/hudSlots';
import { installPlayerDeath } from '@wildshard/engine/ui/playerDeath';
import { PlayerHurt } from '@wildshard/engine/ui/playerHurt';
import { onReview, queuedCount, quickNote } from '@wildshard/engine/ui/review';
import { installBounds } from '@wildshard/engine/world/bounds';
import { gridCells, gridHomeSim, pageMode } from '../grid/boot';
import { installGridReveal } from '../grid/reveal';
import { installGridHud } from '../grid/gridHud';
import { installBudgetOverlay } from '../grid/budgetOverlay';
import { installMemoryWarning } from '../grid/memoryWarning';
import { ACCENTS } from '../shardfile/accent';
import { installMinimapBlend } from '../grid/minimapBlend';
import { findShard } from '../shard/registry';
import { accentHex, hudAccent, onHudAccent, setHudAccent } from './hudAccent';
import { firstPartyInstance } from '../grid/instances';
import { installSavesSettings } from '../savesSettings';
import { GridSession } from '../grid/session';
import type { LiveGridSession } from '../grid/liveSession';
import { pickInteractable } from '@wildshard/engine/world/interact/Interactables';
import { terrainDatum } from '@wildshard/engine/world/terrainHeight';

async function buildPlay(ctx: Awaited<ReturnType<typeof loadoutStage>>) {
  const { manifest, boot, session, kit, files, step, menuLoad, world, game, sky, player, params, chunk, registry, nolock, viewer, boundary, horizon, prepareAudio, animals, arena, swimArms, crossbow, rifle, longbow, weapons, lockSys, touchControls, hud } = ctx;
  const leakPhysics = world.physics; // The borrowed page world outlives temporary active frames.
  if (session.memory !== undefined) installMemoryWarning(session.memory, game.levelScope, hud.root);

  let playground: Playground | null = null;
  const away = (): boolean => arena.entered || playground?.entered === true;
  const weaponStrip = new WeaponStrip(weapons); // every shard's one swap control (E303 / E319): the SWAP ring + pie on touch, a hotbar on desktop
  const lockOn = new LockOn(game.camera); // sword lunge target brackets (meleeLock, Sword.ts)
  const speedLines = new SpeedLines(); // dodge / lunge edge streaks
  const perf = new Perf(game); // frame meter top-right (?perf=0 hides)
  const minimap = new Minimap(); // circular minimap (Heightfield is installed by now)
  if (chunk.hud?.dayBadge === true) minimap.showDayBadge(); // the sun / moon on its rim (Nalati)
  const fullMap = new FullMap(minimap); // the menu's MAP tab (Menu.ts mounts it); tap the minimap / M to open
  const keepAlive = new KeepAlive();
  await macrotask();
  // SF21a / the grid client: EXPERIMENTAL Wildshard's 3 × 3 around this home cell (deck, soft walls, neighbours' far proxies)
  const grid = pageMode() === 'grid' ? await GridSession.create({ scene: game.rootScene, physics: world.physics, scope: game.levelScope, feet: () => player.position, renderer: game.renderer,
    ownedHome: session.ownedGridHome === true,
    ...(ctx.session.residency === undefined ? {} : { residency: ctx.session.residency }),
    onFixed: (fn) => { game.onFixed('post', fn, 'game.grid.session'); },
    frame: { scene: game.rootScene, camera: game.camera, composer: () => game.composer, post: () => game.post, sunDir: () => game.sky.sunDir, cinematic: () => game.regionCinematic(), slices: () => game.depthSlices, onLate: (fn) => { game.onLate(fn, 'game.grid.frame'); } } }) : null;
  await step('menu', async (p) => { // the cards' art in memory before the title builds its deck (showIntro below)
    // + the practice room's dummies when this boot lands in it (a travel in arena mode): full on its first frame (E291). Any
    // other boot loads them when the room comes near: Explore's hub preloads them on open (below), so they are not resident
    // while the player is out in the world (G187: −33.6 MB of GL on Pine). The Memory saver loads them when the room opens (SF22d).
    const practice = isDev() && setting('memorySaver') === 'off' && session.arrival?.mode === 'arena' ? arena.preload() : null;
    await (menuLoad ?? startMenuPreload(files, chunk)).wait(p);
    await practice; // the grid's streaming is covered by its entry reveal (G98, below), not the loading screen
  });
  const { audio, music } = prepareAudio();
  const arrivalSpawn = boot.handoff?.arrive ?? chunk.spawn;
  let gridLive: LiveGridSession | null = null; // the grid's live crossing (attached below, once the player's health exists)
  const toSpawn = () => {
    const region = gridLive?.spawn() ?? null; // off the home frame: the active region's start, or the deck under the feet
    if (region !== null) { player.spawn(region.x, region.z, region.yaw, region.y); return; }
    player.spawn(arrivalSpawn.x, arrivalSpawn.z, arrivalSpawn.yaw, arrivalSpawn.y); if (!boot.handoff?.arrive) { const y = boot.runtime.hooks.spawnFloor?.(player.position.x, player.position.z); if (y !== undefined) player.position.y = y; }
  };
  const respawn = () => { toSpawn(); music.sting('death'); };
  // in the grid every frame has fall recovery (a level without authored bounds, Driftwood, gets the grid's fall floor; the horizontal check is the grid's)
  const GRID_FALL_FLOOR = -60;
  const authoredBounds = resolveLevelBounds(game.level.bounds, boot.runtime.hooks);
  const bounds = authoredBounds ?? (grid === null ? undefined : { x0: -Infinity, x1: Infinity, z0: -Infinity, z1: Infinity, floor: GRID_FALL_FLOOR });

  let kills = 0, swimHold = false;
  // SF28 (G87 / G104): the big item cards wear the shard's declared accent (in the grid, the cell's: grid/gridHud.ts)
  setHudAccent(accentHex(manifest.accent)); hud.cardAccent = hudAccent();
  game.levelScope.onDispose(onHudAccent((hex) => { hud.cardAccent = hex; }));
  const owned = new Owned(manifest.slug);            // E314: upgrades, cosmetics, trophies, the found iron sword (src/game/loot/Owned.ts)
  const playerHealth = new PlayerHealth(app.events, {
    now: () => performance.now(), position: () => player.position,
    dodging: () => player.dodging, dodgeGuard: () => false,
    mode: () => player.mountedOn !== null ? 'ride' : player.hover ? 'board' : player.swimming ? 'swim' : 'foot',
    impulse: (velocity) => player.impulse(velocity),
  });
  app.registerPlayer(playerHealth, game.levelScope);
  installBounds(app, game.levelScope, bounds, { player,
    toSpawn: () => { if (gridLive === null) toSpawn(); else app.combat.fall(playerHealth, player.position, { kind: 'out-of-world', label: '' }); },
    fallFloor: () => gridLive?.fallFloor() ?? bounds?.floor ?? GRID_FALL_FLOOR,
    floorAt: (x, z) => ((gridLive?.spawn() ?? null) === null ? registry.floorAt(x, z) : floorBelow(world.physics, x, z, player.position.y + 0.6, 1.2)),
    suspended: () => world.freeCamera || world.tour.active || away() || (grid !== null && player.carried), grid: () => grid !== null, frame: () => gridLive?.frame() });
  // the grid client step 2: the live crossing (LiveGridHost + GridCrossing in the page's one fixed step; G68's safe zone)
  // The installed play owner confirms its progress and pack writes; source clients supply their own durable handoff.
  gridLive = grid?.attach({ traveller: player, health: playerHealth, equipment: weapons, events: app.events,
    ownedHome: session.ownedGridHome === true,
    runtimePage: () => boot.context === undefined || boot.runtime.play === null ? null : { world, play: boot.runtime.play, context: boot.context, ...(ctx.enteredEquipment === undefined ? {} : { equipment: ctx.enteredEquipment }) },
    onSafeZone: () => { app.effects?.clearHarmful(playerHealth); },
    scriptNotices: { toast: (text) => { hud.toast(text, 'warn'); }, devAlert: (text) => { hud.devAlert(text); } },
    saves: app.saves, ...(authoredBounds === undefined ? {} : { homeFallFloor: authoredBounds.floor }), checkpoint: legacyHomeCheckpoint(() => boot.runtime.play), catalogue: [],
    setPhysics: (physics) => { world.physics = physics; app.physics = physics; },
    onFixedPre: (fn) => { game.onFixed('pre', fn, 'game.grid.live.pre'); }, onFixedPost: (fn) => { game.onFixed('post', fn, 'game.grid.live.post'); },
    onInput: (fn) => { game.onInput(fn, 'game.grid.origin.restore'); }, onUpdate: (fn) => { game.onUpdate(fn, 'game.grid.origin'); } }) ?? null;
  const effects = new EffectService(app.levelRegistrations.list('effect'), game.levelScope, app.events);
  app.registerEffects(effects, game.levelScope);
  playerHealth.attributes.incomingCap = chunk.fight?.maxHitDamage ?? Infinity;
  app.combat.playerRules(game.levelScope, { target: playerHealth, bossGod: params.has('bossGod'), capExempt: chunk.fight?.capExempt ?? [] });
  const harvested = new Set<object>();
  // ── the in-game menu: MAP · INVENTORY · ACHIEVEMENTS · SETTINGS (src/engine/ui/Menu.ts) ──
  const progress = new Progress(manifest.slug);     // shard achievements → titles (src/game/achievements.ts)
  const inventory = new Inventory(manifest.slug);   // the pack: harvest drops
  if (boot.featTotal !== undefined) progress.setFeatTotal(boot.featTotal);
  applyTravelCarry(boot.handoff, inventory);
  game.levelScope.onDispose(bindTravelInventory({ shard: chunk.slug, inventory, rows: boot.items }));
  const skins = new SkinLocker(chunk.slug, boot.skins);                          // legendary skins owned / worn (persisted; wired below)
  const menu = new GameMenu({
    levelName: chunk.name,
    fullMap,
    keys: { bag: 'inventory' }, // the game's Bag key opens its inventory tab
    settings: () => ({ weapons: new Set(weapons.available.map((w) => w.id)), melee: weapons.available.some((w) => w.row.ui.melee),
      tracers: weapons.available.some((w) => w.row.ui.tracers), huntersEye: weapons.available.some((w) => w.row.ui.huntersEye === true) }),
  });
  new BagMenu(menu, {
    ...(manifest.bag?.tabs === undefined ? {} : { tabs: manifest.bag.tabs }),
    levelName: chunk.name, progress, inventory,
    kit: () => weapons.available.map((w) => { const worn = skins.wearing(w.id); return equipmentEntry(w, weapons.current, worn ? ` · ${worn.name}` : ''); }),
    onEquip: (id) => weapons.select(id as WeaponId),
    tools: () => toolEntries(weapons.tools, (key) => app.levelRegistrations.findText(key) ?? key),
    icons: kit.bagIcons,
    ...boot.runtime.menu,
  });
  hud.menu = menu; // pause → Settings tab; the menu's CLOSE → hud.onResume
  // pause ▸ Settings ▸ SAVES (SF33b, G83): a card per shard save, NEW GAME's before → after sheet; HERE is the grid cell you stand in, else this shard's copy
  const homeInstance = ((): string => { try { return firstPartyInstance(manifest.slug); } catch { return manifest.slug; } })();
  installSavesSettings(menu, { scope: game.levelScope, grid: grid !== null,
    ...(gridLive === null ? {} : { beforeReset: () => {
      const commit = gridLive.prepareNewGameRecovery();
      return () => { commit(); game.hold = true; };
    } }),
    here: () => { const cell = gridCells.cell; return grid === null ? { id: homeInstance, shard: manifest.slug } : cell === null ? null : { id: cell.instance, shard: cell.slug }; } });
  describeKeyBindings(game.levelScope); // pause ▸ Settings ▸ Key bindings: the plain-named table (E357 J10)
  game.onUpdate((dt) => { if (session.ownedGridHome !== true && hud.entered && !menu.isOpen) progress.addPlay(dt); }, 'main.6'); // owned regional progress has its own entered clock
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
  const loadFeedback = (): Promise<Feedback> => { feedback ??= loadFeedbackModule().then(({ Feedback: F }) => new F({
    capture: () => game.captureFrame(1280),
    context: () => (explore?.active === true ? { shard: manifest.slug, ...explore.context(), tier: TIER, fps: game.stats.fps, calls: game.lastFrame.calls, tris: game.lastFrame.triangles } : {
      shard: manifest.slug, pos: [player.position.x, player.position.y, player.position.z].map((v) => Number(v.toFixed(2))),
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
      game.levelScope.timeout(400, () => { if (!document.pointerLockElement && hud.entered && !menu.isOpen && !feedbackHeld) hud.setPaused(true); });
    },
    toast: (t) => { if (explore?.active === true) explore.toast(t); else hud.toast(t); },
    touch: touchUi,
  })); return feedback; };
  app.input.bind('quickNote', () => { if (quickNote() && hud.entered && !menu.isOpen && !feedbackHeld) void loadFeedback().then((f) => f.openQuick()); }, game.levelScope);
  menu.onFeedbackTab = (panel) => { void loadFeedback().then((f) => f.mountTab(panel)); };
  // the ✎ NOTE tag: a tag of the base HUD's status column (src/engine/ui/hudSlots.ts), under the rows
  const noteDisc = document.createElement('button'); noteDisc.type = 'button'; noteDisc.className = 'ws-fb-disc';
  noteDisc.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 20l1-4L16 5l3 3L8 19z M14 7l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>Note<b class="ws-fb-badge"></b>';
  hudSlots.pill(noteDisc, () => { if (hud.entered && !feedbackHeld) void loadFeedback().then((f) => f.openSheet()); }, game.levelScope);
  const noteBadge = noteDisc.querySelector('b');
  const syncNoteDisc = () => {
    noteDisc.classList.toggle('show', quickNote() && touchUi() && hud.entered);
    const q = queuedCount(); noteDisc.classList.toggle('queued', q > 0); if (noteBadge) noteBadge.textContent = String(q);
  };
  onReview(syncNoteDisc);
  progress.onEarned = (d) => { if (app.events.ask('feat.toast', { id: d.id, ...(d.event === undefined ? {} : { event: d.event }), allowed: true }).allowed) hud.toast(`Achievement · ${d.name} — title unlocked: ${d.title}`); if (!audio.cue('cue.feat.earned')) audio.hitMarker(); }; // a Nalati chapter's own caption announces its title
  const masterGain = () => { if (!audio.muted) audio.master.gain.setTargetAtTime(0.6 * getNumber('volume'), audio.ctx.currentTime, 0.05); };
  onNumber('volume', masterGain);

  const hands = new Hands(sky, game.camera, swimArms ?? null); // the swimming hands (shown only while player.swimming): the shard's arm rig swimming (Driftwood, E334), else white gloves
  const combatCues = new CombatCues(kit.combatCues(audio, boot.runtime.hooks.meleeSilent === true));
  if ('onHeavy' in crossbow) crossbow.onHeavy = () => { combatCues.cue(crossbow.row.cues?.heavy ?? 'cue.sword.heavy'); };
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
  weapons.placePickups(chunk.loadout ?? {}, { prompts: boot.runtime.interactables, owned: {
    has: (id) => { if (!isOwnedId(id)) throw new Error(`Unknown owned equipment: ${id}`); return owned.has(id); },
    grant: (id) => { if (!isOwnedId(id)) throw new Error(`Unknown owned equipment: ${id}`); owned.grant(id); },
  },
    onNear: (inside) => audio.pickupHum(inside),
    onPickup: (row) => { audio.hitMarker(); music.sting('pickup'); hud.pickupCard({ name: row.ui.name, icon: row.ui.icon }); },
    hold: params.get('weapon') === 'iron' ? 'weapon.sword-iron' : undefined });
  // ── Nalati's adventure (NALATI-MERGE Q1–Q5: the camp's people, the quest line, places with saved discovery on the full map;
  // src/shards/nalati-grasslands/adventure.ts on the shared quest core) — null on any other shard ──
  // Registered cosmetics restyle the held model and persist in this shard's locker.
  const weaponModel = (w: SkinDef['weapon']) => { const model = weapons.get(w).model; return model instanceof THREE.Group ? model : null; };
  const wearSkin = (skin: SkinDef) => { const m = weaponModel(skin.weapon); if (m) { applySkin(m, skin, sky); effects.sync(weapons.get(skin.weapon), [{ id: `effect.finish.${skin.id}` }]); } skins.wear(skin.weapon, skin.id); };
  animals.onKill = (a) => {
    // a sword kill is at arm's length: "Reef crab · 1 m" read as a marker to crabs 30 m off (E296); a shot keeps its distance
    hud.killFeed(game.level.fight.telegraphed === true ? `${a.label} killed` : `${a.label} · ${Math.round(a.position.distanceTo(player.position))} m`); progress.recordKill(a.kind, a.variant);
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
    player, directional: () => game.level.fight.telegraphed === true || boot.runtime.hooks.directional === true,
    flash: () => hud.damageFlash(), toast: (text) => hud.toast(text),
    combat: (value) => music.combat(value), hurt: (strength, pan) => audio.hurt(strength, pan), land: (hard) => audio.land(hard),
    arc: (x, z, at, yaw, damage) => hurtArc.hit(x, z, at, yaw, damage),
    trauma: (value) => CameraFX.for(game).addTrauma(value),
  });
  animals.onCharge = (a, raw) => playerHurt.creature(a, raw);
  animals.onSound = (name, pos) => { audio.animal(name, pos, player.position, player.yaw); };
  // E297 fight rules (Driftwood): an amber edge chevron toward an enemy winding up where you can't see it (src/engine/ui/WindupWarn.ts);
  // chained after the wind-up's sound cue
  const windupWarn = Number.isFinite(game.level.fight.attackers) ? new WindupWarn<(typeof animals.animals)[number]>() : null;
  // the session owns the wind-up hook: the typed 'ai.windup' event first (listeners subscribe there), then the sound cue, then the edge chevron
  animals.onWindup = (a, duration) => { app.events.emit('ai.windup', { actor: a.combatActor(), duration }); audio.cue('cue.ai.windup', { kind: a.kind, point: a.position }); windupWarn?.start(a, duration); };
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
    const ph = app.physics;
    return { animals: alive, near, motors, chase, flee, elite: boot.runtime.hooks.eliteEngaged?.() === true ? 1 : 0, bodies: ph?.world.bodies.len() ?? 0, colliders: ph?.world.colliders.len() ?? 0, 'fx chips': Impacts.for(game).mesh.count };
  });
  player.onStep = (sprinting) => {
    const p = player.position;
    const surface = app.events.ask('player.stepSurface', { x: p.x, y: p.y, z: p.z, surface: boot.runtime.hooks.stepSurface?.(p) ?? 'litter' }).surface;
    if (!(player.wading && player.depth > 0.3) && audio.cue(`cue.step.${player.wading ? 'water' : surface}`, { speed: Math.hypot(player.velocity.x, player.velocity.z) })) return;
    if (player.wading) audio.wadeStep(player.depth, sprinting);
    else { const hoof = audio.hoofSurfaceAt?.(p.x, p.z); audio.footstep(sprinting, hoof !== undefined ? (hoof === 'wood' ? 'planks' : hoof) : surface); }
  };
  player.onEnterWater = (impact) => audio.splash(impact);
  player.onSubmerge = () => { audio.dive(); audio.cue('cue.player.dive'); audio.setUnderwater(true); music.setState({ underwater: true }); };
  player.onSurface = () => { audio.surface(); audio.cue('cue.player.surface'); audio.setUnderwater(false); music.setState({ underwater: false }); };
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
      if (gridLive !== null && !gridLive.ownsHomeRecovery()) return;
      const p = player.position, ph = app.physics;
      const floor = ph ? floorBelow(ph, p.x, p.z, p.y + 0.6, 1.2) : undefined; // real walkable footing under the feet
      const grounded = floor !== undefined && Math.abs(floor - p.y) < 0.3 && player.onGround && !player.swimming && !player.wading && !player.hover
        && !player.carried && player.ride === null && floor > (app.world.water.level ?? -Infinity) + 0.3;
      lastPlace.observe({ x: p.x, y: floor ?? p.y, z: p.z, grounded });
    }, 'last place');
  }
  const die = (by: DeathCause | undefined): void => {
    const stand = gridLive !== null && !gridLive.ownsHomeRecovery() ? null : lastPlace?.stand ?? null;
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
      if (!checkpoint || (gridLive?.spawn() ?? null) !== null) die(cause);
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
  const resuming = session.recovery !== undefined || params.has('glreload');
  const arrival = session.arrival;
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
    const { Explore: X } = await loadExplore();
    const t1 = performance.now();
    recordBootCheckpoint('explore:imported');
    explore ??= new X({ world, title: { name: manifest.name, landscape: manifest.card.landscape, thumb: manifest.card.thumb }, onExit: exitExplore, onPractice: () => { hud.enterArenaNow(); }, onPlayground: (id) => { void enterPlayground(id); }, openFeedback: () => { void noteSheet(); }, hide: [boundary.group], creatures: animals.animals,
      overhead: boot.runtime.overhead });
    const t2 = performance.now();
    recordBootCheckpoint('explore:constructed');
    explore.open(mode, opts);
    if (isDev() && setting('memorySaver') === 'off') void arena.preload(); // the hub's Practice card (Developer mode): its dummies load now, not when it opens (E291; not with the Memory saver, SF22d)
    console.info(`[explore] open: import ${Math.round(t1 - t0)} ms · build ${Math.round(t2 - t1)} ms · open ${Math.round(performance.now() - t2)} ms`);
  };
  const exploreParam = params.get('explore');
  const exploreMode: ExploreMode = exploreParam === 'world' || exploreParam === 'model' || exploreParam === 'sets' ? exploreParam : 'hub';
  hud.onExplore = () => { void openExplore('hub'); };
  // Not a frame is rendered or ticked while the menu is up: hud.entered is the gate.
  game.frameGate = () => ((hud.entered && !hud.paused) || exploring()) && !feedbackHeld && !rotateGated() && !shardCompleteUp() && (gridLive?.gameplayReady() ?? true); // Entered runtime installation finishes before another input or gameplay tick.
  if (menuFirst) { weapons.setEnabled(false); weapons.visible = false; perf.setActive(false); audio.worldMuted = true; hud.showIntro(enter); }
  else if (arrival?.mode === 'explore') { weapons.setEnabled(false); weapons.visible = false; perf.setActive(false); hud.setOnEnter(enter); } // Explore ▸ Practice enters through it without the title: no handler left the weapon off and the DODGE disc dead (E285)
  else { hud.markEntered(enter); weapons.setEnabled(!nolock || params.has('skipintro')); }
  // the grid's player-facing moments: G98's sky-down reveal to the pier (it waits for the rings and the home handoff), then
  // G78's SAFE ZONE + dimmed ATTACK on the road, G82 / G105's title card on entering a shard, G97's speed look (gridHud.ts)
  if (grid !== null) {
    const revealing = session.recovery === undefined ? installGridReveal({ scope: game.levelScope, camera: game.camera, hudRoot: hud.root, onLate: (fn) => { game.onLate(fn, 'game.grid.reveal'); },
      home: chunk.name, ringsReady: () => grid.ringsReady(), homeSimReady: () => !gridHomeSim.pending, weapons, viewmodel: game.viewmodel, entered: () => hud.entered }) : () => false;
    const gridHud = installGridHud({ scope: game.levelScope, hudRoot: hud.root, camera: game.camera, cells: gridCells,
      title: (cell) => { const shard = findShard(cell.slug); return { name: shard?.name ?? cell.slug, subtitle: shard?.biome ?? '' }; },
      accent: (cell) => { const id = findShard(cell.slug)?.accent; return id === undefined ? null : ACCENTS[id]; },
      velocity: () => player.velocity, live: () => hud.entered && !hud.paused && !revealing(),
      onInput: (fn) => { game.onInput(fn, 'game.grid.hud.fov'); }, onLate: (fn) => { game.onLate(fn, 'game.grid.hud'); } });
    // G107: the minimap blends at the road boundary (the shard + the road + the neighbours' names inside; faded terrain on the road)
    const blend = installMinimapBlend(minimap, { assembly: grid.assembly, home: grid.home, cells: gridCells, worldFeet: () => grid.worldFeet(), image: (id) => grid.mapImage(id),
      name: (cell) => findShard(cell.slug)?.name ?? cell.slug }, game.levelScope);
    // SF38 / G30: Developer mode's points budget over the one live allocator (no element or timer until Developer is on)
    const slugCount = new Map<string, number>();
    for (const cell of grid.assembly.cells) slugCount.set(cell.slug, (slugCount.get(cell.slug) ?? 0) + 1);
    const cellName = new Map(grid.assembly.cells.map((cell) => { const name = findShard(cell.slug)?.name ?? cell.slug; return [cell.instance, (slugCount.get(cell.slug) ?? 0) > 1 ? `${name} ${cell.cell[0]},${cell.cell[1]}` : name]; }));
    const cellCost = new Map(grid.assembly.cells.map((cell) => [cell.instance, findShard(cell.slug)?.runtimeCost] as const));
    const budget = installBudgetOverlay({ scope: game.levelScope, hudRoot: hud.root, allocator: grid.allocator, name: (owner) => cellName.get(owner) ?? owner, shard: (owner) => cellName.has(owner),
      measuredMB: (owner) => { const cost = cellCost.get(owner); return cost === undefined ? null : cost.webContentMB + cost.glMB; } });
    game.levelScope.onDispose(app.debug.scopedExpose('gridBudget', budget));
    game.levelScope.onDispose(app.debug.scopedExpose('gridHud', { state: gridHud, minimap: () => { const o = blend(); return { baseAlpha: o.baseAlpha ?? 1, images: o.images.map((m) => ({ x: m.x, z: m.z, alpha: m.alpha })), labels: o.labels.map((l) => l.text) }; } }));
  }
  // ?explore=hub|world|model|sets[&cam=x,y,z,yaw,pitch][&model=id] — straight into the viewer (a shard with ShardManifest.explore — D4, E66; a note's "go there")
  if (exploreParam !== null && chunk.explore !== undefined) {
    const cam = (params.get('cam') ?? '').split(',').filter((v) => v !== '').map(Number);
    const model = params.get('model');
    hud.onExplore = () => { hud.onExplore = () => { void openExplore('hub'); }; void openExplore(exploreMode, { ...(cam.length >= 3 ? { cam } : {}), ...(model !== null ? { model } : {}) }); };
    hud.startExplore();
  }
  // the first gesture builds the AudioContext; on the title screen it also starts the title theme (synth, then the title stems)
  const firstGesture = () => { audio.resume(); if (!hud.entered && !music.isPlaying) music.play('theme'); };
  app.input.firstGesture(firstGesture, game.levelScope);

  // ── interaction (doors, chests, pickups, carcasses): the nearest one within its radius that the eye can SEE (PHYSICS P5 —
  // a Rapier ray from the camera; a door or chest behind a wall neither prompts nor opens) ──
  // a cabin door's prompt stands 0.5 m out from its leaf: seen from inside, the shut leaf is its own body, not a wall
  const carcassAt = new THREE.Vector3();
  let prompt: string | undefined;
  let nearest: (typeof boot.runtime.interactables)[number] | undefined;
  let carcass: (typeof animals.animals)[number] | undefined;
  app.input.bind('use', () => {
    if (!hud.entered) return;
    if (nearest) { tap.use?.(nearest.label); nearest.onInteract(); }
    else if (carcass && boot.runtime.hooks.harvestBusy?.() !== true) {
      const selectedCarcass = carcass;
      harvested.add(selectedCarcass);
      const drops = inventory.harvest(carcass.kind, carcass.variant); // Pine Hollow: only what Mott takes (E314 C)
      const give = (): void => {
        const got = drops.filter((id) => inventory.add(id)); // the toast names only what went in
        const said = `${got.map((id) => ITEMS[id].label).join(' + ') || 'Nothing'} harvested · ${inventory.total} in the pack`, first = got[0];
        if (first === undefined) hud.toast(said);
        else hud.pickupCard({ name: got.map((id) => ITEMS[id].label).join(' + '), icon: ITEMS[first].icon, detail: `${inventory.total} in the pack` });
        audio.hitMarker();
      };
      if (boot.runtime.hooks.harvest) boot.runtime.hooks.harvest(selectedCarcass, give, () => { harvested.delete(selectedCarcass); }); // PH-F2: the skinning beat, then the drops; the carcass stays for the ravens
      else { give(); carcass.fadeOut(); }
    }
  }, game.levelScope);

  // G107: in the grid the minimap reads the home frame's metres (the traveller's own position is its current frame's)
  const mapAt = (): { x: number; z: number } => {
    if (grid === null) return player.position;
    const feet = grid.worldFeet(); return { x: feet.x - grid.home.origin.x, z: feet.z - grid.home.origin.z };
  };
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
  app.addSystem({ id: 'engine.creatures.update', phase: 'update', after: ['main.world'], before: ['main.equipment'], run: (dt, t) => {
    const homeActive = grid === null || gridLive === null || (session.ownedGridHome !== true && gridLive.live.current() === grid.home.instance);
    aimList.length = 0;
    if (homeActive) {
      animals.update(dt, t, player.position, player.sprinting, viewer(), game.camera);
      aimList.push(...app.events.ask('combat.aimTargets', animals.animals.filter((a) => a !== player.mountedOn)));
    } else if (gridLive !== null) {
      aimList.push(...app.events.ask('combat.aimTargets', gridLive.aimAnimals().filter((a) => a !== player.mountedOn)));
    }
  } }, game.levelScope);
  app.addSystem({ id: 'main.equipment', phase: 'update', after: ['engine.creatures.update'], before: ['engine.audio.listener'], run: (dt, t) => {
    mark('animals');
    weapons.update(dt, t); // every weapon ticks (bolts in flight keep flying while the rifle is out)
    boot.runtime.hooks.equipmentUpdate?.(dt); weaponStrip.update();
    boot.runtime.hooks.updatePickups?.(dt, t);
    weapons.updatePickups(dt, t);
    mark('player');
  } }, game.levelScope);
  app.addSystem({ id: 'engine.audio.listener', phase: 'update', after: ['main.equipment'], before: ['main.frame'], run: () => {
    audio.listenerYaw = player.yaw;
  } }, game.levelScope);
  app.addSystem({ id: 'main.frame', phase: 'update', after: ['engine.audio.listener'], before: ['engine.player.hud'], run: (dt) => {
    boot.runtime.hooks.audioUpdate?.(dt);
    mark('audio');

    // nearest interactable
    const physics = app.physics;
    nearest = pickInteractable(boot.runtime.interactables, game.camera.position, physics);
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
    if (prompt !== undefined && game.level.fight.telegraphed === true) {
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
    hud.setBoundaryWarning(grid === null && !away() && edge < 14 && hud.entered); // in the grid the chunk edge is a seam, not a boundary
    hud.setAimInfo(aimReadout(weapons.aimInfo)); // a boss by its name (PH-C1)
    lockOn.update();
    speedLines.update(dt, player.dashing, meleeLock.lunging);
    if (hud.entered) { hud.setAnimals(away() ? [] : animalPositions(animals.animals)); minimap.update(mapAt(), player.yaw, away() ? [] : animals.animals); fullMap.update(player.position, player.yaw); } // a practice room's map is its own (Minimap.setRoom, E321), not the shard's terrain
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
  if (session.recovery === undefined && at.length >= 3 && at.every((v) => Number.isFinite(v))) {
    const [x = 0, y = 0, z = 0, yaw = player.yaw, pitch = 0] = at;
    // y is in the level's authored frame (every `?at=` writer takes the runtime datum off, G164): stand on the same ground in either state
    player.position.set(x, y + terrainDatum(), z); player.yaw = yaw; player.pitch = pitch;
  }
  // back from a GPU-recovery reload (E54): the pose is applied; take it off the address so a later reload spawns as usual
  if (params.has('glreload')) { const u = new URL(location.href); u.searchParams.delete('glreload'); u.searchParams.delete('at'); history.replaceState(history.state, '', u); }

  app.ui.bind(game.levelScope, () => hud.promptText);
  boot.runtime.play = { animals, weapons, primary: crossbow, rifle, secondary: longbow, inventory, owned, progress, hud, menu, fullMap, audio, music, skins, wearSkin, touchUi, nolock, disposeRifleDrop: () => { boot.runtime.hooks.disposeRifleDrop?.(); }, cues: combatCues, firstHints, minimap, bodyShadow };
  const getPlayground = (): Playground | null => playground;
  return { ...ctx, gridLive, leakPhysics, perf, audio, music, playerHealth, exploring, hands, windupWarn, resuming, arrival, menuFirst, enter, getPlayground };
}

export const playStage: typeof buildPlay = buildPlay;
