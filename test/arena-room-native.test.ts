// oxlint-disable-next-line import/no-nodejs-modules -- Rapier is a shipped binary.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import * as v from 'valibot';
import { beforeAll, expect, test } from 'vitest';
import { loadRapier, type Rapier } from '../src/engine/shared/physics/rapier';
import { createSimHost, type SimCommand, type SimHost } from '../src/engine/server/sim';
import type { PlayerSim } from '../src/engine/server/sim/playerSim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/shared/sim/snapshot';
import { ArenaFightPageSchema, ArenaRoomSchema } from '../src/game/shared/boss/arenaRoomRows';
import { installArenaRoom, type ArenaRoomBody, type ArenaRoomDoorRows } from '../src/game/server/boss/arenaRoomNative';
import { ReturnProgram } from '../src/game/shared/population/returnProgram';
import { SIM_CREATURE_RECIPE } from '../src/game/test/creatureRecipe';
import room from '../src/shards/nalati-grasslands/data/bossArenaRoom.json' with { type: 'json' };
import view from '../src/shards/nalati-grasslands/data/kurganView.json' with { type: 'json' };
import king from './fixtures/nalati-goldenKing-original.json' with { type: 'json' };
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { titanPrograms as programs } from './fixtures/titanInlineWitness';

// Row 2 of the boss lane: the Golden King's real rows, in a real room on a real host, for bots. The sim level is flat at
// y = 0 and small, so the room comes down to it: the same fight, moved.
let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

const DX = 40, DY = -140, DZ = 95;
const ORIGIN = { x: 0, y: 0, z: 0 }, CENTRE = { x: 0, y: 0, z: -3 };
const page = v.parse(ArenaFightPageSchema, king.page), admitted = v.parse(ArenaRoomSchema, { ...room, view });
const fightRows = { ...page,
  profile: { ...king.profile, fight: { ...king.profile.fight, origin: ORIGIN } },
  maxZ: page.maxZ + DZ, respawn: [page.respawn[0] + DX, page.respawn[1] + DY, page.respawn[2] + DZ] satisfies [number, number, number],
  reward: [page.reward[0] + DX, page.reward[1] + DY, page.reward[2] + DZ] satisfies [number, number, number] };
const roomRows = { ...admitted, origin: ORIGIN };
const definition = { ...king.encounter, intro: 0.2, introShort: 0.1, reward: {} };
const ADDS = 8, KING = 'king';
const LEVEL = { ...SIM_LEVEL, entities: [KING, ...Array.from({ length: ADDS }, (_, i) => `add.${String(i)}`)].map((id, i) => Object.assign(structuredClone(SIM_CREATURE_RECIPE), { id, at: { x: 30 + i, y: 0, z: 30 } })) };
const still: SimCommand = { moveX: 0, moveZ: 0, yaw: 0 };
const tick = (host: SimHost, count = 1): void => { for (let i = 0; i < count; i++) host.step(new Map([...host.players.keys()].map(id => [id, still]))); };
function until(host: SimHost, done: () => boolean, limit = 2400): void {
  for (let i = 0; i < limit && !done(); i++) tick(host);
  expect(done()).toBe(true);
}
function roomHost(host: SimHost, portal?: ArenaRoomDoorRows) {
  const saved = { defeated: false, rewardTaken: false, kills: 0 };
  let adds = 0; const seal: boolean[] = [], returned: string[] = [];
  const body = (id: string): ArenaRoomBody => {
    const actor = host.entities.get(id); if (actor === undefined) throw new Error('No body');
    return Object.assign(actor, { hidden: false });
  };
  const fight = installArenaRoom<ArenaRoomBody>(host, { step: 'room.king', room: roomRows, definition, fight: fightRows, ...(portal === undefined ? {} : { portal }) }, {
    spawnBody: () => { const actor = body(KING); actor.place(0, -5, 0); return actor; },
    spawnAdd: (_i, x, z, yaw) => { const actor = body(`add.${String(adds++ % ADDS)}`); actor.place(x, z, yaw); return actor; },
    retire: actor => { actor.hidden = true; }, find: id => { const actor = host.entities.get(id); return actor === undefined ? null : body(id); },
    seal: on => { seal.push(on); }, saved, persist: () => undefined, returned: player => { returned.push(player.id); } });
  return { ...fight, seal, returned };
}
function bots(): { host: SimHost; lead: PlayerSim; bot: PlayerSim } {
  const host = createSimHost(LEVEL, { rapier }), lead = [...host.players.values()][0];
  if (lead === undefined) throw new Error('No lead');
  lead.position.set(0, 0, 40);
  return { host, lead, bot: host.addPlayer('bot:1', { x: CENTRE.x + 2, y: 0, z: CENTRE.z }) };
}
const inside = (player: PlayerSim, x: number, z: number): void => { player.position.set(x, 0, z); player.motor.resetAt(player.position); };
const fall = (host: SimHost, target: PlayerSim): void => {
  host.combat.hit({ source: 'env', sourceTags: ['creature.boar'], target: target.health, amount: 100000, point: target.position.clone(), dir: new Vector3(), cause: { kind: 'test', label: 'test' } });
};

test('the King wakes for a bot in the chamber while the lead stands outside, and his blows find that bot', () => {
  const { host, lead, bot } = bots(), fight = roomHost(host);
  try {
    expect(fight.boss.state).toBe('armed');
    until(host, () => fight.boss.state === 'fight');
    expect(fight.seal.at(-1)).toBe(true);
    expect(fight.party.nearest(new Vector3()).id).toBe(bot.id);
    until(host, () => bot.health.attributes.health < bot.health.attributes.maxHealth, 3600);
    expect(lead.health.attributes.health).toBe(lead.health.attributes.maxHealth);
  } finally { host.dispose(); }
});

test('J104: two engaged at the start make his hits count for less, the row keeps one number', () => {
  const { host, lead, bot } = bots(), fight = roomHost(host);
  try {
    inside(lead, CENTRE.x - 2, CENTRE.z);
    until(host, () => fight.boss.state === 'fight');
    const actor = fight.fight.body(); if (actor === null) throw new Error('No King');
    expect(fight.party.engaged).toBe(2);
    const before = actor.hp;
    host.combat.hit({ source: 'env', sourceTags: ['actor.player'], target: actor.combatActor(), amount: 35, point: actor.position.clone(), dir: new Vector3(), cause: { kind: 'test', label: 'test' } });
    // The body's own rule, then the curve: the row's armour takes its share of the hit before the players divide it.
    expect(before - actor.hp).toBeCloseTo(Math.round(35 * fight.fight.brain.damageMul(actor, actor.position)) / 1.75, 0);
    expect(bot.health.alive).toBe(true);
  } finally { host.dispose(); }
});

test('J107: a bot that falls goes back alone, the door lets it in again and the fight keeps its progress, through a save', () => {
  const { host, lead, bot } = bots(), fight = roomHost(host);
  try {
    inside(lead, CENTRE.x - 2, CENTRE.z);
    until(host, () => fight.boss.state === 'fight');
    const actor = fight.fight.body(); if (actor === null) throw new Error('No King');
    actor.hp = actor.maxHp * 0.8;
    fall(host, bot); tick(host, 2);
    expect(fight.boss.state).toBe('fight'); expect(fight.boss.attempts).toBe(1);
    expect(bot.health.alive).toBe(true); expect(fight.returned).toEqual([bot.id]);
    expect(bot.position.z).toBeCloseTo(fightRows.respawn[2]); expect(fight.ground.inDromos(bot.position)).toBe(true);
    expect(fight.seal.at(-1)).toBe(false);
    const saved = snapshotSimHost(host);
    let again: ReturnType<typeof roomHost> | undefined;
    const restored = restoreSimHost(LEVEL, { rapier }, saved, target => { again = roomHost(target); });
    expect(again?.boss.state).toBe('fight'); expect(again?.party.engaged).toBe(2); expect(snapshotSimHost(restored)).toEqual(saved); restored.dispose();
    inside(bot, CENTRE.x + 2, CENTRE.z); tick(host, 2);
    expect(fight.seal.at(-1)).toBe(true);
  } finally { host.dispose(); }
});

test('J107: the fight resets only once nobody is inside', () => {
  const { host, lead, bot } = bots(), fight = roomHost(host);
  try {
    until(host, () => fight.boss.state === 'fight');
    fall(host, bot); tick(host, 3);
    expect(bot.position.z).toBeCloseTo(fightRows.respawn[2]); expect(lead.position.z).toBeCloseTo(40, 0);
    expect(['armed', 'intro']).toContain(fight.boss.state); expect(fight.party.engaged).toBe(0);
  } finally { host.dispose(); }
});

test('J104: a hazard wearing the fight tag shares to the next nearest from five players, as his blows do', () => {
  const host = createSimHost(LEVEL, { rapier }), lead = [...host.players.values()][0];
  if (lead === undefined) throw new Error('No lead');
  inside(lead, CENTRE.x + 1, CENTRE.z);
  const others = [1, 2, 3, 4].map(i => host.addPlayer(`bot:${String(i)}`, { x: CENTRE.x + 1 + i, y: 0, z: CENTRE.z })), fight = roomHost(host);
  try {
    until(host, () => fight.boss.state === 'fight');
    const before = others.map(bot => bot.health.attributes.health);
    host.combat.hit({ source: 'env', sourceTags: [fightRows.damageTag, 'feel.blow', 'cover.checked'], target: lead.health, amount: 10, point: lead.position.clone(), dir: new Vector3(), cause: { kind: 'test', label: 'test' } });
    tick(host, 2);
    expect(others.map((bot, i) => (before[i] ?? 0) - bot.health.attributes.health).filter(hurt => hurt > 0)).toHaveLength(1);
  } finally { host.dispose(); }
});

test('J105: when the King falls in a room each player with meaningful damage has their own reward, once', () => {
  const { host, lead, bot } = bots(), fight = roomHost(host), third = host.addPlayer('bot:2', { x: 0, y: 0, z: 40 });
  try {
    inside(lead, CENTRE.x - 2, CENTRE.z);
    until(host, () => fight.boss.state === 'fight');
    const actor = fight.fight.body(); if (actor === null) throw new Error('No King');
    const strike = (who: PlayerSim, amount: number): void => {
      host.combat.hit({ source: who.health, sourceTags: ['actor.player'], target: actor.combatActor(), amount, point: actor.position.clone(), dir: new Vector3(), cause: { kind: 'test', label: 'test' } });
    };
    actor.hp = actor.maxHp * 0.05; fight.boss.phase = 2; fight.boss.checkpoint = 2;
    strike(bot, 3); strike(lead, 4); strike(bot, actor.maxHp);
    until(host, () => fight.boss.state === 'victory');
    expect(fight.bounty.owed).toEqual([bot.id]);
    expect(fight.bounty.take(third.id)).toBe(false);
    expect(fight.bounty.take(bot.id)).toBe(true); expect(fight.bounty.take(bot.id)).toBe(false); expect(fight.bounty.owed).toEqual([]);
  } finally { host.dispose(); }
});

test('each player takes the portal down alone, by the row\'s own program', () => {
  const host = createSimHost(LEVEL, { rapier }), lead = [...host.players.values()][0], entrance = { x: 14, y: 0, z: 14, facing: 0 };
  if (lead === undefined) throw new Error('No lead');
  lead.position.set(-14, 0, -14);
  const bot = host.addPlayer('bot:1', { x: entrance.x, y: 0, z: entrance.z + 1.5 });
  const fight = roomHost(host, { rows: king.portal, program: ReturnProgram.native(host, programs.rules), entrance });
  try {
    until(host, () => fight.inside(bot.id), 240);
    expect(fight.inside(lead.id)).toBe(false); expect(lead.position.x).toBeCloseTo(-14, 0);
    expect(bot.position.x).toBeCloseTo(king.portal.spawn.x, 0); expect(bot.position.z).toBeCloseTo(king.portal.spawn.z, 0);
  } finally { host.dispose(); }
});

test('one player fights the row exactly: no share, no scale, the door shuts and the death is the brain\'s', () => {
  const host = createSimHost(LEVEL, { rapier }), lead = [...host.players.values()][0];
  if (lead === undefined) throw new Error('No lead');
  inside(lead, CENTRE.x + 2, CENTRE.z);
  const fight = roomHost(host);
  try {
    until(host, () => fight.boss.state === 'fight');
    expect(fight.party.engaged).toBe(0); expect(fight.seal.at(-1)).toBe(true);
    fall(host, lead); tick(host, 2);
    expect(fight.boss.attempts).toBe(2); expect(lead.position.z).toBeCloseTo(fightRows.respawn[2]);
  } finally { host.dispose(); }
});
