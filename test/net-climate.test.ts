import { expect, test, vi } from 'vitest';
import { BitWriter } from '../src/engine/shared/net/bits';
import { NET_SCHEMA_HASH } from '../src/engine/shared/net/netSchemas';
import { decodeAct, encodeAct } from '../src/engine/shared/net/messages';
import { actRoutes } from '../src/engine/shared/sim/actRoutes';
import { DAY_ROW, publishDay, shardRows } from '../src/engine/shared/sim/shardRows';
import { Scope } from '../src/engine/shared/app/scope';
import { WirePage } from '../src/game/client/shardfile/wirePage';
import { NetClient } from '../src/engine/client/net/client';
import { netClimate } from '../src/game/client/weather/netClimate';
import { installDeclaredClimate } from '../src/game/server/shardfile/declaredClimate';
import { publishWeather } from '../src/game/server/weather/wire';
import { netClimateActs } from '../src/sdk/standalone/netInput';
import type { Transport } from '../src/engine/shared/net/transport';
import type { SimHost } from '../src/engine/sim';
import type { WeatherProgram } from '@wildshard/format/weatherProgram';

// Flip checklist 5 and 6: a data shard's day and weather step on the server and reach the page as rows, and a page's weather
// setting and a dev's jump reach that sky as an act.
const act = { kind: 'climate', seq: 3, op: 'force', name: 'storm', at: 0.5 } as const;
test('a word on the sky survives the wire, and the schema hash names its form', () => {
  expect(decodeAct(new Uint8Array(encodeAct(new BitWriter(), act)))).toEqual(act);
  expect(NET_SCHEMA_HASH).toBeTypeOf('number');
});

interface FakeHost { readonly scope: Scope; readonly players: Map<string, unknown>; readonly level: { readonly seed: number }; readonly dayClock: undefined; steps: ((dt: number) => void)[]; onStep: (id: string, run: (dt: number) => void) => void }
function fakeHost(): FakeHost & SimHost {
  const host: FakeHost = { scope: new Scope('test'), players: new Map([['a', {}]]), level: { seed: 7 }, dayClock: undefined, steps: [], onStep(_id, run) { this.steps.push(run); } };
  return host as FakeHost & SimHost;
}
const sky = (): { setMode: ReturnType<typeof vi.fn>; force: ReturnType<typeof vi.fn> } & Parameters<typeof publishWeather>[1] => ({ n: { rain: 0 }, state: 'clear', phaseLeft: 3, profile: { states: ['clear', 'storm'], modes: { live: 'none' } }, setMode: vi.fn(), force: vi.fn() });

test('a lone player\'s word lands on their sky, a known word only, and a room\'s sky hears no one', () => {
  const host = fakeHost(), air = sky(), input = (word: Omit<typeof act, 'kind' | 'seq' | 'op' | 'name' | 'at'> & { readonly op: 'mode' | 'force'; readonly name: string; readonly at: number }): { acts: readonly { kind: 'climate'; seq: number; op: 'mode' | 'force'; name: string; at: number }[] } => ({ acts: [{ kind: 'climate', seq: 0, ...word }] });
  publishWeather(host, air);
  const routes = actRoutes(host);
  netClimateActs(routes, [input({ op: 'mode', name: 'live', at: -1 }), input({ op: 'force', name: 'storm', at: 0.25 })]);
  expect(air.setMode).toHaveBeenCalledExactlyOnceWith('live', undefined);
  expect(air.force).toHaveBeenCalledExactlyOnceWith('storm', 0.25);
  netClimateActs(routes, [input({ op: 'mode', name: 'nonsense', at: -1 }), input({ op: 'force', name: 'nonsense', at: 0 })]);
  host.players.set('b', {});
  netClimateActs(routes, [input({ op: 'force', name: 'storm', at: 0.75 })]);
  expect(air.setMode).toHaveBeenCalledOnce();
  expect(air.force).toHaveBeenCalledOnce();
});

test('a world with no weather has nothing to say to a word', () => {
  expect(() => { netClimateActs(actRoutes(fakeHost()), [{ acts: [{ ...act }] }]); }).not.toThrow();
});

const dayRows = { units: 'hour', start: 6, schedule: [{ phase: 'day', minutes: 1 }], sun: {}, fixed: {} };
test('a data shard\'s clock steps on the server and is on the wire', () => {
  const host = fakeHost(), rows = { days: [dayRows], weather: [] } as unknown as Parameters<typeof installDeclaredClimate>[1];
  installDeclaredClimate(host, rows);
  const row = (): number | undefined => shardRows(host).world.get('day')?.()[0]?.value;
  const before = row();
  for (const step of host.steps) step(10);
  expect(shardRows(host).world.get('day')?.()[0]?.name).toBe(DAY_ROW);
  expect(row()).not.toBe(before);
});

test('a day clock publishes in steps, so a slow day is a row now and then', () => {
  const host = fakeHost(), clock = { phase: 0.123456789 };
  publishDay(host, clock);
  const value = shardRows(host).world.get('day')?.()[0]?.value ?? 0;
  expect(value * 4096).toBe(Math.round(value * 4096));
});

const silent: Transport = { send: () => undefined, close: () => undefined, onMessage: () => () => undefined, onClose: () => () => undefined, stats: { rttMs: 0, lossPct: 0, sentBytes: 0, recvBytes: 0 } };
const frame = (cell: number): NetClient['latest'] => ({ tick: 2, baselineTick: -1, cell, lastSeq: 0, owner: new Float64Array(0), rows: new Map(), ride: null, fresh: new Set() });
test('a setting waits for the wire, and each world hears it as the page gets there', () => {
  const page = new WirePage(), said: unknown[] = [], client = new NetClient(silent);
  page.bind(client, () => undefined, () => undefined, () => false, word => { said.push(word); });
  const feed = netClimate(page.climateRows, { weather: { states: ['clear'], registers: {}, outputs: {} } as unknown as WeatherProgram }, word => { page.climate(word); });
  feed.setMode('rain', 0.5); feed.force('clear', 0.1);
  expect(said).toEqual([]);
  client.latest = frame(1); page.frame(null, true);
  expect(said).toHaveLength(2);
  client.latest = frame(0); page.frame(null, true);
  expect(said, 'a mode outlives its world, and a jump does not').toHaveLength(3);
});

test('the page\'s clock follows the server\'s, unless someone stopped it', () => {
  const page = new WirePage(), client = new NetClient(silent), clock = { phase: 0.1, paused: false };
  vi.spyOn(client, 'stateField').mockReturnValue(0.5);
  page.bind(client, () => undefined, () => undefined, () => false);
  client.latest = frame(1); page.frame(null, true, clock);
  expect(clock.phase).toBe(0.5);
  const stopped = { phase: 0.2, paused: true };
  page.frame(null, true, stopped);
  expect(stopped.phase).toBe(0.2);
});
