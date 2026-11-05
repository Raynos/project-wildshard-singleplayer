import { expect, test } from 'vitest';
import { installHostPortalRide, type RidePlayer } from '../src/game/client/shardfile/portalRideBinding';
import { portalEntryRows, portalPlanRows } from '../src/shards/nine-dragon-stack/generators/portalEntries';
import portals from '../src/shards/nine-dragon-stack/data/portals.json' with { type: 'json' };
import portalStages from '../src/shards/nine-dragon-stack/data/portalStages.json' with { type: 'json' };
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { builtProduct } from './fixtures/builtProduct';

// P1-E3: a portal takes whoever walks in. Each player's ride and hold are their own, and alone the save keeps its bytes.
const plan = portalPlanRows(), rows = { director: 'portal.test', trigger: portals.trigger, fade: portals.fade, landings: [], veil: {} } as never;
function player(x: number, y: number, z: number): RidePlayer {
  const point = { x, y, z, set(a: number, b: number, c: number) { point.x = a; point.y = b; point.z = c; return point; } };
  return { position: point, yaw: 0, motor: { resetAt: () => undefined, release: () => undefined } as never, fall: { vy: 0, grounded: true }, impulse: { set: () => undefined },
    shove: { t: 0 }, dash: { t: 0 }, board: { on: false }, setBoard: () => undefined };
}
function room(players: Map<string, RidePlayer>) {
  let step: (dt: number) => void = () => undefined, adapter: { snapshot: () => string; restore: (value: unknown) => void } | undefined;
  const host = { players, physics: {} as never, onStep: (_id: string, run: (dt: number) => void, saved: typeof adapter) => { step = run; adapter = saved; } };
  return { host, step: (dt: number) => { step(dt); }, adapter: () => { if (adapter === undefined) throw new Error('No adapter'); return adapter; } };
}

test('a bot walks into a portal alone, and the save holds its fade', async () => {
  const source = { ...(await loadHeadlessProduct(builtProduct('nine-dragon-stack'))).shardfile, entryways: portalEntryRows(), directors: [{ ...portalStages, id: 'portal.test' }] } as never;
  const deck = plan.decks[0]; if (deck === undefined) throw new Error('No deck');
  const lead = player(0, 125, 7), bot = player(deck.x, deck.y, deck.z), make = () => new Map([['actor.player', lead], ['bot:1', bot]]);
  const at = room(new Map([['actor.player', lead]])), ride = installHostPortalRide(at.host, 'portal.test', source, rows, () => undefined);
  at.step(1 / 60);
  const alone: unknown = JSON.parse(at.adapter().snapshot());
  expect(Object.keys(alone as object).sort()).toEqual(['held', 'ride']);

  at.host.players.set('bot:1', bot); at.step(1 / 60);
  expect(ride.busy(), 'the first player has not moved').toBe(false);
  const saved = at.adapter().snapshot(), row = (JSON.parse(saved) as { others: Record<string, { held: unknown }> }).others['bot:1'];
  expect(row?.held, 'the bot is held for the fade').toEqual({ x: deck.x, y: deck.y, z: deck.z });

  const next = room(make()), resumed = installHostPortalRide(next.host, 'portal.test', source, rows, () => undefined);
  next.adapter().restore(saved);
  expect(next.adapter().snapshot()).toBe(saved);
  expect(resumed.busy()).toBe(false);
});
