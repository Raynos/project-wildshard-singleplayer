// oxlint-disable-next-line import/no-nodejs-modules -- The product and Rapier are shipped bytes.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { questBooks } from '../src/engine/quest/players';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { leadPlayer } from '../src/engine/sim/leadPlayer';
import { serializeSimSnapshot, snapshotSimHost } from '../src/engine/sim/snapshot';
import { cableModes } from '../src/engine/player/modes';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { createTrustedHeadlessResident, type TrustedHeadlessResident } from '../src/sdk/headlessRuntime';
import spots from '../src/shards/driftwood-isle/data/spotsRows.json' with { type: 'json' };
import { builtProduct } from './fixtures/builtProduct';

// P1-E3.3: the owners that carry one traveller seat every player: a bot rides the cable on its own ride, and it saves.
let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
async function resident(slug: string, snapshot?: string): Promise<TrustedHeadlessResident> {
  const directory = builtProduct(slug), product = await loadHeadlessProduct(directory), descriptor = outputDescriptor(product.shardfile);
  if (descriptor === undefined) throw new Error('Missing output');
  const assets = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash, Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  return createTrustedHeadlessResident({ shard: product.shardfile, assets, rapier, product }, snapshot);
}
const use = (value: number) => ({ kind: 'script' as const, actorId: 'driftwood.interact', value, playerId: 'bot:1' });

test('a bot rides Driftwood\'s zipline alone, and the wire keeps it across a save', async () => {
  const live = await resident('driftwood-isle'), { host } = live, spawn = leadPlayer(host).position.clone();
  const bot = host.addPlayer('bot:1', { x: spots.zipline.prompt.x, y: spots.zipline.prompt.y, z: spots.zipline.prompt.z });
  const cables = cableModes(host.scope);
  live.step([use(2)]);
  expect(cables.seatState('driftwood.zipline', 'bot:1').riding, 'the bot is on its own wire').toBe(true);
  expect(cables.state('driftwood.zipline').riding, 'the lead is not').toBe(false);
  for (let tick = 0; tick < 60; tick++) live.step([]);
  const mid = cables.snapshotSeat('driftwood.zipline', 'bot:1');
  expect(mid.s).toBeGreaterThan(0);
  expect(bot.position.z).toBeLessThan(spots.zipline.top.z);

  const wire = serializeSimSnapshot(snapshotSimHost(host));
  for (let tick = 0; tick < 1200 && cables.seatState('driftwood.zipline', 'bot:1').riding; tick++) live.step([]);
  const books = questBooks(host);
  expect(books.of('bot:1').flags.has('used:zipline'), 'the end is the bot\'s').toBe(true);
  expect(host.flags.has('used:zipline'), 'and no one else\'s').toBe(false);
  expect(leadPlayer(host).position.distanceTo(spawn)).toBeLessThan(1);
  live.dispose();

  const resumed = await resident('driftwood-isle', wire), after = cableModes(resumed.host.scope);
  questBooks(resumed.host).of('bot:1');
  expect(after.seatState('driftwood.zipline', 'bot:1').riding, 'a restored bot is still on the wire').toBe(true);
  expect(after.snapshotSeat('driftwood.zipline', 'bot:1').s).toBeCloseTo(mid.s, 5);
  resumed.dispose();
}, 60_000);
