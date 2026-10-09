// oxlint-disable-next-line import/no-nodejs-modules -- The headless runtime reads the native physics module.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import type { HeadlessCommand, HeadlessEffect } from '../../../src/sdk/tickProtocol';
import source from '../../../src/shards/far-reach/shard.config';
import { DECK, NOTES, ROOST, SPAWN, VANES, WINCH } from '../../../src/shards/far-reach/layout';
import { KEEPER_AT } from '../../../src/shards/far-reach/data/quests';
import { FLAGS, vaneFlag } from '../../../src/shards/far-reach/quest/flags';
import { FAN_GUST } from '../../../src/shards/far-reach/data/items';
import { FAN_ID } from '../../../src/shards/far-reach/weapons/fanStrikes';
import { FAN_ACT, FAN_ACTOR } from '../../../src/shards/far-reach/runtime/fan';
import { WINCH_BRIDGE } from '../../../src/shards/far-reach/runtime/moverRows';
import { ROOST_IDS, SKY_ACT, SKY_INTERACT } from '../../../src/shards/far-reach/runtime/quest';
import { prepareSkyRuntime, type SkyRuntime } from '../../../src/shards/far-reach/runtime/headless';
import type { SkyMovers } from '../../../src/shards/far-reach/runtime/headlessMovers';

let rapier: Rapier, sky: SkyRuntime;
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const assets = new Map(source.files.map(file => [file.hash, Uint8Array.from(readFileSync(`src/shards/far-reach/assets/${file.hash}`))]));
  sky = await prepareSkyRuntime({ shard: source, assets, rapier });
});

let tape: HeadlessCommand[] = [];
/** One worker tick: the player command (if any) steps the host, every command reaches the adapters. */
function run(host: SimHost, commands: HeadlessCommand[] = []): void {
  tape = commands;
  const player = commands.find(command => command.kind === 'player');
  host.step(player?.kind === 'player' ? { moveX: player.moveX, moveZ: player.moveZ, yaw: player.yaw, ...(player.attack === undefined ? {} : { attack: player.attack }) } : undefined);
  tape = [];
}
const interact = (value: number): HeadlessCommand => ({ kind: 'script', actorId: SKY_INTERACT, value });
/**
 * Stage the player standing at (x, z) on a deck (the islands' traversal, bridges and Rising Islets, is the full witness's,
 * once the played host owns the movers): set down a little above it, then a second of steps so the fall law lands it.
 */
function stand(host: SimHost, x: number, y: number, z: number, yaw = 0): void {
  host.player.position.set(x, y + 0.2, z); host.player.yaw = yaw;
  for (let i = 0; i < 60; i++) run(host);
  expect(host.player.position.y).toBeCloseTo(y, 0);
}

it('plays the crown bridge quest on a fresh host with the movers: four steps, the fact and 10 coins once', () => {
  const effects: HeadlessEffect[] = [], host = createSimHost(sky.plan.level, { ...sky.plan.ports, rapier });
  let movers: SkyMovers | undefined;
  try {
    movers = sky.installWithMovers(host, { restoring: false, commands: () => tape, emit: effect => { effects.push(effect); } });
    const raised = (): boolean => movers?.runtime.pose(WINCH_BRIDGE).enabled === true, fanKills = new Set<unknown>();
    host.events.on('damage.dealt', ({ req, killed }) => { if (killed && req.weaponId === FAN_ID) fanKills.add(req.target); }, host.scope);
    run(host); // the goats land
    expect(raised()).toBe(false);

    // the winch refuses while the roost and the vanes are unfinished (the browser toasts "locked")
    stand(host, WINCH.x, WINCH.y, WINCH.z + 2);
    for (let i = 0; i < 300; i++) run(host, [interact(SKY_ACT.winch)]);
    expect(raised()).toBe(false); expect(host.flags.has(FLAGS.raised)).toBe(false);

    // 1. the keeper: out of his talk radius nothing happens; walking up to him on Sunrest and talking reads his notes
    stand(host, SPAWN.x, DECK, SPAWN.z);
    run(host, [interact(SKY_ACT.talk)]); expect(host.flags.has(FLAGS.notes)).toBe(false);
    for (let i = 0; i < 600 && Math.hypot(host.player.position.x - KEEPER_AT.x, host.player.position.z - KEEPER_AT.z) > 2; i++) {
      const dx = KEEPER_AT.x - host.player.position.x, dz = KEEPER_AT.z - host.player.position.z, d = Math.hypot(dx, dz);
      run(host, [{ kind: 'player', moveX: dx / d, moveZ: dz / d, yaw: Math.atan2(-dx, -dz) }]);
    }
    run(host, [interact(SKY_ACT.talk)]); expect(host.flags.has(FLAGS.notes)).toBe(true);
    // the lectern on his isle reads the same notes (already read: no change)
    stand(host, NOTES.x, NOTES.y, NOTES.z + 1.5); run(host, [interact(SKY_ACT.notes)]); expect(host.flags.has(FLAGS.notes)).toBe(true);

    // 2. the roost: on its deck, the War Fan swings at the nearest roost ray as they dive, until all three are down
    stand(host, ROOST.x, ROOST.y, ROOST.z);
    for (let i = 0; i < 30_000 && !host.flags.has(FLAGS.roost); i++) {
      const p = host.player.position, live = ROOST_IDS.flatMap(id => { const a = host.entities.get(id); return a?.alive === true ? [a] : []; });
      const near = live.reduce<(typeof live)[number] | undefined>((best, a) => best === undefined || a.position.distanceToSquared(p) < best.position.distanceToSquared(p) ? a : best, undefined);
      if (near === undefined) { run(host); continue; }
      const yaw = Math.atan2(p.x - near.position.x, p.z - near.position.z);
      run(host, [{ kind: 'player', moveX: 0, moveZ: 0, yaw, attack: { targetId: near.entityId } }]);
      if (p.y < ROOST.y - 2) stand(host, ROOST.x, ROOST.y, ROOST.z);
    }
    expect(ROOST_IDS.map(id => host.entities.get(id)?.alive)).toEqual([false, false, false]);
    expect(ROOST_IDS.every(id => fanKills.has(host.entities.get(id)?.combatActor()))).toBe(true); // each fell to the fan
    expect(host.flags.has(FLAGS.roost)).toBe(true);

    // 3. the vanes: a GUST at each turns it (quest/vanes.ts through the fan), and the step completes once all three turn
    for (const vane of VANES) {
      stand(host, vane.x, vane.y, vane.z + 6);
      for (let i = 0; i < FAN_GUST.cooldown * 60 + 1; i++) run(host);
      run(host, [{ kind: 'player', moveX: 0, moveZ: 0, yaw: 0 }, { kind: 'script', actorId: FAN_ACTOR, value: FAN_ACT.gust }]);
      expect(host.flags.has(vaneFlag(vane.id))).toBe(true);
    }
    run(host); expect(host.flags.has(FLAGS.vanes)).toBe(true);
    expect(effects).toEqual([]);

    // 4. the winch: unlocked now, it raises the bridge on its mover; the raised pose completes the quest and pays once
    stand(host, WINCH.x, WINCH.y, WINCH.z + 2);
    run(host, [interact(SKY_ACT.winch)]);
    for (let i = 0; i < 3000 && !host.flags.has(FLAGS.raised); i++) run(host);
    expect(raised()).toBe(true); expect(host.flags.has(FLAGS.raised)).toBe(true);
    run(host);
    expect(host.flags.has(FLAGS.complete)).toBe(true);
    expect(effects).toEqual([{ kind: 'fact', name: 'far-reach.quest', actorId: host.player.id }, { kind: 'coins', amount: 10, actorId: host.player.id }]);
    for (let i = 0; i < 300; i++) run(host, [interact(SKY_ACT.winch), interact(SKY_ACT.talk)]);
    expect(effects).toHaveLength(2);
    expect(movers.failures()).toBe(0);
  } finally { host.dispose(); }
}, 600_000);

it('keeps the played host fail-closed: without movers the winch never raises, and a restore refuses the movers', () => {
  const effects: HeadlessEffect[] = [], host = createSimHost(sky.plan.level, { ...sky.plan.ports, rapier });
  try {
    sky.plan.install(host, { restoring: false, commands: () => tape, emit: effect => { effects.push(effect); } });
    run(host);
    for (const flag of [FLAGS.notes, FLAGS.roost, FLAGS.vanes]) host.flags.set(flag);
    stand(host, WINCH.x, WINCH.y, WINCH.z + 2);
    for (let i = 0; i < 600; i++) run(host, [interact(SKY_ACT.winch)]);
    expect(host.flags.has(FLAGS.raised)).toBe(false); expect(effects).toEqual([]);
    const other = createSimHost(sky.plan.level, { ...sky.plan.ports, rapier });
    try { expect(() => { sky.installWithMovers(other, { restoring: true, commands: () => [], emit: () => undefined }); }).toThrow('restore-parent'); }
    finally { other.dispose(); }
  } finally { host.dispose(); }
});
