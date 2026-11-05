// oxlint-disable-next-line import/no-nodejs-modules -- The product and Rapier are shipped bytes.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { questBooks } from '../src/engine/quest/players';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { leadPlayer } from '../src/engine/sim/leadPlayer';
import { snapshotSimHost } from '../src/engine/sim/snapshot';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { createTrustedHeadlessResident, type TrustedHeadlessResident } from '../src/sdk/headlessRuntime';
import { builtProduct } from './fixtures/builtProduct';

// P1-E3.3: Driftwood's real quest, in a room of two. A bot takes the same steps as the verb tape's and the quest is the
// bot's: the headless host runs it from the built product, on script commands that name the bot.
let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
async function resident(snapshot?: string): Promise<TrustedHeadlessResident> {
  const directory = builtProduct('driftwood-isle'), product = await loadHeadlessProduct(directory), descriptor = outputDescriptor(product.shardfile);
  if (descriptor === undefined) throw new Error('Missing output');
  const assets = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash, Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  return createTrustedHeadlessResident({ shard: product.shardfile, assets, rapier, product }, snapshot);
}
const use = (value: number) => ({ kind: 'script' as const, actorId: 'driftwood.interact', value, playerId: 'bot:1' });
/** Stand the bot on the ground at a tape stop: the tape walks there; this test is about who the steps belong to. */
function stand(live: TrustedHeadlessResident, x: number, z: number): void {
  const bot = live.host.players.get('bot:1'); if (bot === undefined) throw new Error('No bot');
  bot.position.set(x, live.host.groundHeightAt(x, z), z); bot.motor.resetAt(bot.position);
  for (let tick = 0; tick < 3; tick++) live.step([]);
}

test('a bot plays Driftwood\'s opening, and the quest is the bot\'s alone', async () => {
  const live = await resident(), { host } = live, spawn = leadPlayer(host).position;
  host.addPlayer('bot:1', { x: spawn.x, y: spawn.y, z: spawn.z });
  const book = questBooks(host).of('bot:1'), ring = () => book.quests.find(quest => quest.def.id === 'sealed-ring'), lead = () => host.quests.find(quest => quest.def.id === 'sealed-ring');
  live.step([use(100)]);
  expect(book.flags.has('has:flint'), 'out of reach, the chest refuses').toBe(false);

  stand(live, -22, -71.5); live.step([use(0)]);
  expect(book.flags.has('talked:castaway')).toBe(true);
  expect(ring()?.isStarted).toBe(true);

  stand(live, -22, -62.9); live.step([use(100)]);
  expect(book.flags.has('open:castaway-chest')).toBe(true);
  expect(book.flags.has('has:flint')).toBe(true);
  const opened = book.flags.all.length;
  live.step([use(100)]);
  expect(book.flags.all.length, 'a second use cannot repeat the chest').toBe(opened);

  expect(lead()?.isStarted).toBe(false);
  expect(host.flags.has('talked:castaway')).toBe(false);
  expect(host.flags.has('open:castaway-chest')).toBe(false);
  expect(host.flags.has('has:flint')).toBe(false);

  const saved = snapshotSimHost(host);
  expect(saved.books?.[0]?.flags).toEqual(expect.arrayContaining(['talked:castaway', 'open:castaway-chest', 'has:flint']));
  live.dispose();
}, 60_000);
