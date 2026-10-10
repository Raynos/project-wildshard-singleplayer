// oxlint-disable-next-line import/no-nodejs-modules -- The witness refuses incomplete native gameplay rather than report a passing flag.
import assert from 'node:assert/strict';
import type { SimHost } from '../../../src/engine/sim';
import { snapshotSimHost, serializeSimSnapshot } from '../../../src/engine/sim/snapshot';
import type { Rapier } from '../../../src/engine/physics/rapier';
import { createTrustedHeadlessResident } from '../../../src/sdk/headlessRuntime';
import type { HeadlessCommand } from '../../../src/sdk/tickProtocol';
import source from '../../../src/shards/nalati-grasslands/shard.config';
import { prepareHeadlessRuntime } from '../../../src/shards/nalati-grasslands/runtime/headless';
import { nalatiBake } from '../../../src/shards/nalati-grasslands/runtime/baked';
import { nalatiTamingOf } from '../../../src/shards/nalati-grasslands/runtime/headlessTaming';
import { nalatiMountedOf } from '../../../src/shards/nalati-grasslands/runtime/headlessMounted';
import { canonicalSimDigest } from '../../fake/simState';

const MODULE = new URL('../../../src/shards/nalati-grasslands/runtime/headless.ts', import.meta.url).href;
function law(host: SimHost) {
  const value = nalatiTamingOf(host); if (value === undefined) throw new Error('Missing native taming owner'); return value;
}

/** The pilot observes only the living horse position, live prompt and balance gauge. No trust/position grants or forceBreak. */
export function nalatiTamingPilot(host: SimHost, stallionId: string, previousBalance: number): { balance: number; commands: HeadlessCommand[] } {
  const taming = law(host), original = host.entities.get(stallionId);
  if (original === undefined) throw new Error('Missing original living stallion');
  let x = 0, z = 0;
  if (taming.phase !== 'breaking') {
    const dx = original.position.x - host.player.position.x, dz = original.position.z - host.player.position.z, length = Math.hypot(dx, dz);
    if (length > 2.2) { x = dx / length; z = dz / length; }
  }
  const balance = taming.view.balance, lean = Math.max(-1, Math.min(1, balance * 12 + (balance - previousBalance) * 60 * 3));
  return { balance, commands: [{ kind: 'player', moveX: x, moveZ: z, yaw: 0, commandVersion: 1, crouch: true,
    steer: { keyX: x, keyY: -z, stickX: 0, stickY: 0 } },
  { kind: 'script', actorId: 'nalati.taming.offer', value: 1 }, { kind: 'script', actorId: 'nalati.taming.lean', value: lean },
  ...(taming.interactable.radius > 0 ? [{ kind: 'script' as const, actorId: 'nalati.taming.mount', value: 1 }] : [])] };
}

/** One actual native journey from a documented fixture spawn beside the authored stallion, plus one mid-round checkpoint.
 * This certifies the ordinary living stallion, not the unplayed Argymaq encounter, companion laws or quest facts.
 */
export async function nalatiTamingWitness(rapier: Rapier, assets: ReadonlyMap<string, Uint8Array>, replay: boolean): Promise<object> {
  const actor = nalatiBake().actors.find(a => a.kind === 'horse' && a.variant === 'stallion');
  if (actor === undefined) throw new Error('Missing authored wild stallion');
  const spawn = nalatiBake().spawns.find(a => a.id === actor.id);
  if (spawn === undefined) throw new Error('Missing authored wild stallion placement');
  const originalPlan = await prepareHeadlessRuntime({ shard: source, assets, rapier });
  const heightAt = originalPlan.ports?.heightAt; if (heightAt === undefined) throw new Error('Missing actual terrain');
  const x = spawn.at[0] + 2, z = spawn.at[2], fixture = { ...source, spawn: { x, y: heightAt(x, z) + 0.1, z, yaw: 0 } };
  const preparation = { shard: fixture, assets, rapier }, entry = { module: MODULE };
  const first = await createTrustedHeadlessResident(preparation, entry);
  let restored: Awaited<ReturnType<typeof createTrustedHeadlessResident>> | undefined;
  try {
    const original = first.host.entities.get(actor.id); if (original === undefined) throw new Error('Missing native authored stallion');
    let previous = 0, breakingTicks = 0, prompt = false, checkpointTick = 0;
    for (let tick = 0; tick < 10_000 && law(first.host).phase !== 'bonded'; tick++) {
      const taming = law(first.host), pilot = nalatiTamingPilot(first.host, actor.id, previous); previous = pilot.balance;
      prompt ||= taming.interactable.radius > 0;
      if (taming.phase === 'breaking') breakingTicks++;
      first.step(pilot.commands); restored?.step(pilot.commands);
      if (replay && restored === undefined && taming.phase === 'breaking' && breakingTicks === 250) {
        const snapshot = snapshotSimHost(first.host), wire = serializeSimSnapshot(snapshot); checkpointTick = first.host.state.tick;
        restored = await createTrustedHeadlessResident(preparation, entry, wire);
        assert.equal(canonicalSimDigest(snapshotSimHost(restored.host)), canonicalSimDigest(snapshot), 'Mid-round reinstall must be quiet and exact');
      }
      assert.deepEqual(first.effects, [], 'Taming must not invent quest facts');
    }
    const taming = law(first.host), mounted = nalatiMountedOf(first.host);
    assert.equal(prompt, true); assert.ok(breakingTicks >= 5 * 3.5 * 60); assert.equal(taming.phase, 'bonded');
    assert.equal(taming.tulpar?.variant, 'tulpar'); assert.equal(mounted?.horse, taming.tulpar);
    assert.equal(original.alive, true); assert.equal(first.host.entities.get(original.entityId), original);
    assert.equal(original.position.y, -1e4); assert.equal(original.motor, null);
    if (replay) {
      assert.ok(restored !== undefined);
      assert.equal(canonicalSimDigest(snapshotSimHost(restored.host)), canonicalSimDigest(snapshotSimHost(first.host)), 'The whole remaining bucking suffix must stay exact through adoption');
    }
    return { status: 'partial', fixture: 'one spawn beside the authored living stallion; no later placement or trust writes',
      livePrompt: prompt, rounds: 5, ticksExecuted: first.host.state.tick, originalHiddenAlive: true, tulparAdopted: true,
      ...(replay ? { checkpointTick, suffixExact: true } : {}),
      open: ['actual Argymaq breaking encounter', 'companion whistle/resting and global quest prompt ownership', 'taming quest/ledger facts'] };
  } finally { restored?.dispose(); first.dispose(); }
}
