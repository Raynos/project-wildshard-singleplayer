// oxlint-disable-next-line import/no-nodejs-modules -- Exact retained pack and one temporary validated SDK product, no network or app build.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary source-proof products stay in repository tmp.
import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { decisionLegacyLines } from '../scripts/decision-legacy-lines.mjs';
import { installNativeOwnerObservation } from '../scripts/qa-native-owner-observation.mjs';
import { disposalErrorMessages } from '../src/engine/app/scope';
import proof from '../src/shards/driftwood-isle/data/nativeOwnerProof.json';
import { buildNativeOwnerProofProduct, nativeOwnerProofBodies } from '../src/shards/driftwood-isle/generators/nativeOwnerProof';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { packedCreatureBodies } from '../src/game/plugin/geometry';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { ragdollsFor } from '../src/engine/physics/ragdoll';
import { fixture, fixtureRigidCorpse, transitionRows } from './practice-native-fixture';

const canonical = 'art/driftwood-isle/approved-conch/runtime-admission/arena-candidate1';
const metadata: unknown = JSON.parse(readFileSync(`${canonical}/metadata.json`, 'utf8'));
let directory = '', product: Awaited<ReturnType<typeof loadHeadlessProduct>>;
beforeAll(async () => {
  directory = mkdtempSync(resolve('tmp/native-owner-source-proof-'));
  const lines = decisionLegacyLines(resolve('.'), 'driftwood-isle'); if (lines === undefined) throw new Error('Missing sealed decision budget');
  await buildNativeOwnerProofProduct(resolve('src/shards/driftwood-isle'), directory, { decisionLegacyLines: lines }, metadata);
  product = await loadHeadlessProduct(directory);
}, 60000);
afterAll(() => { if (directory !== '') rmSync(directory, { recursive: true, force: true }); });

test('private source is exactly the prior synthetic ownership witness, not a new animation or contact recipe', () => {
  expect(proof.pose).toEqual(transitionRows()); expect(proof.corpse).toEqual(fixtureRigidCorpse);
  expect(() => numericCreaturePose(proof.pose)).not.toThrow();
});
test('strict packed copy retains canonical geometry/dimensions and adds only the synthetic corpse declaration', async () => {
  const original = packedCreatureBodies(metadata, undefined, () => Promise.resolve(Uint8Array.from(readFileSync(`${canonical}/payload.bin`))));
  const supplied = packedCreatureBodies(nativeOwnerProofBodies(metadata), undefined, () => Promise.resolve(Uint8Array.from(readFileSync(`${canonical}/payload.bin`))));
  await original.preload(); await supplied.preload();
  const a = original.copy('conch-duelist', 'conch-duelist'), b = supplied.copy('conch-duelist', 'conch-duelist');
  try {
    expect(b.bones).toEqual(a.bones); expect(b.dims).toEqual({ ...a.dims, rigidCorpse: fixtureRigidCorpse });
    for (const group of ['furParts', 'hardParts', 'eyeParts'] as const) {
      expect(b[group]).toHaveLength(a[group].length);
      b[group].forEach((geometry, index) => expect(geometry.toJSON()).toEqual({ ...a[group][index]?.toJSON(), uuid: geometry.uuid }));
    }
  } finally { for (const parts of [a, b]) for (const list of [parts.furParts, parts.hardParts, parts.eyeParts]) for (const geometry of list) geometry.dispose(); }
});
test('new strict product exercises real native multiple hits, physical handoff, frozen publication and disposal', async () => {
  expect(JSON.parse(new TextDecoder().decode(await product.file('poses/native-proof.json')))).toEqual(proof.pose);
  expect(product.hasFile('poses/conch-duelist.json')).toBe(false);
  const f = await fixture(product, true), system = ragdollsFor(f.outside.physics);
  try {
    const hit = (amount: number) => f.combat.hit({ source: 'env', sourceTags: ['dmg.melee'], target: f.native.actor.combatActor(), amount,
      point: f.native.actor.position.clone(), dir: new Vector3(.7, .2, -.5) });
    hit(1); hit(1); expect(hit(10000)?.killed).toBe(true);
    expect(f.native.pose.context.transition?.ordinal).toBe(3); expect(f.native.host.clock.frame).toBe(0);
    for (let i = 0; i < 310; i++) f.tick();
    expect(f.native.corpse?.diagnostic().resource).toBe('frozen'); expect(system.occupied).toBe(0);
    const before = f.native.snapshot();
    for (const alpha of [0, .5, 1]) { f.view.renderPublishedPose(alpha); expect(f.view.mesh.position).toEqual(f.native.actor.position); }
    expect(f.native.snapshot()).toEqual(before); f.native.dispose(); expect(f.native.corpse?.diagnostic().lease).toBe('released');
  } finally { f.owner.dispose(); }
});

function observer(f: Awaited<ReturnType<typeof fixture>>, provenance?: { synthetic: boolean; clockOverlay?: boolean }) {
  const token = Symbol('actual-render-result'), render = vi.fn(() => token);
  const owner = { native: f.native, targets: [f.view], events: f.events, practicePlayer: f.player,
    bout: f.owner, retry: vi.fn(), loot: { receipt: { coins: 0, complete: false } } };
  const demo = { arena: { entered: true, opponent: owner, playerVitals: { health: 100, maxHealth: 100 } },
    player: f.outside.player, game: { frameCount: 0, frameTime: 0, alpha: 1, composer: { render }, levelScope: f.owner } };
  const browser: { __practiceDemo: typeof demo; __nativeOwnerSample?: () => unknown;
    __nativeOwnerTrace?: { errors: unknown[]; lifecycle: { event: string; outcome?: string }[] } } = { __practiceDemo: demo };
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: browser, writable: true, configurable: true });
  const restoreWindow = (): void => {
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, 'window');
    else Object.defineProperty(globalThis, 'window', previousWindow);
  };
  const receipt = installNativeOwnerObservation(provenance);
  const sample = browser.__nativeOwnerSample, trace = browser.__nativeOwnerTrace;
  if (sample === undefined || trace === undefined) throw new Error('Observer failed to install');
  return { demo, trace, sample, token, render, restoreWindow, receipt };
}

test('actual native observer quiet reads and one forwarded tick/render do not acquire lifecycle authority', async () => {
  const f = await fixture(product, true), before = f.native.snapshot(), pre = vi.spyOn(f.native, 'preFixed'), fixed = vi.spyOn(f.native, 'fixed');
  let restoreWindow: () => void = () => undefined;
  try {
    const o = observer(f); restoreWindow = o.restoreWindow;
    for (let i = 0; i < 100; i++) o.sample();
    expect(f.native.snapshot()).toEqual(before); expect(o.demo.game.composer.render()).toBe(o.token); expect(o.render).toHaveBeenCalledOnce();
    f.tick(); expect(pre).toHaveBeenCalledOnce(); expect(fixed).toHaveBeenCalledOnce(); expect(f.native.host.clock.frame).toBe(1);
    // PracticeCreature.exit closes the parent scope BEFORE its explicit native.dispose retry.
    f.owner.dispose(); expect(() => f.native.dispose()).not.toThrow(); expect(() => o.sample()).not.toThrow();
    expect(o.trace.errors).toEqual([]); expect(o.trace.lifecycle.some(row => row.event === 'dispose-after' && row.outcome === 'returned')).toBe(true);
  } finally { f.owner.dispose(); restoreWindow(); }
});

test('observer reports its own read failure without suppressing the original render return or native cleanup', async () => {
  const f = await fixture(product, true);
  let restoreWindow: () => void = () => undefined;
  try {
    const o = observer(f); restoreWindow = o.restoreWindow;
    const snapshot = vi.spyOn(f.native.pose, 'snapshot').mockImplementation(() => { throw new Error('observer-only read fault'); });
    expect(o.demo.game.composer.render()).toBe(o.token); expect(o.render).toHaveBeenCalledOnce();
    expect(o.trace.errors).toEqual([{ stream: 'render', error: 'observer-only read fault' }]); snapshot.mockRestore();
    f.owner.dispose(); expect(() => f.native.dispose()).not.toThrow();
  } finally { f.owner.dispose(); restoreWindow(); }
});

test('actual removal failure remains the same original exception and counted quarantine through observed cleanup', async () => {
  const f = await fixture(product, true), system = ragdollsFor(f.outside.physics), original = f.native.dispose.bind(f.native);
  let originalError: unknown;
  const calls = vi.spyOn(f.native, 'dispose').mockImplementation(() => { try { original(); } catch (error) { originalError = error; throw error; } });
  let restoreWindow: () => void = () => undefined;
  try {
    const o = observer(f); restoreWindow = o.restoreWindow;
    f.combat.hit({ source: 'env', sourceTags: ['dmg.melee'], target: f.native.actor.combatActor(), amount: 10000,
      point: f.native.actor.position.clone(), dir: new Vector3(1, 0, 0) });
    const remove = vi.spyOn(f.outside.physics.world, 'removeRigidBody').mockImplementation(() => { throw new Error('observed native removal fault'); });
    let received: unknown; try { f.native.dispose(); } catch (error) { received = error; }
    expect(calls).toHaveBeenCalledOnce(); expect(received).toBe(originalError); expect(received).toBeInstanceOf(AggregateError);
    expect(disposalErrorMessages(received)).toContain('observed native removal fault'); expect(system.occupied).toBe(1);
    expect(o.trace.errors).toEqual([]); expect(o.trace.lifecycle.some(row => row.outcome === 'threw')).toBe(true);
    remove.mockRestore(); f.native.dispose(); expect(calls).toHaveBeenCalledTimes(2); expect(system.occupied).toBe(0);
  } finally { f.owner.dispose(); restoreWindow(); }
});

test('observer provenance defaults to prior synthetic behavior and accepts explicit real-source identity without changing state', async () => {
  for (const provenance of [undefined, { synthetic: false }]) {
    const f = await fixture(product, true), before = f.native.snapshot();
    let restoreWindow: () => void = () => undefined;
    try {
      const o = observer(f, provenance); restoreWindow = o.restoreWindow;
      expect(o.receipt.synthetic).toBe(provenance?.synthetic ?? true);
      expect(f.native.snapshot()).toEqual(before); expect(o.trace.errors).toEqual([]);
    } finally { f.owner.dispose(); restoreWindow(); }
  }
});

test('optional clock overlay follows the actual forwarded draw and disposes without advancing native state', async () => {
  const f = await fixture(product, true), before = f.native.snapshot();
  const overlay = { id: '', style: { cssText: '' }, textContent: '', remove: vi.fn() }, append = vi.fn();
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => overlay, body: { append } } });
  let restoreWindow: () => void = () => undefined;
  try {
    const o = observer(f, { synthetic: false, clockOverlay: true }); restoreWindow = o.restoreWindow;
    expect(o.receipt.clockOverlay).toBe(true); expect(append).toHaveBeenCalledWith(overlay);
    expect(overlay.textContent).toBe('');
    expect(o.demo.game.composer.render()).toBe(o.token); expect(o.render).toHaveBeenCalledOnce();
    expect(overlay.textContent).toContain('PASSIVE DRAW 0 / BOUT 1');
    expect(overlay.textContent).toContain('NATIVE 0 / 0s');
    expect(f.native.snapshot()).toEqual(before); expect(o.trace.errors).toEqual([]);
    f.owner.dispose(); expect(overlay.remove).toHaveBeenCalledOnce();
  } finally {
    f.owner.dispose(); restoreWindow();
    if (previousDocument === undefined) Reflect.deleteProperty(globalThis, 'document');
    else Object.defineProperty(globalThis, 'document', previousDocument);
  }
});
