// oxlint-disable-next-line import/no-nodejs-modules -- Rapier is a shipped binary.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test, vi } from 'vitest';
import type { NetCommand } from '@wildshard/format/netCommand';
import { PhaseEncounter, type PhaseEncounterSpec } from '../src/engine/ai/phases';
import { NetClient } from '../src/engine/net/client';
import { NetRoom } from '../src/engine/net/room';
import { SimNetWorld } from '../src/engine/net/simWorld';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { createSimHost, type SimCommand, type SimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { directLoopback } from '../src/engine/test/netLoopback';
import { EliteCore, memoryElitePersistence, type EliteCoreScript } from '../src/game/eliteSystem';
import { SIM_CREATURE_RECIPE } from '../src/game/test/creatureRecipe';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { NativeEliteKernels } from '../src/engine/ai/eliteKernels';
import { nativeKernelOwners } from './fixtures/nativeEliteKernelOwners';
import { StalkerBrain } from '../src/engine/ai/stalker';
import * as reach from '../src/engine/ai/reach';
import { Vector3 } from 'three';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import type { PlayerSim } from '../src/engine/sim/playerSim';

// P1-E3.4: bosses and elites serve whoever is there. The lead stands off at the origin while a bot does the fighting, on a
// real host with a real creature, real strikes and the real pipeline.
let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

const ARENA = { x: 12, z: 12 }, BODY = SIM_CREATURE_RECIPE.id;
const LEVEL = { ...SIM_LEVEL, entities: [{ ...SIM_CREATURE_RECIPE, at: { x: ARENA.x, y: 0, z: ARENA.z } }] };
const SPEC: PhaseEncounterSpec = { id: 'room.boss', entity: BODY, kind: 'boss', panel: null, name: 'Boar', title: 'of the room', retry: 'Again',
  arena: { at: [ARENA.x, 0, ARENA.z], radius: 6 }, intro: 0.1, introShort: 0.1, respawn: { at: [-4, 0, -4], yaw: 1 },
  phases: [{ at: 1, name: 'I', caption: 'one', speed: 3, stopDistance: 1.2, turnRate: 6 }] };
const PORTS = { saved: { defeated: false, rewardTaken: false, kills: 0 }, persist: () => undefined, reward: () => undefined };
const still: SimCommand = { moveX: 0, moveZ: 0, yaw: 0 };
function roomHost(): { host: SimHost; bot: PlayerSim; lead: PlayerSim; fight: PhaseEncounter } {
  const host = createSimHost(LEVEL, { rapier }), lead = [...host.players.values()][0];
  if (lead === undefined) throw new Error('No lead');
  const bot = host.addPlayer('bot:1', { x: ARENA.x + 3, y: 0, z: ARENA.z });
  return { host, bot, lead, fight: new PhaseEncounter(host, SPEC, PORTS) };
}
const tick = (host: SimHost, count = 1): void => {
  for (let i = 0; i < count; i++) host.step(new Map([...host.players.keys()].map(id => [id, still])));
};
function until(host: SimHost, done: () => boolean, limit = 1800): void {
  for (let i = 0; i < limit && !done(); i++) tick(host);
  expect(done()).toBe(true);
}

test('a boss wakes for a bot past its threshold and strikes that bot, not the lead', () => {
  const { host, bot, lead, fight } = roomHost(), body = host.entities.get(BODY);
  try {
    expect(fight.boss.state).toBe('armed');
    until(host, () => fight.boss.state === 'fight');
    until(host, () => bot.health.attributes.health < bot.health.attributes.maxHealth);
    expect(lead.health.attributes.health).toBe(lead.health.attributes.maxHealth);
    expect(body?.position.distanceTo(bot.position)).toBeLessThan(lead.position.distanceTo(bot.position));
  } finally { host.dispose(); }
});

test('a bot that falls goes back alone while the lead stands inside, and the fight carries on through a save', () => {
  const { host, bot, lead, fight } = roomHost();
  try {
    until(host, () => fight.boss.state === 'fight');
    lead.position.set(ARENA.x - 3, 0, ARENA.z);
    host.combat.hit({ source: 'env', sourceTags: ['creature.boar'], target: bot.health, amount: 1000, point: bot.position.clone(), dir: new Vector3(), cause: { kind: 'boar', label: 'Boar' } });
    tick(host);
    expect(fight.boss.state).toBe('fight');
    expect(bot.position.x).toBeCloseTo(-4); expect(bot.position.z).toBeCloseTo(-4);
    expect(lead.position.x).toBeCloseTo(ARENA.x - 3, 0);
    const saved = snapshotSimHost(host);
    expect(JSON.stringify(saved)).toContain('bot:1');
    expect(fight.snapshot()).toContain('"out":["bot:1"]');
    let again: PhaseEncounter | undefined;
    const restored = restoreSimHost(LEVEL, { rapier }, saved, target => { again = new PhaseEncounter(target, SPEC, PORTS); });
    expect(again?.snapshot()).toContain('"out":["bot:1"]'); expect(snapshotSimHost(restored)).toEqual(saved); restored.dispose();
    host.combat.hit({ source: 'env', sourceTags: ['creature.boar'], target: lead.health, amount: 1000, point: lead.position.clone(), dir: new Vector3(), cause: { kind: 'boar', label: 'Boar' } });
    tick(host);
    expect(fight.boss.attempts).toBe(2);
    expect(['armed', 'intro']).toContain(fight.boss.state);
    expect(fight.snapshot()).not.toContain('"out"');
  } finally { host.dispose(); }
});

test('the last player standing outside the threshold is left where it is on a reset', () => {
  const { host, bot, lead, fight } = roomHost();
  try {
    until(host, () => fight.boss.state === 'fight');
    host.combat.hit({ source: 'env', sourceTags: ['creature.boar'], target: bot.health, amount: 1000, point: bot.position.clone(), dir: new Vector3(), cause: { kind: 'boar', label: 'Boar' } });
    tick(host);
    expect(fight.boss.attempts).toBe(2);
    expect(bot.position.x).toBeCloseTo(-4); expect(lead.position.x).toBeCloseTo(0);
  } finally { host.dispose(); }
});

test('a client over the real codec reads the same fight the server runs', () => {
  const { host, bot, fight } = roomHost(), world = new SimNetWorld(host), link = directLoopback(), client = new NetClient(link.client);
  try {
    const room = new NetRoom({ world, step: inputs => { const commands = new Map<string, NetCommand>(); for (const row of inputs) if (row.command !== null) commands.set(row.player, row.command); host.step(commands); } });
    room.join(link.server, world.playerOf(bot.id)); client.hello(); link.pump(); room.open(); link.pump();
    const read = () => {
      client.command({ viewTick: 0, steer: { keyX: 0, keyY: 0, stickX: 0, stickY: 0 }, yaw: 0, pitch: 0, buttons: 0 }); client.flush(); link.pump(); room.tick(); link.pump();
      const row = [...client.entities.values()].find(entry => entry.id === 'encounter:room.boss'), frame = client.latest;
      return row === undefined || frame === null ? null : client.fields(frame, row.handle);
    };
    let seen = read();
    for (let i = 0; i < 1800 && seen?.['state'] !== 'fight'; i++) seen = read();
    expect(seen?.['state']).toBe('fight'); expect(fight.boss.state).toBe('fight');
    const body = host.entities.get(BODY); if (body === undefined) throw new Error('No boss body');
    body.hp = body.maxHp / 2;
    for (let i = 0; i < 4; i++) seen = read();
    expect(Number(seen?.['hp'])).toBeCloseTo(0.5, 2);
    expect(seen?.['phase']).toBe(0); expect(seen?.['shield']).toBe(false);
  } finally { host.dispose(); }
});

test('an elite engages a bot at its lair and leashes only when nobody is near', () => {
  const host = createSimHost(LEVEL, { rapier }), bot = host.addPlayer('bot:1', { x: ARENA.x + 3, y: 0, z: ARENA.z }), body = host.entities.get(BODY);
  if (body === undefined) throw new Error('No elite body');
  const ticks: string[] = [], def = { id: 'room.elite', lair: { x: ARENA.x, z: ARENA.z, r: 4 }, awareR: 8, engageR: 5, leashR: 20, rule: 'always' as const, respawnMin: 1 };
  const script: EliteCoreScript<typeof body> = { def, animal: body, spawn: () => undefined, despawn: () => undefined, tick: (_dt, _t, engaged, leashing) => { ticks.push(leashing ? 'leash' : engaged ? 'engaged' : 'calm'); },
    enterPhase2: () => undefined, reset: () => undefined, trophy: () => undefined };
  try {
    const core = new EliteCore<typeof script>({ players: host.players, condition: () => true }, {}, 'room', memoryElitePersistence());
    const entry = core.add(script); core.initialize();
    core.update(1 / 60, 0); expect(entry.state).toBe('engaged'); expect(entry.discovered).toBe(true);
    bot.position.set(30, 0, 30); core.update(1 / 60, 0); expect(entry.state).toBe('engaged');
    const lead = [...host.players.values()][0]; if (lead === undefined) throw new Error('No lead');
    body.position.set(40, 0, 40); bot.position.set(-30, 0, 40); lead.position.set(-30, 0, -30);
    core.update(1 / 60, 0); expect(entry.state).toBe('leash');
  } finally { host.dispose(); }
});

test('native elite kernels hurt and knock the player nearest the elite', () => {
  const f = nativeKernelOwners(), canReach = vi.spyOn(reach, 'canReach').mockReturnValue(true), dash = vi.fn();
  const health = legacyDouble<PlayerSim['health']>({ alive: true }), lead = [...f.host.players.values()][0];
  if (lead === undefined) throw new Error('No lead');
  Object.defineProperty(lead, 'health', { value: legacyDouble<PlayerSim['health']>({ alive: true }) }); lead.position.set(90, 0, 90);
  f.host.players.set('bot:1', legacyDouble<PlayerSim>({ id: 'bot:1', position: new Vector3(0, 0, .5), health, dashAt: dash }));
  try {
    const kernels = new NativeEliteKernels(f.rows, f.loans), state = { animal: f.actor, phase2: false, pack: null }, first = f.rows[0];
    if (first === undefined) throw new Error('Missing native row');
    const kernel = kernels.create(first.id, state); expect(kernel).toBeInstanceOf(StalkerBrain);
    kernels.bind(first.id, kernel, state, f.actor);
    const saved = kernel.snapshot(); if (saved === null || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Missing native state');
    kernel.restore({ ...saved, st: 'swipe', hitDone: 0 });
    f.loans.brains.get(f.actor)?.act(f.actor);
    expect(f.hit).toHaveBeenCalled(); const [{ target }] = f.hit.mock.calls[0] as [{ target: unknown }]; expect(target).toBe(health);
  } finally { canReach.mockRestore(); f.scope.dispose(); }
});
