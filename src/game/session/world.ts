import { INPUT_CONTEXTS } from '../inputContexts';
import { type Audio as LevelAudio, Audio } from '@wildshard/engine/audio/Audio';
import { type Music as LevelMusic, Music } from '@wildshard/engine/audio/Music';
import type { LevelContext } from '@wildshard/engine/level/context';
import { toLevelSpec } from '../shard/spec';
import { gridLevel } from '../grid/session';
import { gridPageShellLevel } from '../grid/pageShell';
import type * as THREE from 'three';
import type { dataStage } from './data';
import { asShell } from '@wildshard/engine/app/ownership';
import { app } from '@wildshard/engine/app/runtime';
import { markBootContextLost, markBootHandledError } from '@wildshard/engine/boot/bootTrace';
import { macrotask } from '@wildshard/engine/boot/plan';
import { bootstrap } from '@wildshard/engine/core/bootstrap';
import { TIER } from '@wildshard/engine/core/tier';
import { installEntrySockets } from '@wildshard/engine/physics/entrySockets';
import { pathRampDescs } from '@wildshard/engine/physics/paths';
import { showError } from '@wildshard/engine/ui/ErrorModal';
import { Boundary } from '@wildshard/engine/world/Boundary';
import { hasPond, heightAt, normalAt, TRAILS } from '@wildshard/engine/world/Heightfield';
import { Horizon } from '@wildshard/engine/world/Horizon';
import { HorizonMatte } from '@wildshard/engine/world/HorizonMatte';

async function buildWorld(ctx: Awaited<ReturnType<typeof dataStage>>, level: LevelContext | undefined) {
  const { manifest, boot, session, audioProfile, plan, step } = ctx;

  const selected = { ...manifest, spawn: boot.handoff?.arrive ?? manifest.spawn };
  const world = Object.assign(await bootstrap(step, session.ownedGridHome ? gridPageShellLevel(selected) : gridLevel(toLevelSpec(selected)), INPUT_CONTEXTS), { chunk: manifest });
  const { game, sky, player, forest, params, chunk, registry } = world;
  if (!session.ownedGridHome) installEntrySockets(world.physics, game.levelScope, [{ x: 0, z: 0 }]);
  app.params = params;
  boot.runtime.world = world; boot.runtime.step = step;
  if (level !== undefined) game.rootScene.add(level.root);
  // Fragile phone builds need a GPU guard before normal in-game recovery is installed.
  const fragileBoot = TIER === 'phone' && manifest.boot?.phone?.fragile === true;
  let bootGpuGuardActive = fragileBoot;
  let bootGpuExit = false;
  const failGpuBoot = (reason: string, stack = ''): void => {
    if (!bootGpuGuardActive || bootGpuExit) return;
    bootGpuExit = true;
    session.fatalShown = true;
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
  if (fragileBoot) game.levelScope.listen(game.canvas, 'webglcontextlost', onBootContextLost);
  const nolock = params.has('nolock');
  // what the view-dependent layers (ground cover, grass, mist) fill around: the player, or Explore's free camera (E66)
  const viewer = (): THREE.Vector3 => (world.freeCamera ? game.camera.position : player.position);
  boot.runtime.viewer = viewer;
  // a structure-first shard (ShardManifest.ground.structures, Nine Dragon Stack): no ground cover / cabins / props / walkways — its world is built in the props step
  const built = game.level.ground.structures;

  // ── world dressing ──
  const edgeDressing = await step('edge', async () => {
    const boundary = new Boundary(sky, game.level.boundary).build();
    game.rootScene.add(boundary.group);
    await macrotask(); // boundary · water · horizon each in its own task
    const water = hasPond() ? new (await import('@wildshard/engine/world/pond')).Water(sky, forest.trees, { ...(chunk.pondClip === undefined ? {} : { clip: chunk.pondClip }), ...(chunk.pondLilyExclusions === undefined ? {} : { lilyExclusions: chunk.pondLilyExclusions }) }).build() : null;
    if (water) game.rootScene.add(water.group);
    // PH-L9: Pine Hollow's creek, waterfall, plunge foam and spray (two draws; they run on the wind clock)
    const streams = null;
    await macrotask();
    const horizon = new Horizon(sky).build(game.level); // the booted spec: in the grid its own horizon yields to the cube (gridLevel, G99)
    game.rootScene.add(horizon.group);
    // the painted 360° horizon (X4): far sea stacks, islands and cloud banks on the sea, day + night; the paintings load after boot
    const seaBody = app.world.water.sea; // registered at level.data, before the edge step
    const matte = seaBody !== null ? new HorizonMatte(sky, seaBody.level).build() : null;
    if (matte?.mesh) {
      game.rootScene.add(matte.mesh);
      game.onUpdate((dt) => { matte.update(dt, game.camera, sky.dayNight?.night ?? 0); }, 'main.2');
      game.levelScope.listen(document, 'ws:ready', () => { game.levelScope.timeout(250, () => { void matte.load(horizon.group); }); }, { once: true });
    }
    return { boundary, water, streams, horizon };
  });
  const { boundary, water, horizon } = edgeDressing;
  boot.runtime.horizonVeil = horizon.painted?.veil ?? null;
  // the paths as walkways where they cross ground steeper than the motor climbs (PHYSICS P4) — now that the decks are
  // registered, none where a deck carries the path (a board there pokes up through the bridge's planks); Nalati's decks
  // register in its props step (NALATI-MERGE P1), so its paths are laid after that. heightAt / normalAt / TRAILS are
  // Heightfield's live bindings, read when the paths are laid: bootstrap installs the baked grid after this module loads,
  // and a copy taken earlier (the analytic field) laid 12 more ramps on Pine (R5)
  const addPaths = (): void => { registry.add({ id: 'paths', name: 'Paths', category: 'ground', file: 'src/engine/physics/paths.ts', surface: 'ground',
    colliders: pathRampDescs(TRAILS, heightAt, (x, z) => normalAt(x, z)[1], { carried: (x, z) => registry.floorAt(x, z) !== undefined }) }); };
  if (chunk.ground.paths !== 'plugin' && built === undefined) addPaths();

  if (manifest.boot?.stagedWorld !== true) {
    await step('grass', () => undefined);
    await step('cabins', () => undefined);
  }
  const props = null;
  // Plugins need their audio service in kit; legacy levels retain their original allocation order.
  let preparedAudio: { audio: LevelAudio; music: LevelMusic } | undefined;
  const prepareAudio = (): { audio: LevelAudio; music: LevelMusic } => {
    if (preparedAudio) return preparedAudio;
    const audio = new Audio(manifest.audio);
    if (params.has('mute')) { audio.muted = true; audio.master.disconnect(); } // headless tests / captures: never make a sound
    // the Wildshard theme (project/archive/2026-09-23-music.md): the same score as the trailer, adaptive in play — menu / calm / alert / combat / underwater + stings
    // the page's one score (the shell's): built with the first shard, routed through the running shard's master (Music.attach)
    const music = session.music ?? asShell(() => new Music(audio));
    session.music = music;
    music.attach(audio);
    music.setState({ mode: 'menu', intensity: 0, underwater: false });
    audio.music = music;
    audio.listenerPosition = player.position;
    app.audio = audio;
    preparedAudio = { audio, music };
    return preparedAudio;
  };
  const disableBootGpuGuard = (): void => { bootGpuGuardActive = false; };
  if (audioProfile) prepareAudio();
  return { ...ctx, world, game, sky, player, forest, params, chunk, registry, fragileBoot, failGpuBoot, onBootContextLost, nolock, viewer, edgeDressing, boundary, water, horizon,
    get interactables() { return boot.runtime.interactables; }, props, prepareAudio, disableBootGpuGuard, level };
}

export const worldStage: typeof buildWorld = buildWorld;
