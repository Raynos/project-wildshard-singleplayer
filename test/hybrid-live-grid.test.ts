// oxlint-disable-next-line import/no-nodejs-modules -- The integration fixture uses the production Rapier binary.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { WorldRegistry } from '../src/engine/world/registry';
import { createLevelInstallation } from '../src/engine/level/installation';
import { Physics } from '../src/engine/physics/Physics';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { loadRapier } from '../src/engine/physics/rapier';
import { Events } from '../src/engine/events/events';
import { PlayerHealth } from '../src/engine/combat/health';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { emptyShardfile } from '../src/sdk/author';
import { GridAssembly } from '../src/game/grid/assembly';
import { GridCellEvents } from '../src/game/grid/boot';
import { LiveGridHost } from '../src/game/grid/live';
import { GridCrossing } from '../src/game/grid/crossing';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { shardContext } from '../src/game/shard/context';
import { ShardPlugin } from '../src/game/shard/plugin';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { emptyShardfileSource } from '../src/game/shardfile/loader';
import { HybridShardPlugin } from '../src/game/shardfile/hybrid';
import { prepareTrustedRuntime } from '../src/game/shardfile/runtime';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const noop = (): void => undefined;
it('admits a hybrid at the strip before hooks run, then freezes its real regional sim until entered play is ready', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const app = new App(); app.registryValue = new WorldRegistry();
  const assembly = new GridAssembly({ developer: true, devserver: false }), cells = new GridCellEvents();
  const homePhysics = new Physics(rapier), position = new Vector3(0, 0, 299), owner = {};
  const health = new PlayerHealth(new Events(), { now: () => 0, position: () => position, dodging: () => false, dodgeGuard: () => false });
  const player = { position, yaw: 0, health, owner,
    motor: new CharacterMotor(homePhysics, { radius: 0.35, height: 1.8, step: 0.3, maxClimbDeg: 45, snap: 0.2, group: 'PLAYER', blockedBy: ['WORLD'], owner }) };
  const source = emptyShardfile({ slug: 'pine-hollow', name: 'Fixture', author: 'Fixture', seed: 1, revision: 1 });
  const manifest = emptyShardfileSource(source), scope = app.engineScope.child('data:pine-hollow');
  const runtime: ShardRuntime = { world: null, step: null, play: null, hooks: {}, objects: {}, interactables: [], overhead: [], viewer: () => position, horizonVeil: null };
  const installation = createLevelInstallation(app, scope, {}, () => ({ set: noop, detail: noop }));
  const ctx = shardContext(installation.context, manifest, { shard: manifest, runtime, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });
  const hooks: string[] = [], ready: boolean[] = [], frames: (string | null)[] = [];
  let imported = false, gameplayReady = false, constructions = 0, release = noop, region: SimHost | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  class Runtime extends ShardPlugin {
    constructor() { super(); constructions++; }
    override world(): void { hooks.push('world'); }
    override kit(): void { hooks.push('kit'); }
    override async play(): Promise<void> { hooks.push('play'); await gate; }
  }
  class Data extends ShardPlugin {}
  const plugin = new HybridShardPlugin(new Data(), Runtime, { instance: 'pine-hollow', cells,
    readiness: (value) => { gameplayReady = value; ready.push(value); } });
  const create = (id: string) => createSimHost({ ...SIM_LEVEL, id, entities: [], quests: [], ground: { size: 2400, height: 0 } }, { rapier, playerBody: false });
  const registry = new LiveGridHost(assembly, {
    home: { instance: 'driftwood-isle', physics: homePhysics, bytes: 1000, checkpoint: () => true },
    player, allocator: new ResidencyAllocator(),
    highway: { bytes: 1000, create: () => { const host = create('platform.highway'); return { host, dispose: () => { host.dispose(); } }; } },
    admit: () => Promise.resolve({ bytes: 1000,
      prepareRuntime: async () => {
        await prepareTrustedRuntime({ entry: 'runtime/index.ts' }, 'pine-hollow', true,
          [{ slug: 'pine-hollow', entry: 'runtime/index.ts', load: () => { imported = true; return Promise.resolve({ default: Runtime }); } }]);
      },
      create: () => { const host = create('pine-hollow'); region = host; return Promise.resolve({ host, dispose: () => { host.dispose(); } }); },
    }),
    save: () => true, bindFrame: (frame) => { frames.push(frame.instance); },
    gameplayReady: (instance) => instance === 'driftwood-isle' || gameplayReady,
    readiness: { link: { speed: 15, linkBitsPerSecond: 1_000_000, requestLatencySeconds: 0.01, maxStallSeconds: 0.01 },
      bundle: () => ({ criticalWireBytes: 100, hybridWireBytes: 100, decodeSeconds: 0, runtimeParseSeconds: 0 }) },
  });
  const crossing = new GridCrossing(registry.current(), {
    prepare: (from, to) => registry.prepare(from, to), ready: (instance) => registry.ready(instance),
    checkpoint: (instance) => registry.checkpoint(instance), stow: noop, interior: noop, changed: noop,
  });
  try {
    await registry.prefetch(['pine-hollow']);
    expect(imported).toBe(true); expect(constructions).toBe(0); expect(hooks).toEqual([]); expect(registry.ready('pine-hollow')).toBe(true);
    expect(region?.hasPlayerMotor).toBe(false); expect(assembly.at(position.x, position.z)).toBeUndefined();
    crossing.request('pine-hollow');
    for (let turn = 0; turn < 12; turn++) await Promise.resolve();
    expect(crossing.step(false)).toBe(true); expect(registry.current()).toBe('pine-hollow');
    expect(frames).toEqual(['pine-hollow']); expect(constructions).toBe(0); expect(hooks).toEqual([]); expect(registry.state().gameplayReady).toBe(false);
    const active = region; if (active === undefined) throw new Error('Missing admitted region');
    for (let tick = 0; tick < 30; tick++) registry.afterPlayerStep();
    expect(active.state.tick).toBe(0); expect(active.hasPlayerMotor).toBe(false);
    // The frame is already committed at the strip; hooks begin only at the real cell interior.
    position.z = -249;
    expect(assembly.at(registry.worldFeet().x, registry.worldFeet().z)?.instance).toBe('pine-hollow');
    cells.enter({ instance: 'pine-hollow', slug: 'pine-hollow' });
    await plugin.world(ctx); await plugin.kit(ctx); const playing = plugin.play(ctx);
    for (let turn = 0; turn < 12; turn++) await Promise.resolve();
    expect(constructions).toBe(1); expect(hooks).toEqual(['world', 'kit', 'play']); expect(ready).toEqual([false]);
    for (let tick = 0; tick < 30; tick++) registry.afterPlayerStep();
    expect(active.state.tick).toBe(0); expect(registry.state().gameplayReady).toBe(false);
    release(); await playing; expect(ready).toEqual([false, true]); expect(registry.state().gameplayReady).toBe(true);
    for (let tick = 0; tick < 30; tick++) registry.afterPlayerStep();
    expect(active.state.tick).toBe(30); expect(active.player.position).toEqual(position);
    cells.leave(); expect(ready).toEqual([false, true, false]);
    for (let tick = 0; tick < 30; tick++) registry.afterPlayerStep();
    expect(active.state.tick).toBe(30); expect(registry.state().gameplayReady).toBe(false);
  } finally {
    release(); crossing.dispose(); scope.dispose(); registry.dispose(); player.motor.dispose(); app.engineScope.dispose(); homePhysics.dispose();
  }
});
