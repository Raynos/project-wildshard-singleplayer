// oxlint-disable-next-line import/no-nodejs-modules -- The product and Rapier are shipped bytes.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import * as v from 'valibot';
import { beforeAll, expect, test } from 'vitest';
import { loadRapier, type Rapier } from '../src/engine/shared/physics/rapier';
import { nativeGroundBossObservation, takeNativeBossReward } from '../src/game/server/boss/native';
import { outputDescriptor } from '../src/game/shared/shardfile/outputDescriptor';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { createTrustedHeadlessResident, type TrustedHeadlessResident } from '../src/sdk/headlessRuntime';
import { builtProduct } from './fixtures/builtProduct';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
async function pine(): Promise<TrustedHeadlessResident> {
  const directory = builtProduct('pine-hollow'), product = await loadHeadlessProduct(directory), descriptor = outputDescriptor(product.shardfile);
  if (descriptor === undefined) throw new Error('Missing output');
  const assets = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash, Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  return createTrustedHeadlessResident({ shard: product.shardfile, assets, rapier, product }, undefined, { room: true });
}

const KING = 'pine.king', CLEARING = { x: 150, z: -30 };

// P1-E3: a ground boss's trophy is each earner's own (J105). The orb stands until the last of them has taken theirs.
test('each earner of the Antler King takes their own trophy, once, and the orb goes with the last', async () => {
  const live = await pine(), { host } = live, paid: string[] = [];
  const lead = [...host.players.values()][0]; if (lead === undefined) throw new Error('No lead');
  const bot = host.addPlayer('bot:1', lead.position), y = host.groundHeightAt(CLEARING.x, CLEARING.z) + .2;
  const seen = (): NonNullable<ReturnType<typeof nativeGroundBossObservation>> => {
    const row = nativeGroundBossObservation(host, KING); if (row === undefined) throw new Error('No King'); return row;
  };
  const collect = (): void => { for (const effect of live.effects) if (effect.kind === 'item') paid.push(`${effect.actorId}:${effect.item}:${String(effect.count)}`); };
  const step = (): void => { live.step([]); collect(); };
  const rewardAt = (): { x: number; y: number; z: number } | null => {
    const saved = host.adapters.get('pine.king.reward')?.snapshot();
    return v.parse(v.object({ point: v.nullable(v.object({ x: v.number(), y: v.number(), z: v.number() })) }), saved).point;
  };
  lead.resetPose({ x: CLEARING.x, y, z: CLEARING.z + 2 }, 0); bot.resetPose({ x: CLEARING.x + 2, y, z: CLEARING.z + 2 }, 0);
  const clock = host.dayClock; if (clock === undefined) throw new Error('No day');
  clock.phase = 0.95;
  for (let tick = 0; tick < 1200 && seen().fight.body === null; tick++) step();
  const id = seen().fight.body, body = id === null ? undefined : host.entities.get(id);
  if (body === undefined) throw new Error('The King never rose');
  const blow = (who: typeof lead, amount: number): void => { host.combat.hit({ source: who.health, sourceTags: ['actor.player'], target: body.combatActor(), amount, point: body.position.clone(), dir: new Vector3(0, 0, 1) }); };
  for (let tick = 0; tick < 3600 && seen().boss.state !== 'fight'; tick++) step();
  expect(seen().boss.state).toBe('fight');
  blow(lead, 50); blow(bot, 50);
  for (let tick = 0; tick < 7200 && body.alive; tick++) { body.hp = Math.min(body.hp, 40); blow(lead, 200); blow(bot, 200); step(); }
  for (let tick = 0; tick < 1200 && rewardAt() === null; tick++) step();
  const orb = rewardAt(); if (orb === null) throw new Error('No orb');
  lead.resetPose({ x: orb.x, y: orb.y - 1.6, z: orb.z }, 0); bot.resetPose({ x: orb.x + 30, y: orb.y - 1.6, z: orb.z }, 0);
  const eye = (who: typeof lead) => ({ x: who.position.x, y: who.position.y + 1.68, z: who.position.z });
  expect(takeNativeBossReward(host, KING, eye(lead)), 'the first earner takes theirs').toBe(true);
  collect();
  expect(paid).toEqual([`${lead.id}:amber-resin:3`]);
  expect(takeNativeBossReward(host, KING, eye(lead)), 'and only once').toBe(false);
  expect(rewardAt(), 'the orb stands for the other earner').not.toBeNull();
  lead.resetPose({ x: orb.x + 30, y: orb.y - 1.6, z: orb.z }, 0); bot.resetPose({ x: orb.x, y: orb.y - 1.6, z: orb.z }, 0);
  step(); expect(takeNativeBossReward(host, KING, eye(bot))).toBe(true);
  collect();
  expect(paid).toEqual([`${lead.id}:amber-resin:3`, 'bot:1:amber-resin:3']);
  expect(rewardAt(), 'the last earner takes the orb with them').toBeNull();
  expect(takeNativeBossReward(host, KING, eye(bot))).toBe(false);
  live.dispose();
}, 60_000);
