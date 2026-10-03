import { bagMenu } from '../bag/tabs';
import * as THREE from 'three';
import { retried, type BootRuntime, type LevelContext, type LevelSequence, type SkinDef } from '#engine';
import { toLevelSpec, shardContext, type ShardManifest, type GameServices, type ShardContext } from '../index';
import { runShardLoad, withShardHooks, ShardLoadError, type LoadStage } from '../shard/load';
import type { KitPorts, BuiltWorld, SessionState, StagedBoot, SessionContext } from './context';
import { installTemplateDebug } from '../shard/templateDebug';
import { dataStage } from './data';
import { worldStage } from './world';
import { loadoutStage } from './loadout';
import { playStage } from './play';
import { finishStage } from './finish';

declare const __BUILD_ID__: string;

/** Game presentation and plugin discovery belong to the game adapter, after the root selects content. */
export async function startSession(manifest: ShardManifest, engine: BootRuntime, kit: KitPorts): Promise<void> {
  const { app, pageSeed, consumeTitleArrival, Scope, enterOwner, setAliveSource,
    textureBytes, installErrorModal, markBootHandledError, showError } = engine;
  installErrorModal();
  const session: SessionState = { music: null, arrival: null, fatalShown: false };
  try {
    app.rng.seed(pageSeed(manifest.seed, window.__wildshardHarness?.seed));
    const selected = manifest.slug;
    session.arrival = consumeTitleArrival(selected);
    if (matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true) {
      const home = new URL(location.href);
      if (home.searchParams.has('chunk') || home.searchParams.has('v')) {
        home.searchParams.delete('chunk'); home.searchParams.delete('v');
        history.replaceState(history.state, '', home);
      }
    }
    const scope = new Scope('level');
    enterOwner(scope);
    const world = await runShardLoad(manifest, (stage) => withShardHooks(manifest, stage,
      () => buildSession(manifest, stage, engine, kit, session)), {
      build: __BUILD_ID__, dispose: () => {
        if (app.render !== null) app.render.hold = true;
        scope.dispose();
      }, report: engine.reportError,
      show: (failure) => { session.fatalShown = true; engine.showLoadFailure(failure); },
    });
    let memoryAt = -Infinity, memoryMB = 0;
    const memory = (maxAgeMs = 5000) => {
      const now = app.clock.real * 1000;
      if (now - memoryAt >= maxAgeMs) { memoryAt = now; memoryMB = Math.round(textureBytes(world.scene) / 1e5) / 10; }
      return { cap: 1, levels: [{ id: selected, running: true, textureMB: memoryMB }] };
    };
    app.levelAdapters.residentMemory = memory;
    setAliveSource(() => ({ slug: selected, resident: `${selected} (playing) ~${Math.round(memory(60_000).levels[0]?.textureMB ?? 0)} MB` }));
  } catch (error) {
    markBootHandledError();
    if (!session.fatalShown) showError(error instanceof Error ? `${error.name}: ${error.message}` : String(error), error instanceof Error ? error.stack ?? '' : '');
  }
}

async function buildSession(manifest: ShardManifest, stage: LoadStage, engine: BootRuntime, kit: KitPorts, session: SessionState): Promise<BuiltWorld> {
  const { app, registerLevelDebugRow, registerPlayground, LevelLoadError } = engine;
  const boot: StagedBoot = { handoff: null, items: new Map(), featTotal: undefined, skins: [],
    runtime: { world: null, step: null, play: null, interactables: [], overhead: [], objects: {}, hooks: {}, viewer: () => new THREE.Vector3(), horizonVeil: null },
    progress: { set: () => undefined, detail: () => undefined }, worldHook: (work) => work() };
  const sequence = sessionStages({ engine, kit, manifest, slug: manifest.slug, stage, session, boot });
  const loadPlugin = manifest.load;
  if (loadPlugin === undefined) {
    let next = await sequence.next();
    while (!next.done) next = await sequence.next();
    return next.value;
  }
  const scope = engine.currentOwner();
  if (scope === null) throw new Error('Plugin boot needs a level scope');
  const { default: Plugin } = await stage('manifest.load', () => retried(loadPlugin));
  const plugin = new Plugin();
  const game: GameServices = { runtime: boot.runtime, shard: manifest, rows: new Map(), bag: {
    tab: (spec) => { const menu = boot.runtime.play?.menu; if (menu === undefined) throw new Error('Bag plugin tabs require the play host'); return menu.addTab(spec); },
    fragment: (tab, fragment) => { const menu = boot.runtime.play?.menu; if (menu === undefined) throw new Error('Bag plugin fragments require the play host'); return bagMenu(menu).fragment(tab, fragment); },
  } };
  let context: ShardContext | undefined;
  const ctx = (level: LevelContext): ShardContext => { context ??= shardContext(level, manifest, game); return context; };
  app.levelAdapters.inputContext = (def) => {
    const child = scope.child(`input.${def.id}`); app.input.register(def, child);
    return () => child.dispose();
  };
  app.levelAdapters.debugRow = (spec) => registerLevelDebugRow(spec, manifest.slug);
  app.levelAdapters.playground = (spec) => registerPlayground(manifest.slug, spec);
  installTemplateDebug(app, app.engineScope);
  try {
    return await engine.bootLevel(toLevelSpec(manifest), {
      sequence, scope, progress: () => boot.progress,
      afterData: (spec) => { if (boot.handoff?.arrive) spec.spawn = boot.handoff.arrive; },
      dispose: () => {
        if (app.render !== null) { app.render.captureLevelResources(); app.render.hold = true; app.render.frameGate = () => false; }
      },
      hooks: {
        world: (level) => boot.worldHook(async () => { await plugin.world?.(ctx(level)); }),
        kit: async (level) => {
          ctx(level).rows.item(kit.items);
          ctx(level).rows.tool(kit.tools);
          await plugin.kit?.(ctx(level));
          boot.skins = [...(game.rows.get('skin')?.values() ?? [])] as SkinDef[];
          boot.items = game.rows.get('item') ?? new Map(); boot.featTotal = game.rows.get('feat')?.size;
        },
        play: (level) => plugin.play?.(ctx(level)),
      },
    });
  } catch (error) {
    if (error instanceof LevelLoadError) throw new ShardLoadError(error.stage, error);
    throw error;
  }
}

async function* sessionStages(ctx: SessionContext): LevelSequence<BuiltWorld> {
  const data = await dataStage(ctx);
  const level = yield 'world';
  const world = await worldStage(data, level);
  yield 'kit';
  yield 'loadout';
  const loadout = await loadoutStage(world);
  yield 'play';
  const play = await playStage(loadout);
  yield 'finish';
  return finishStage(play);
}
