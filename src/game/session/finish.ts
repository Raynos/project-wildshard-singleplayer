import type { BuiltWorld } from './context';
import { gridCells } from '../grid/boot';
import type { playStage } from './play';
import { asShell } from '@wildshard/engine/app/ownership';
import { app } from '@wildshard/engine/app/runtime';
import { primeAudioContext } from '@wildshard/engine/audio/Audio';
import { releaseByteCounter } from '@wildshard/engine/boot/bytes';
import { startAudioPreload } from '@wildshard/engine/boot/extras';
import { macrotask } from '@wildshard/engine/boot/plan';
import { loadExplore } from '@wildshard/engine/boot/runtime';
import { startShardPrefetch } from '@wildshard/engine/boot/shardPrefetch';
import { installGpuRecovery } from '@wildshard/engine/core/GpuRecovery';
import { TIER } from '@wildshard/engine/core/tier';
import { installProbe } from '@wildshard/engine/debug/probe';
import { lockOn as lockState } from '@wildshard/engine/player/AimTargets';
import { precompileLevel } from '@wildshard/engine/render/precompile';
import { textureBytes } from '@wildshard/engine/render/textureBytes';
import { setPoseProvider } from '@wildshard/engine/ui/ReloadPrompt';
import { registerBeforeReload } from '@wildshard/engine/boot/lastEnd';

export async function finishStage(ctx: Awaited<ReturnType<typeof playStage>>): Promise<BuiltWorld> {
  const { manifest, boot, slug, loading, audioProfile, files, bootSteps, plan, step, audioLoad, deferredAudio, world, game, sky, player, chunk, fragileBoot, failGpuBoot, onBootContextLost, edgeDressing, boundary, water, interactables, props, disableBootGpuGuard, level, animals, arena, crossbow, weapons, lockSys, hud, perf, audio, music, playerHealth, exploring, hands, windupWarn, resuming, arrival, menuFirst, enter, getPlayground, leakPhysics } = ctx;

  // The staged loader invokes the trusted play hook after buildPlay. Only a fully installed runtime can leave:
  // leaving during buildPlay disposes its kit scope before that hook runs and makes recovery fall back to title.
  if (ctx.session.ownedGridHome === true) {
    if (ctx.gridLive === null) throw new Error('Owned grid home requires its admitted live session');
    if (ctx.session.recovery?.saved?.location.kind === 'cell' || ctx.session.recovery === undefined) await ctx.gridLive.enterInitialHome();
  }
  if (ctx.session.recovery !== undefined) {
    if (ctx.gridLive === null) throw new Error('Recovery requires the admitted live grid');
    const pose = await ctx.gridLive.resumeRecovery(ctx.session.recovery);
    player.spawn(pose.x, pose.z, pose.yaw, pose.y); player.pitch = 0;
    if (pose.road) gridCells.leave();
  }
  if (ctx.gridLive !== null) {
    const grid = ctx.gridLive;
    // GPU/background own the same checkpoint port above; New game captured it before resetting and suppresses stale saves.
    registerBeforeReload(game.levelScope, reason => {
      if (reason === 'new-game' || reason === 'gpu' || reason === 'background') return true;
      const saved = grid.prepareRecovery('reload');
      if (saved) game.hold = true;
      return saved;
    });
  }

  await macrotask();
  game.buildComposer();
  // The first live late/render phases would otherwise publish the home PMREM and install its grade only after
  // shaders/firstFrame, invalidating every warmed world key. Settle the same presentation owners without a tick.
  ctx.grid?.prepareFrame();
  game.sky.prepareLayers();
  // Compile programs in batches with a visible count, then draw the first frames as a step —
  // instead of the first render() compiling ~100 programs in one stall (minutes on iOS).
  const programs = () => `${game.renderer.info.programs?.length ?? 0} programs`;
  try {
    await step('shaders', (p) => precompileLevel(game, (d, n, what) => p.set(d, n, `${what} · ${programs()}`)));
    if (fragileBoot && game.renderer.getContext().isContextLost()) throw new Error('WebGL context lost during shader compile');
    await step('firstFrame', (p) => game.firstFrame((d, n, what) => p.set(d, n, `${what} · ${programs()}`)));
    if (fragileBoot && game.renderer.getContext().isContextLost()) throw new Error('WebGL context lost during first frame');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (fragileBoot && /WebGLShader|WebGL context lost|shaderSource/i.test(message)) failGpuBoot(message.slice(0, 120), error instanceof Error ? error.stack ?? '' : '');
    throw error;
  }
  loading.setTextureBytes(textureBytes(game.rootScene));
  // Nine Dragon phone counts and caches the same files, then decodes selected audio after the loader's peak.
  if (deferredAudio) {
    await step('audio', (p) => deferredAudio.wait(p));
    // The synth bridges the short delay. This empty bank prevents Music.prepare() from decoding the
    // same selected style again if the player taps before the deferred decode finishes.
    music.useBank({ genre: deferredAudio.style, set: 'base', slots: new Map(), stings: new Map(), log: [] });
  } else {
    const banks = await step('audio', (p) => (audioLoad ?? startAudioPreload(files, chunk, audioProfile)).wait(p));
    if (banks.music) music.useBank(banks.music); // the title theme's first gesture plays the stems at once
    if (banks.profile) audio.useLevelBank(banks.profile); else audio.useSamples(banks.sfx);
  }
  const finishPlan: unknown = Reflect.get(plan, 'done');
  if (typeof finishPlan !== 'function') throw new Error('Boot plan cannot finish');
  Reflect.apply(finishPlan, plan, []); // throws unless both tracks are exactly 1
  releaseByteCounter();
  // an arrival enters at once (`enter` below resumes the audio): the page's AudioContext in a task of its own first (SF67)
  if (arrival?.mode === 'enter' || arrival?.mode === 'arena') { primeAudioContext(); await macrotask(); }
  // an app switch that takes the GPU (iOS): hold the loop, restore in place or reload where the player stood (E54)
  if (resuming) hud.setPaused(true); // RESUME is the gesture that brings the audio back (enter)
  const recoveryInstalledAt = performance.now();
  installGpuRecovery({ game, rebuild: () => { sky.rebuildEnvironment(); }, pose: () => (hud.entered ? { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, pitch: player.pitch } : null), resumed: resuming,
    ...(ctx.gridLive === null ? {} : { beforeReload: (reason: 'gpu' | 'background') => ctx.gridLive?.prepareRecovery(reason) === true }),
    fragileBoot: () => TIER === 'phone' && performance.now() - recoveryInstalledAt < 20_000,
  });
  disableBootGpuGuard();
  if (fragileBoot) game.levelScope.unlisten(game.canvas, 'webglcontextlost', onBootContextLost);
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
    game.levelScope.raf(() => { game.levelScope.timeout(0, () => { void decodeAfterBoot(); }); });
  }
  // E183: while the title idles, fetch the Explore code and draw the world's first frame once under the title art. The
  // first frame after the title paid every first-time cost at once — Pine Hollow's four elites built, the cover filled,
  // textures that arrived after the boot uploaded: EXPLORE WORLD's first tap stalled ~1.3 s at 4× CPU (and ENTER WORLD's
  // first frame the same). A return from the background already draws such a frame on the title (Game.start).
  if (menuFirst) game.levelScope.timeout(1200, () => {
    if (hud.entered || exploring()) return;
    if (chunk.explore !== undefined) void loadExplore();
    game.primeFrame();
  });
  const handle = { ...world, get physics() { return world.physics; }, boundary, water, streams: edgeDressing.streams, hands, props, animals, interactables, crossbow, hud, audio, music, lockSys, lockState, weapons, arena, playground: getPlayground, ...boot.runtime.objects };
  app.audio = audio;
  game.retainKitResources();
  ctx.session.residency?.bindComposer(game, game.engineScope, TIER);
  game.captureLevelResources();
  game.levelScope.onDispose(() => { windupWarn?.dispose(); weapons.setEnabled(false); boot.runtime.hooks.dispose?.(); audio.unloadLevel(); });
  installProbe(handle, { bootSteps, leakPhysics, health: () => playerHealth.attributes.health, quest: () => ({ adventure: boot.runtime.hooks.adventureFlags?.() ?? [], quest: boot.runtime.hooks.questFlags?.() ?? [] }) });
  document.dispatchEvent(new Event('ws:ready')); // booted to the title: the native shell's update watchdog (src/engine/native/boot.ts, via src/native.ts) waits for this
  // E158: the other shards' boot files into the worker's cache, in the background — once a page (the shell's, not a shard's)
  asShell(() => { startShardPrefetch(manifest); });


  const levelWorld: BuiltWorld = { scene: game.rootScene, dispose: () => {
    weapons.setEnabled(false); perf.setActive(false); audio.unloadLevel();
  } };
  game.levelScope.onDispose(levelWorld.dispose);
  return levelWorld;
}
