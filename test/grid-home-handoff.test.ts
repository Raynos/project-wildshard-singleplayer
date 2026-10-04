// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { PerspectiveCamera } from 'three';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import * as gridBoot from '../src/game/grid/boot';
import { GridHomeHandoff } from '../src/game/grid/boot';
import { installGridReveal } from '../src/game/grid/reveal';
import { shardfileSource } from '../src/game/shardfile/loader';
import { prepareHybridShard } from '../src/game/shardfile/hybrid';
import { ShardPlugin } from '../src/game/shard/plugin';
import type { Shardfile } from '../src/game/shardfile/schema';
import { emptyShardfile } from '../src/sdk/author';
import driftwood from '../src/shards/driftwood-isle/shard.config';

async function announce(source: Shardfile, trustedRuntime: boolean, handoff: GridHomeHandoff): Promise<void> {
  const manifest = await shardfileSource(source, { base: 'https://fixture.test/', firstParty: true, offline: false,
    fetch: () => Promise.reject(new Error('Empty fixture never fetches')), hash: () => Promise.reject(new Error('Empty fixture never hashes')) }, {
    instance: source.identity.slug, trustedRuntime, audioOwner: 'runtime', worldOwner: 'runtime', catalogue: [], recipes: new Map(), items: new Map(),
    voices: () => new Map(), icon: () => { throw new Error('Fixture never creates equipment'); },
    onSimulationExpected: () => { handoff.expect(); },
  });
  const load = manifest.load; if (load === undefined) throw new Error('Missing data client');
  const { default: Data } = await load(); new Data();
}

it('the real transitional Driftwood client never promises the absent home simulation that held the reveal to its ceiling', async () => {
  const handoff = new GridHomeHandoff();
  await announce(driftwood, true, handoff);
  expect(handoff.pending).toBe(false);
  expect(handoff.simulation).toBeNull();
});

it('a nonempty trusted client still holds readiness until its real simulation handoff arrives', async () => {
  const handoff = new GridHomeHandoff(), source = emptyShardfile({ slug: 'handoff', name: 'Handoff', author: 'Fixture', seed: 1, revision: 1 });
  source.runtime = { entry: 'runtime/index.ts' };
  source.state.shared.push({ id: 1, name: 'ready', type: 'bool', default: false, privacy: 'public' });
  await announce(source, true, handoff);
  expect(handoff.pending).toBe(true);
  handoff.offer({ checkpoint: () => true, disposed: () => false, setActive: () => undefined });
  expect(handoff.pending).toBe(false);
});

it('ordinary data clients announce a simulation even when their authored content is empty', async () => {
  const handoff = new GridHomeHandoff(), source = emptyShardfile({ slug: 'handoff', name: 'Handoff', author: 'Fixture', seed: 1, revision: 1 });
  // The fixture uses runtime audio ownership only to avoid building any audio assets during admission.
  source.runtime = { entry: 'runtime/index.ts' };
  await announce(source, false, handoff);
  expect(handoff.pending).toBe(true);
});

it('the actual grid hybrid composition announces only the data clients that will hand off a simulation', async () => {
  const instance = vi.spyOn(gridBoot, 'pageGridInstance').mockReturnValue('driftwood-isle');
  const expected = vi.spyOn(gridBoot.gridHomeSim, 'expect').mockImplementation(() => undefined);
  class Runtime extends ShardPlugin {}
  try {
    const options = { base: 'https://fixture.test/', firstParty: true, offline: false,
      fetch: (): Promise<Response> => Promise.reject(new Error('No fixture assets')), hash: (): Promise<string> => Promise.reject(new Error('No fixture hashes')) };
    const bindings = { catalogue: [], recipes: new Map(), items: new Map(), voices: () => new Map(), icon: (): never => { throw new Error('No equipment'); } };
    const entries = [{ slug: driftwood.identity.slug, entry: 'runtime/hybrid.ts', load: () => Promise.resolve({ default: Runtime }) }];
    await prepareHybridShard(driftwood, options, bindings, entries);
    expect(expected).not.toHaveBeenCalled();
    const source: Shardfile = { ...driftwood, state: { ...driftwood.state,
      shared: [{ id: 1, name: 'ready', type: 'bool', default: false, privacy: 'public' }] } };
    await prepareHybridShard(source, options, bindings, entries);
    expect(expected).toHaveBeenCalledOnce();
  } finally { expected.mockRestore(); instance.mockRestore(); }
});

function reveal(handoff: GridHomeHandoff) {
  const scope = new Scope('reveal-handoff'), root = document.createElement('div'), camera = new PerspectiveCamera();
  let late: (dt: number) => void = () => { throw new Error('Late callback was not installed'); };
  const weapons = { enabled: true, visible: true, setEnabled: (enabled: boolean): void => { weapons.enabled = enabled; } };
  const viewmodel = { visible: true };
  document.body.append(root);
  const running = installGridReveal({ scope, camera, hudRoot: root, home: 'Fixture', entered: () => true,
    onLate: (fn) => { late = fn; }, ringsReady: () => true, homeSimReady: () => !handoff.pending, weapons, viewmodel });
  return { scope, root, weapons, viewmodel, running, frame: (dt: number): void => { app.clock.tick(dt); late(dt); } };
}

it('an empty trusted home releases the actual reveal at the seven-second path end without hitting its ceiling', async () => {
  const clock = app.clock.snapshot(), handoff = new GridHomeHandoff(); await announce(driftwood, true, handoff);
  const fixture = reveal(handoff);
  try {
    fixture.frame(0); expect(fixture.running()).toBe(true); expect(fixture.weapons.enabled).toBe(false);
    fixture.frame(7.1);
    expect(fixture.running()).toBe(false); expect(fixture.weapons.enabled).toBe(true); expect(fixture.viewmodel.visible).toBe(true);
    expect(window.__wsReveal).toMatchObject({ endedMs: 7100, homeSimMs: 0, ceiling: false });
    expect(fixture.root.querySelector('.ws-grid-reveal')).toBeNull();
  } finally { fixture.scope.dispose(); fixture.root.remove(); app.clock.restore(clock); delete window.__wsReveal; }
});

it('a real promised home simulation still holds the reveal until its handoff arrives', () => {
  const clock = app.clock.snapshot(), handoff = new GridHomeHandoff(); handoff.expect(); const fixture = reveal(handoff);
  try {
    fixture.frame(0); fixture.frame(7.1);
    expect(fixture.running()).toBe(true); expect(fixture.weapons.enabled).toBe(false); expect(window.__wsReveal?.homeSimMs).toBeNull();
    handoff.offer({ checkpoint: () => true, disposed: () => false, setActive: () => undefined }); fixture.frame(0.05);
    expect(fixture.running()).toBe(false); expect(window.__wsReveal?.ceiling).toBe(false);
    expect(window.__wsReveal?.endedMs).toBeLessThan(8000);
  } finally { fixture.scope.dispose(); fixture.root.remove(); app.clock.restore(clock); delete window.__wsReveal; }
});
