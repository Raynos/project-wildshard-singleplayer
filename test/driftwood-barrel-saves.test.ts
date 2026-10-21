// oxlint-disable-next-line import/no-nodejs-modules -- The native host consumes the shipped physics binary.
import { readFileSync } from 'node:fs';
import barrelSource from '../src/shards/driftwood-isle/behaviour/barrels.as?raw';
import { beforeAll, expect, test } from 'vitest';
import * as v from 'valibot';
import { emptyShardfile } from '../src/sdk/author';
import { prepareHeadlessAssembly } from '../src/sdk/headlessAssembly';
import type { HeadlessRuntimePlan } from '../src/sdk/headlessRuntime';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { compileDecisionScripts } from '../src/sdk/buildDecisionScripts';
import { parseDecisionScripts } from '../src/format/decisionScripts';
import { declaredBodyRegistries, DeclaredBodyOpsSchema } from '../src/format/bodySlots';
import { NativeQuestProps } from '../src/game/quest/nativeProps';
import { installNativeBodyScripts } from '../src/game/quest/nativeBodyScripts';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { Bodies } from '../src/engine/physics/bodies';
import { BARREL_BODY, BARREL_HALF } from '../src/engine/world/interact/barrel';
import { loadRapier } from '../src/engine/physics/rapier';
import { BARREL_BODIES, BARREL_DECISION } from '../src/shards/driftwood-isle/generators/barrelDecision';
import { SIM_LEVEL } from './fixtures/sim-level/level';

// G566: Driftwood's tide barrel moved from the quest props' kit watch into its decision script over a declared body. The
// body scripts add no snapshot adapter and the quest envelope keeps the barrel's native handle (plus, since G566, the
// script continuation), so an old save adopts its barrel body with no second spawn, and a migrated save restores the same
// body, handle, position and watch clocks.
const rapier = loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
const level = { ...SIM_LEVEL, entities: [], quests: [] };
const OWNER = 'tide-barrel', HOME = { x: 2, y: 0, z: 2 }, LIFT = HOME.y + BARREL_HALF + 0.01;
const [watch] = BARREL_DECISION, [declared] = BARREL_BODIES.bodies;
if (declared === undefined) throw new Error('Missing declared barrel');
// the barrel moved next to the fixture spawn, with the sea above its flat ground: off home it is lost
const bodies = v.parse(DeclaredBodyOpsSchema, { ...BARREL_BODIES, bodies: [{ ...declared, at: { x: HOME.x, y: LIFT, z: HOME.z } }] });
const params = { ...watch.params, homeX: HOME.x, homeY: HOME.y, homeZ: HOME.z, water: 10, plateAX: 90, plateBX: -90 };
const source = emptyShardfile({ slug: 'barrel-saves', name: 'Barrel Saves', author: 'Test', seed: 3, revision: 1 });
let sections = new Map<string, unknown>(), assets = new Map<string, Uint8Array>();
let nativePlan: HeadlessRuntimePlan;
beforeAll(async () => {
  const built = await compileDecisionScripts([{ ...watch, params }], declaredBodyRegistries(bodies), new Map([[watch.source, barrelSource]]), { asLineCeiling: 200 });
  const [row] = built.rows, [blob] = built.blobs; if (row === undefined || blob === undefined) throw new Error('Missing barrel program');
  sections = new Map<string, unknown>([['sim/scripts', parseDecisionScripts([row])], ['sim/bodies', bodies]]);
  assets = new Map([[row.module.slice('blobs/wasm/'.length, -'.wasm'.length), blob.bytes]]);
  const declaration = { version: 1, modules: {}, constants: {}, prepare: [],
    install: [{ name: 'bodyScripts', value: { $native: 'native.body-scripts' } }],
    level: { speed: 5, lift: .1, ground: { size: 32, height: 0 } },
    ports: { ground: false, heightAt: { $fn: 0 } }, entries: { $fn: { lanes: 0, steps: 0 } } };
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections,
    files: new Map([['sim/headless-assembly.json', { hash: 'assembly', url: 'assembly' }]]),
    read: () => Promise.resolve(new TextEncoder().encode(JSON.stringify(declaration))) });
  nativePlan = await prepareHeadlessAssembly({ shard: source, product, assets, rapier: await rapier }, {});
});
const envelope = v.strictObject({ barrel: v.unknown() });
/** The quest composition's barrel envelope over today's props and body scripts. */
function migrated(host: SimHost, restoring: boolean, builtin = true): NativeQuestProps {
  if (builtin) nativePlan.install(host, { restoring, commands: () => [], emit: () => undefined });
  else installNativeBodyScripts(host, source, assets, restoring, sections);
  const props = new NativeQuestProps(host, { drops: [], floors: [], gates: [], bodies: [{ owner: OWNER, body: 'barrel' }] }, restoring);
  host.onStep('quest.props', dt => { props.step(dt, { x: 0, z: 0 }); }, {
    snapshot: () => ({ barrel: props.snapshot(OWNER) }), restore: value => { props.restore(OWNER, v.parse(envelope, value).barrel); },
    physicsRestored: () => { props.physicsRestored(); } });
  return props;
}
const at = (host: SimHost, handle: number) => { const { x, y, z } = host.physics.world.getRigidBody(handle).translation(); return { x, y, z }; };
const fromHome = (host: SimHost, handle: number) => Math.hypot(at(host, handle).x - HOME.x, at(host, handle).z - HOME.z);
const handleOf = (props: NativeQuestProps) => { const saved = props.snapshot(OWNER); if (saved === null) throw new Error('Missing barrel body'); return saved.handle; };
const clocksOf = (props: NativeQuestProps) => {
  const saved = props.snapshot(OWNER)?.decision;
  return (JSON.parse(saved ?? 'null') as { decision: { bindings: { slots: Record<string, number> }[] } }).decision.bindings[0]?.slots;
};

test('an old save adopts its barrel body: same body count, handle and position, no second spawn, the script steers it', async () => {
  const R = await rapier, host = createSimHost(level, { rapier: R });
  try {
    // the pre-G566 props spawned and saved their own barrel body, with the kit watch clocks (now dropped)
    const service = new Bodies(host.physics, host.player.position);
    const body = service.spawn({ ...BARREL_BODY, owner: { kind: 'barrel', id: OWNER } }, { x: HOME.x, y: LIFT, z: HOME.z }, undefined,
      { x: 0, y: Math.sin(declared.yaw / 2), z: 0, w: Math.cos(declared.yaw / 2) });
    host.onStep('quest.props', dt => { service.post(dt); service.pre(dt); }, {
      snapshot: () => ({ barrel: { handle: body.rb.handle, watch: { lost: 1.5, wedge: 0.5, from: { x: 1, y: 2, z: 3 } } } }), restore: () => undefined });
    for (let i = 0; i < 30; i++) host.step();
    body.rb.setTranslation({ x: HOME.x + 2, y: LIFT, z: HOME.z }, true); host.step();
    const saved = snapshotSimHost(host), count = host.physics.world.bodies.len(), was = at(host, body.rb.handle);
    let props: NativeQuestProps | undefined;
    const fork = restoreSimHost(level, { rapier: R }, saved, fresh => { props = migrated(fresh, true); });
    try {
      if (props === undefined) throw new Error('Missing restored props');
      expect(fork.physics.world.bodies.len()).toBe(count); expect(handleOf(props)).toBe(body.rb.handle); expect(at(fork, body.rb.handle)).toEqual(was);
      for (let i = 0; i < 120; i++) fork.step();
      expect(fork.physics.world.bodies.len()).toBe(count); expect(fromHome(fork, body.rb.handle)).toBeGreaterThan(1);
      // its watch now runs in the script: lost off home (the sea is above this ground) for 4 s, it goes home
      for (let i = 0; i < 240; i++) fork.step();
      expect(fork.physics.world.bodies.len()).toBe(count); expect(handleOf(props)).toBe(body.rb.handle);
      expect(fromHome(fork, body.rb.handle)).toBeLessThan(0.5);
    } finally { fork.dispose(); }
  } finally { host.dispose(); }
});

test('a migrated save restores into a fresh host with the same body count, handle, position and watch clocks', async () => {
  const R = await rapier, host = createSimHost(level, { rapier: R });
  try {
    const props = migrated(host, false);
    for (let i = 0; i < 30; i++) host.step();
    const handle = handleOf(props); host.physics.world.getRigidBody(handle).setTranslation({ x: HOME.x + 2, y: LIFT, z: HOME.z }, true);
    for (let i = 0; i < 90; i++) host.step();
    const saved = snapshotSimHost(host), count = host.physics.world.bodies.len(), clocks = clocksOf(props);
    expect(clocks?.['lost']).toBeGreaterThan(1);
    let restored: NativeQuestProps | undefined;
    const fork = restoreSimHost(level, { rapier: R }, saved, fresh => { restored = migrated(fresh, true); });
    try {
      if (restored === undefined) throw new Error('Missing restored props');
      expect(fork.physics.world.bodies.len()).toBe(count); expect(handleOf(restored)).toBe(handle);
      expect(at(fork, handle)).toEqual(at(host, handle)); expect(clocksOf(restored)).toEqual(clocks);
      expect(snapshotSimHost(fork)).toEqual(saved);
      // both continue identically: the same tick takes the barrel home
      for (let i = 0; i < 240; i++) { host.step(); fork.step(); expect(at(fork, handle)).toEqual(at(host, handle)); }
      expect(fromHome(fork, handle)).toBeLessThan(0.5);
      expect(snapshotSimHost(fork)).toEqual(snapshotSimHost(host)); expect(fork.physics.world.bodies.len()).toBe(count);
    } finally { fork.dispose(); }
  } finally { host.dispose(); }
});


test('the finite body capability preserves the old callable phase and snapshot bytes', async () => {
  const R = await rapier, builtinHost = createSimHost(level, { rapier: R }), callable = createSimHost(level, { rapier: R });
  try {
    migrated(builtinHost, false); migrated(callable, false, false);
    expect(snapshotSimHost(builtinHost)).toEqual(snapshotSimHost(callable));
    for (let i = 0; i < 120; i++) { builtinHost.step(); callable.step(); }
    expect(snapshotSimHost(builtinHost)).toEqual(snapshotSimHost(callable));
  } finally { builtinHost.dispose(); callable.dispose(); }
});
