// oxlint-disable-next-line import/no-nodejs-modules -- The product and Rapier are shipped bytes.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { beforeAll, expect, test } from 'vitest';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { arenaEntryOf } from '../src/game/boss/arenaRoomEntry';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { createTrustedHeadlessResident, type TrustedHeadlessResident } from '../src/sdk/headlessRuntime';
import { builtProduct } from './fixtures/builtProduct';

// The Golden King from Nalati's product, for a room. A tape's resident has no such fight, so its saves keep their adapters.
const KING_ORIGIN = { x: -40, y: 140, z: -95 };
let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

async function nalati(room: boolean): Promise<TrustedHeadlessResident> {
  const directory = builtProduct('nalati-grasslands'), product = await loadHeadlessProduct(directory), descriptor = outputDescriptor(product.shardfile);
  if (descriptor === undefined) throw new Error('Missing output');
  const assets = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash, Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  return createTrustedHeadlessResident({ shard: product.shardfile, assets, rapier, product }, undefined, { room });
}

test('a tape\'s world has no room fight', async () => {
  const live = await nalati(false);
  expect(arenaEntryOf(live.host)).toBeUndefined();
  expect(live.host.adapters.has('nalati.king')).toBe(false);
  live.dispose();
});

test('a room meets the King from the product, and each earner gets the bow', async () => {
  const live = await nalati(true), { host } = live, fight = arenaEntryOf(host);
  if (fight === undefined) throw new Error('No room fight');
  const lead = [...host.players.values()][0]; if (lead === undefined) throw new Error('No lead');
  const bot = host.addPlayer('bot:1', { x: lead.position.x + 2, y: lead.position.y, z: lead.position.z });
  const { x, y, z } = KING_ORIGIN;
  for (const player of [lead, bot]) player.resetPose({ x, y: y + 0.2, z: z + 2 }, 0);
  const paid: string[] = [];
  for (let tick = 0; tick < 1200 && fight.fight.body() === null; tick++) live.step([]);
  const body = fight.fight.body(); if (body === null) throw new Error('The King never rose');
  expect(body.kind).toBe('golden-king');
  const blow = (who: typeof lead, amount: number): void => { host.combat.hit({ source: who.health, sourceTags: ['actor.player'], target: body.combatActor(), amount, point: body.position.clone(), dir: new Vector3(), cause: { kind: 'test', label: 'test' } }); };
  for (let tick = 0; tick < 2400 && fight.boss.state !== 'fight'; tick++) live.step([]);
  expect(fight.boss.state).toBe('fight');
  blow(lead, 200); blow(bot, 200);
  body.hp = body.maxHp * 0.05; fight.boss.phase = 2; fight.boss.checkpoint = 2;
  for (let tick = 0; tick < 3600 && paid.length < 2; tick++) {
    if (body.alive) { blow(lead, 200); blow(bot, 200); }
    live.step([]);
    for (const effect of live.effects) if (effect.kind === 'item') paid.push(`${effect.actorId}:${effect.item}`);
  }
  expect(fight.boss.state).toBe('victory');
  expect(paid).toHaveLength(2);
  for (let tick = 0; tick < 60; tick++) { live.step([]); expect(live.effects.some(effect => effect.kind === 'item')).toBe(false); }
  expect(paid).toEqual(expect.arrayContaining([`${lead.id}:goldenBow`, 'bot:1:goldenBow']));
  live.dispose();
});
