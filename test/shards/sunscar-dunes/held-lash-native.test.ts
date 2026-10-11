// oxlint-disable-next-line import/no-nodejs-modules -- Native admitted bytes are the same assets used by the shipping worker.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import type { HeadlessCommand } from '../../../src/sdk/tickProtocol';
import { HeadlessSimulation } from '../../../src/sdk/headless';
import { canonicalSimDigest } from '../../fake/simState';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import source from '../../../src/shards/sunscar-dunes/shard.config';
import { prepareSignalRuntime, SIGNAL_LASH_INPUT } from '../../../src/shards/sunscar-dunes/runtime/signalPlan';
import { WHIP_STEP } from '../../../src/shards/sunscar-dunes/runtime/headlessRows';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';

let rapier: Rapier, plan: HeadlessRuntimePlan;
const assets = new Map(source.files.map(file => [file.hash, new Uint8Array(readFileSync(`src/shards/sunscar-dunes/assets/${file.hash}`))]));
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  plan = await prepareSignalRuntime({ shard: source, assets, rapier });
});
interface Run { readonly host: SimHost; tape: readonly HeadlessCommand[] }
function boot(saved?: string): Run {
  const input = { tape: [] as readonly HeadlessCommand[] }, ports = { ...plan.ports, rapier };
  const emit = (): void => { throw new Error('A short whip fixture must not award quest effects'); };
  if (saved === undefined) {
    const host = createSimHost(plan.level, ports);
    plan.install(host, { restoring: false, commands: () => input.tape, emit });
    return { host, get tape() { return input.tape; }, set tape(value) { input.tape = value; } };
  }
  const snapshot = decodeSimSnapshot(saved);
  const host = restoreSimHost(plan.level, ports, snapshot, fresh => {
    if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt);
    plan.install(fresh, { restoring: true, snapshot, commands: () => input.tape, emit });
  });
  return { host, get tape() { return input.tape; }, set tape(value) { input.tape = value; } };
}
function tick(run: Run, held: boolean, light = false): void {
  const target = run.host.entities.get('sunscar.home:12'); if (target === undefined) throw new Error('Missing actual strider');
  run.tape = [{ kind: 'player', moveX: 0, moveZ: 0, yaw: 0,
    ...(held ? { heavy: { targetId: target.entityId } } : {}), ...(light ? { attack: { targetId: target.entityId } } : {}) }];
  run.host.step({ moveX: 0, moveZ: 0, yaw: 0, ...(light ? { attack: { targetId: target.entityId } } : {}) }); run.tape = [];
}
function lash(host: SimHost) {
  const saved = snapshotSimHost(host).adapters.find(adapter => adapter.id === WHIP_STEP)?.state;
  if (typeof saved !== 'string') throw new Error('Missing actual lash continuation');
  return v.parse(v.object({ heavy: v.boolean(), crackT: v.number(), landed: v.number(), cooldown: v.number() }), JSON.parse(saved));
}
it('restores a real held aim, releases over a light cooldown, and continues both native contacts in the shipping worker', async () => {
  const original = boot(); let restored: Run | undefined, worker: HeadlessSimulation | undefined;
  try {
    const target = original.host.entities.get('sunscar.home:12'); if (target === undefined) throw new Error('Missing actual strider');
    const hp = target.combatActor().attributes.health;
    original.host.player.position.set(target.position.x, target.position.y, target.position.z + 4);
    tick(original, false, true);
    tick(original, true); tick(original, true); // the light is still unrolling; a short hold is already a heavy on release
    expect(lash(original.host).heavy).toBe(false);
    const saved = serializeSimSnapshot(snapshotSimHost(original.host));
    expect(snapshotSimHost(original.host).adapters.find(adapter => adapter.id === SIGNAL_LASH_INPUT)?.state).toContain('"wasHeld":true');
    restored = boot(saved); expectSameSimSnapshot(snapshotSimHost(restored.host), decodeSimSnapshot(saved));
    worker = await HeadlessSimulation.create(source, assets, saved, { deadline: 'advisory', trustedRuntime: { module: new URL('../../../src/shards/sunscar-dunes/runtime/headless.ts', import.meta.url).href } });
    const commands: HeadlessCommand[][] = [];
    commands.push([{ kind: 'player', moveX: 0, moveZ: 0, yaw: 0, attack: { targetId: target.entityId } }]);
    for (const run of [original, restored]) tick(run, false, true); // release overrides the simultaneous light
    expect(lash(original.host).heavy).toBe(true); expect(lash(original.host).landed).toBe(0);
    expectSameSimSnapshot(snapshotSimHost(restored.host), snapshotSimHost(original.host));
    let first = false;
    for (let i = 0; i < 59; i++) {
      commands.push([{ kind: 'player', moveX: 0, moveZ: 0, yaw: 0 }]);
      tick(original, false); tick(restored, false);
      expectSameSimSnapshot(snapshotSimHost(restored.host), snapshotSimHost(original.host));
      if (lash(original.host).landed === 1) first = true;
    }
    expect(first).toBe(true); expect(lash(original.host).landed).toBe(2);
    expect(target.combatActor().attributes.health).toBeLessThan(hp);
    let commit;
    for (const input of commands) commit = await worker.step([{ source: 'signal.held-lash-fixture', commands: input }]);
    if (commit === undefined) throw new Error('Missing shipping-worker commit');
    expect(canonicalSimDigest(commit.snapshot)).toBe(canonicalSimDigest(snapshotSimHost(original.host)));
  } finally { await worker?.dispose(); restored?.host.dispose(); original.host.dispose(); }
});
