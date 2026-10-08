// oxlint-disable-next-line import/no-nodejs-modules -- Exercise ownership with the production Rapier binary.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { GridAssembly } from '../src/game/grid/assembly';
import { GridCrossing } from '../src/game/grid/crossing';
import { LiveGridHost, type LiveGridAdmission } from '../src/game/grid/live';
import { PageResidency } from '../src/game/grid/pageResidency';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const noop = (): void => undefined;
async function open(admit?: (instance: string, fallback: () => LiveGridAdmission) => Promise<LiveGridAdmission>) {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const assembly = new GridAssembly({ developer: false, devserver: false });
  const shell = createSimHost({ ...SIM_LEVEL, id: 'neutral.shell', entities: [], quests: [], ground: { size: 2400, height: 0 } }, { rapier });
  const player = { position: shell.player.position, yaw: 0, health: shell.player.health, owner: {}, motor: shell.releasePlayerMotor() };
  const platform = new Scope('neutral.platform'), owner = new PageResidency(), home = owner.admitHome('driftwood-isle', 20_000_000);
  const modules: string[] = [], creates: string[] = [], disposals: string[] = [], frames: (string | null)[] = [];
  const hosts = new Map<string, SimHost>(), saved = new Map<string, { tick: number; clock: ReturnType<SimHost['clock']['snapshot']>; flags: string[] }>();
  const counts = new Map<string, number>(), failDispose = new Set<string>();
  let quota = false, gameplay = false, shellSteps = 0, cancelled = 0;
  const fallback = (instance: string): LiveGridAdmission => ({ bytes: home.bytes, exclusiveRuntime: true, reloadsCheckpoint: true,
    prepareRuntime: () => { modules.push(instance); return Promise.resolve(); },
    cancel: () => { cancelled++; },
    create: () => {
      // An exclusive runtime can allocate only after the previous world has really been freed.
      expect(hosts.size).toBe(0);
      creates.push(instance);
      const host = createSimHost({ ...SIM_LEVEL, id: instance, entities: [], quests: [] }, { rapier, playerBody: false });
      const prior = saved.get(instance);
      if (prior !== undefined) { host.clock.restore(prior.clock); host.state.tick = prior.tick; for (const flag of prior.flags) host.flags.set(flag); }
      hosts.set(instance, host); counts.set(instance, host.physics.world.colliders.len());
      return Promise.resolve({ host,
        checkpoint: () => { if (quota) return false; saved.set(instance, { tick: host.state.tick, clock: host.clock.snapshot(), flags: host.flags.all }); return true; },
        dispose: () => {
          if (failDispose.has(instance)) throw new Error('Runtime disposal refused');
          disposals.push(instance); host.dispose(); hosts.delete(instance);
        },
      });
    },
  });
  const registry = new LiveGridHost(assembly, {
    home: { mode: 'owned', instance: home.instance, bytes: home.bytes, residency: home }, player, allocator: owner.allocator,
    continuations: 'durable', maxResidents: 1,
    highway: { bytes: 1000, create: () => ({ physics: shell.physics, dispose: () => { platform.dispose(); }, afterPlayerStep: () => { shellSteps++; } }) },
    admit: cell => admit === undefined ? Promise.resolve(fallback(cell.instance)) : admit(cell.instance, () => fallback(cell.instance)),
    save: () => true, gameplayReady: () => gameplay,
    bindFrame: frame => { frames.push(frame.instance); expect(frame.physics.world.getCollider(frame.motor.collider.handle)).toBe(frame.motor.collider); },
    readiness: { link: { speed: 15, linkBitsPerSecond: 1_000_000, requestLatencySeconds: 0.01, maxStallSeconds: 0.01 },
      bundle: () => ({ criticalWireBytes: 100, hybridWireBytes: 100, decodeSeconds: 0, runtimeParseSeconds: 0 }) },
  });
  const finish = (): void => { failDispose.clear(); registry.dispose(); owner.dispose(); player.motor.dispose(); shell.dispose(); };
  return { registry, player, shell, platform, owner, modules, creates, disposals, frames, hosts, saved, counts, failDispose, finish,
    quota: (value: boolean) => { quota = value; }, gameplay: (value: boolean) => { gameplay = value; },
    shellSteps: () => shellSteps, cancelled: () => cancelled };
}

it('enters its owned home from the neutral shell and disposes it before allocating the next runtime', async () => {
  const f = await open(), { registry, owner } = f;
  const crossing = new GridCrossing(registry.current(), { prepare: (from, to) => registry.prepare(from, to),
    ready: id => registry.ready(id), checkpoint: id => registry.checkpoint(id), stow: noop, interior: noop, changed: noop });
  const settle = async (): Promise<void> => { for (let turn = 0; turn < 40; turn++) await Promise.resolve(); };
  try {
    const shellCount = f.shell.physics.world.colliders.len();
    expect(registry.current()).toBeNull(); expect(registry.ready('driftwood-isle')).toBe(false);
    expect(owner.allocator.entries()).toMatchObject([{ id: 'sim:driftwood-isle', bytes: 20_000_000, refs: 1 }, { id: 'sim:platform.highway' }]);
    expect(() => owner.home().retain()).toThrow('handed off');
    await registry.prefetch(['pine-hollow', 'driftwood-isle', 'pine-hollow']);
    expect(f.modules).toEqual(['driftwood-isle', 'pine-hollow']); expect(f.creates).toEqual([]);
    expect(registry.ready('pine-hollow')).toBe(false);
    for (let tick = 0; tick < 30; tick++) registry.afterPlayerStep();
    expect(f.shellSteps()).toBe(30); expect(f.shell.state.tick).toBe(0);
    crossing.request('driftwood-isle'); await settle(); expect(crossing.step(false)).toBe(true);
    const first = f.hosts.get('driftwood-isle'); if (first === undefined) throw new Error('Missing initial owned region');
    expect(first.hasPlayerMotor).toBe(false); expect(first.physics.world.colliders.len()).toBe((f.counts.get('driftwood-isle') ?? 0) + 1);
    expect(f.shell.physics.world.colliders.len()).toBe(shellCount - 1);
    expect(owner.allocator.entries().find(row => row.id === 'sim:driftwood-isle')).toMatchObject({ bytes: 20_000_000, refs: 1 });
    for (let tick = 0; tick < 30; tick++) registry.afterPlayerStep();
    expect(first.state.tick).toBe(0); f.gameplay(true);
    for (let tick = 0; tick < 30; tick++) registry.afterPlayerStep();
    expect(first.state.tick).toBe(30); expect(f.shell.state.tick).toBe(0); first.flags.set('door.open');
    await expect(registry.prepare('driftwood-isle', 'pine-hollow')).rejects.toThrow('neutral road first');
    expect(f.creates).toEqual(['driftwood-isle']);
    f.quota(true); crossing.request(null); await settle();
    const before = owner.allocator.cost(), motor = f.player.motor;
    expect(crossing.step(false)).toBe(false); expect(crossing.state().phase).toBe('save-failed');
    expect(registry.current()).toBe('driftwood-isle'); expect(f.player.motor).toBe(motor); expect(owner.allocator.cost()).toEqual(before);
    f.quota(false); crossing.retrySave(); expect(crossing.step(false)).toBe(true);
    expect(registry.current()).toBeNull(); expect(f.shell.physics.world.colliders.len()).toBe(shellCount);
    // Leave hooks run before unload. A failed disposer must not grant the budget for another world.
    f.gameplay(false); f.failDispose.add('driftwood-isle');
    expect(registry.unload('driftwood-isle')).toBe(false);
    expect(owner.allocator.cost()).toEqual(before); expect(registry.state().residents).toEqual(['driftwood-isle']);
    await expect(registry.prepare(null, 'pine-hollow')).rejects.toThrow('successful disposal');
    expect(f.creates).toEqual(['driftwood-isle']);
    f.failDispose.clear(); expect(registry.unload('driftwood-isle')).toBe(true);
    expect(first.scope.disposed).toBe(true); expect(first.physics.world.colliders).toBeUndefined(); expect(first.physics.world.bodies).toBeUndefined();
    expect(owner.allocator.has('sim:driftwood-isle')).toBe(false);
    registry.retry('pine-hollow'); crossing.request('pine-hollow'); await settle(); expect(crossing.step(false)).toBe(true);
    expect(f.creates).toEqual(['driftwood-isle', 'pine-hollow']);
    crossing.request(null); await settle(); expect(crossing.step(false)).toBe(true); expect(registry.unload('pine-hollow')).toBe(true);
    crossing.request('driftwood-isle'); await settle(); expect(crossing.step(false)).toBe(true);
    const restored = f.hosts.get('driftwood-isle'); if (restored === undefined) throw new Error('Missing rebuilt home');
    expect(restored.flags.has('door.open')).toBe(true); expect(restored.state.tick).toBe(30);
    expect(f.disposals).toEqual(['driftwood-isle', 'pine-hollow']);
    registry.dispose();
    expect(registry.current()).toBeNull(); expect(f.frames.at(-1)).toBeNull(); expect(restored.scope.disposed).toBe(true);
    expect(f.platform.disposed).toBe(true); expect(f.hosts.size).toBe(0); expect(owner.allocator.entries()).toEqual([]);
    expect(restored.physics.world.colliders).toBeUndefined(); expect(restored.physics.world.bodies).toBeUndefined();
    expect(f.shell.scope.disposed).toBe(false); expect(f.shell.physics.world.colliders.len()).toBe(shellCount);
    expect(f.player.motor.collider.isValid()).toBe(true);
  } finally { crossing.dispose(); f.finish(); }
});

it('cancels a late admitted product without creating a world or resurrecting the boot claim', async () => {
  let releaseAdmission = (_value: LiveGridAdmission): void => { throw new Error('Admission has not started'); };
  let product: LiveGridAdmission | undefined;
  const f = await open((_id, fallback) => { product = fallback(); return new Promise<LiveGridAdmission>(resolve => { releaseAdmission = resolve; }); });
  try {
    const pending = f.registry.prefetch(['pine-hollow']);
    await Promise.resolve(); f.registry.dispose(); f.owner.dispose();
    if (product === undefined) throw new Error('Missing deferred product'); releaseAdmission(product);
    await expect(pending).rejects.toThrow('disposed');
    expect(f.cancelled()).toBe(1); expect(f.creates).toEqual([]); expect(f.owner.allocator.entries()).toEqual([]);
    expect(f.player.motor.collider.isValid()).toBe(true);
  } finally { f.finish(); }
});

it('retains a failed final runtime disposal claim and retries cleanup after returning the traveller to the shell', async () => {
  const f = await open();
  try {
    const prepared = await f.registry.prepare(null, 'driftwood-isle'); prepared.commit();
    f.failDispose.add('driftwood-isle');
    expect(() => f.registry.dispose()).toThrow('Live grid disposal failed');
    expect(f.registry.current()).toBeNull(); expect(f.player.motor.collider.isValid()).toBe(true);
    expect(f.owner.allocator.entries()).toMatchObject([{ id: 'sim:driftwood-isle', bytes: 20_000_000, refs: 1, needed: true }]);
    expect(f.hosts.size).toBe(1);
    f.failDispose.clear(); f.registry.dispose();
    expect(f.hosts.size).toBe(0); expect(f.owner.allocator.entries()).toEqual([]);
  } finally { f.finish(); }
});
