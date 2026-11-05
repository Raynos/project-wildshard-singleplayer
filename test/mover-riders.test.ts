// oxlint-disable-next-line import/no-nodejs-modules -- Exercise real native carry and its physics continuation.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { createSimHost, type SimHost } from '../src/engine/server/sim';
import { loadRapier } from '../src/engine/shared/physics/rapier';
import { leadPlayer } from '../src/engine/shared/sim/leadPlayer';
import { restoreSimHost, snapshotSimHost } from '../src/engine/shared/sim/snapshot';
import { MoverScriptDriver, playerGrounds, type MoverRuntime } from '../src/game/server/plugin/mover';
import { emptyShardfile } from '../src/sdk/author';
import { canoeMover } from '../src/shards/pine-hollow/generators/canoe';
import { PINE_SOURCES } from './fixtures/pine-sources';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { builtProduct } from './fixtures/builtProduct';
import { NetClient } from '../src/engine/client/net/client';
import { NetRoom } from '../src/engine/server/net/room';
import { SimNetWorld } from '../src/engine/server/net/simWorld';
import { directLoopback } from '../src/engine/test/netLoopback';
import { outputDescriptor } from '../src/game/shared/shardfile/outputDescriptor';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { createTrustedHeadlessResident } from '../src/sdk/headlessRuntime';
import { timberWorld } from '../src/shards/pine-hollow/generators/timberWorldRows';

// P1-E3.10: a carry mover carries whoever called it, not the host's first player.
const row = canoeMover(() => 2, timberWorld(PINE_SOURCES).landmarks), level = { ...SIM_LEVEL, entities: [] }, BOT = 'bot:1';
function install(host: SimHost): MoverRuntime {
  const source = emptyShardfile({ slug: 'carry-test', name: 'Carry', author: 'Test', revision: 1, seed: 3 });
  return new MoverScriptDriver([row], host).install(host, { content: source, assets: new Map(),
    rules: { fields: {}, archetypes: [], events: [], maxEntities: 32 } }, { id: 'carry-test', drive: true });
}
const landing = (end: 0 | 1): Vector3 => { const at = row.carry?.landings[end]; if (at === undefined) throw new Error('Missing landing'); return new Vector3(...at); };
function rapierNow(): ReturnType<typeof loadRapier> { return loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))); }

test('the bot that calls a canoe rides it, and the lead stays on foot and free', async () => {
  const host = createSimHost(level, { rapier: await rapierNow() }), motion = install(host);
  try {
    const bot = host.addPlayer(BOT, { x: 3, y: 1, z: 3 }), lead = leadPlayer(host);
    motion.command(row.id, 1, BOT);
    expect(motion.carrying(BOT)).toBe(true); expect(motion.carrying()).toBe(false);
    motion.command(row.id, 2); // a boat holds one: the lead's call is refused
    for (let tick = 0; tick < 200; tick++) host.step(new Map([[lead.id, { moveX: 1, moveZ: 0, yaw: 0 }]]));
    expect(motion.carrying(BOT)).toBe(true);
    expect(host.events.ask('player.carrying', false)).toBe(false);
    const seat = host.physics.world.getCollider(bot.motor.collider.handle).translation();
    expect(Math.abs(seat.x - bot.position.x)).toBeLessThan(1);
    expect(lead.position.x).toBeGreaterThan(1);
    for (let tick = 0; tick < 550 && motion.riding(row.id); tick++) host.step();
    expect(motion.riding(row.id)).toBe(false); expect(motion.carrying(BOT)).toBe(false);
    expect(bot.position.distanceTo(landing(1))).toBeLessThan(1e-6);
    expect(lead.position.distanceTo(landing(1))).toBeGreaterThan(1);
    expect(host.flags.has('secret:islet')).toBe(true);
  } finally { host.dispose(); }
});

test('a bot rider survives a save mid-river', async () => {
  const rapier = await rapierNow(), host = createSimHost(level, { rapier }), motion = install(host);
  let restored: SimHost | undefined, resumed: MoverRuntime | undefined;
  try {
    host.addPlayer(BOT, { x: 3, y: 1, z: 3 });
    motion.command(row.id, 1, BOT);
    for (let tick = 0; tick < 200; tick++) host.step();
    restored = restoreSimHost(level, { rapier }, snapshotSimHost(host), fresh => { resumed = install(fresh); });
    if (resumed === undefined) throw new Error('Missing restored mover');
    expect(resumed.carrying(BOT)).toBe(true); expect(resumed.carrying()).toBe(false);
    for (let tick = 0; tick < 550 && resumed.riding(row.id); tick++) restored.step();
    expect(restored.players.get(BOT)?.position.distanceTo(landing(1))).toBeLessThan(1e-6);
  } finally { restored?.dispose(); host.dispose(); }
});

test('a rider who leaves mid-ride leaves the boat to finish alone', async () => {
  const host = createSimHost(level, { rapier: await rapierNow() }), motion = install(host);
  try {
    host.addPlayer(BOT, { x: 3, y: 1, z: 3 });
    motion.command(row.id, 1, BOT);
    for (let tick = 0; tick < 60; tick++) host.step();
    host.removePlayer(BOT);
    for (let tick = 0; tick < 550 && motion.riding(row.id); tick++) host.step();
    expect(motion.riding(row.id)).toBe(false);
    motion.command(row.id, 2);
    expect(motion.carrying()).toBe(true);
  } finally { host.dispose(); }
});

test('a stand trigger reads every player in the world', async () => {
  const host = createSimHost(level, { rapier: await rapierNow() });
  try {
    host.addPlayer(BOT, { x: 3, y: 1, z: 3 });
    expect([...playerGrounds(host)]).toHaveLength(2);
    leadPlayer(host).detachMotor();
    expect([...playerGrounds(host)]).toEqual([host.players.get(BOT)?.motor.result]);
  } finally { host.dispose(); }
});

test('built Pine: a bot rides the canoe on a scripted tape and a client sees the boat and the flag', async () => {
  const directory = builtProduct('pine-hollow'), product = await loadHeadlessProduct(directory), source = product.shardfile;
  const descriptor = outputDescriptor(source); if (descriptor === undefined) throw new Error('Missing admitted inventory');
  const assets = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash, Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  const resident = await createTrustedHeadlessResident({ shard: source, assets, rapier: await rapierNow(), product });
  try {
    const { host } = resident, canoe = source.movers.find(value => value.id === 'pine.canoe');
    if (canoe?.carry === undefined) throw new Error('Missing admitted carry row');
    const lead = leadPlayer(host), bot = host.addPlayer(BOT, lead.position.clone().add(new Vector3(2, 0, 0))), standing = lead.position.clone();
    const world = new SimNetWorld(host), link = directLoopback(), client = new NetClient(link.client);
    const room = new NetRoom({ world, step: () => { resident.step([]); } });
    room.join(link.server, world.playerOf(BOT)); client.hello(); link.pump(); room.open(); link.pump();
    resident.step([{ kind: 'script', actorId: canoe.id, value: 1, playerId: BOT }]);
    expect(host.events.ask('player.carrying', false)).toBe(false); // the lead's own weapons and prompts stay free
    let ticks = 0, led = 0;
    for (; ticks < 545 && bot.position.distanceTo(new Vector3(...canoe.carry.landings[1])) > 1e-6; ticks++) {
      room.tick(); link.pump();
      const frame = client.latest;
      if (frame !== null && client.owner(frame)['led'] === true) led++;
    }
    expect(ticks).toBeLessThan(545);
    expect(led).toBeGreaterThan(ticks / 2); // the owner block says the boat has them (P1-E5.3-C2)
    expect(lead.position.distanceTo(standing)).toBeLessThan(1);
    expect(host.flags.has('secret:islet')).toBe(true);
    room.tick(); room.tick(); link.pump();
    expect(bot.led).toBe(false); expect(lead.led).toBe(false);
    expect(client.flags().has('secret:islet')).toBe(true);
    expect([...client.entities.values()].some(entity => entity.id === `script:${canoe.id}`)).toBe(true);
    expect(client.dropped).toBe(0);
  } finally { resident.dispose(); }
}, 120_000);
