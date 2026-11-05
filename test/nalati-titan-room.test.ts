// oxlint-disable-next-line import/no-nodejs-modules -- The product and Rapier are shipped bytes.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { loadRapier, type Rapier } from '../src/engine/shared/physics/rapier';
import { actRoutes } from '../src/engine/shared/sim/actRoutes';
import { snapshotSimHost } from '../src/engine/shared/sim/snapshot';
import { openArenaOf } from '../src/game/server/boss/openArenaNative';
import { patrolOf } from '../src/game/server/boss/patrolNative';
import { outputDescriptor } from '../src/game/shared/shardfile/outputDescriptor';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { createTrustedHeadlessResident, type TrustedHeadlessResident } from '../src/sdk/headlessRuntime';
import { netInteractCommands } from '../src/sdk/standalone/netInput';
import { builtProduct } from './fixtures/builtProduct';

// The Storm Titan from Nalati's product, for a room. A tape's resident has no such fight, so its saves keep their adapters.
let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
async function nalati(room: boolean): Promise<TrustedHeadlessResident> {
  const directory = builtProduct('nalati-grasslands'), product = await loadHeadlessProduct(directory), descriptor = outputDescriptor(product.shardfile);
  if (descriptor === undefined) throw new Error('Missing output');
  const assets = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash, Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  return createTrustedHeadlessResident({ shard: product.shardfile, assets, rapier, product }, undefined, { room });
}

test('a tape\'s world has no room Titan', async () => {
  const live = await nalati(false);
  expect(openArenaOf(live.host)).toBeUndefined();
  expect(patrolOf(live.host)).toBeUndefined();
  expect(live.host.adapters.has('nalati.titan')).toBe(false);
  live.dispose();
});

test('a room runs the Titan and the patrol from the product, and a save holds them', async () => {
  const live = await nalati(true), { host } = live, arena = openArenaOf(host);
  if (arena === undefined) throw new Error('No room arena');
  expect(patrolOf(host)).toBeDefined();
  expect(host.adapters.has('nalati.titan')).toBe(true);
  host.addPlayer('bot:1');
  for (let tick = 0; tick < 120; tick++) live.step([]);
  expect(arena.boss.state).toBe('dormant');
  const saved = snapshotSimHost(host);
  expect(saved.adapters.some(row => row.id === 'nalati.titan')).toBe(true);
  live.dispose();
}, 120_000);

test('each earner takes the heart\'s reward, once, and it stands until the last has', async () => {
  const live = await nalati(true), { host } = live, arena = openArenaOf(host);
  if (arena === undefined) throw new Error('No room arena');
  const [lead] = host.players.values(), bot = host.addPlayer('bot:1');
  if (lead === undefined) throw new Error('No lead');
  for (let tick = 0; tick < 2; tick++) live.step([]);
  // Bring the fight to its last blow, and fell the heart as a held weapon does.
  const { boss, fight } = arena;
  boss.restore({ ...boss.snapshot(), state: 'fight', phase: 2, checkpoint: 2 });
  const state = fight.snapshot();
  fight.restore({ ...state, life: { ...state.life, state: { ...state.life.state, hp: 0 } } }, () => null);
  const center = fight.rewardPoint(), y = host.groundHeightAt(center.x, center.z) + 0.2;
  for (const player of [lead, bot]) player.resetPose({ x: center.x, y, z: center.z }, 0);
  for (let tick = 0; tick < 1200 && !arena.reward(); tick++) live.step([]);
  expect(arena.reward()).toBe(true);
  const point = arena.rewardPrompt()?.position;
  if (point === undefined) throw new Error('No reward stands');
  for (const player of [lead, bot]) player.resetPose({ x: point.x, y: host.groundHeightAt(point.x, point.z) + 0.2, z: point.z + 1 }, 0);
  const take = (player: string): string[] => {
    const acts = [{ kind: 'interact' as const, seq: 1, id: 'nalati.titan.reward' }];
    live.step(netInteractCommands(actRoutes(host), acts, player));
    return live.effects.flatMap(effect => effect.kind === 'item' ? [`${effect.actorId}:${effect.item}`] : []);
  };
  expect(take(bot.id)).toEqual(['bot:1:naizagai', 'bot:1:sky-marked-saddle']);
  expect(take(bot.id), 'a share is taken once').toEqual([]);
  expect(arena.reward(), 'it stands for the other earner').toBe(true);
  expect(take(lead.id)).toEqual([`${lead.id}:naizagai`, `${lead.id}:sky-marked-saddle`]);
  expect(arena.reward()).toBe(false);
  expect(boss.snapshot().saved.rewardTaken || arena.records.bosses.read()[boss.def.id]?.rewardTaken).toBe(true);
  live.dispose();
}, 120_000);
