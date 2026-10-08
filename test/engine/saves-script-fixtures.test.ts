import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the actual serializable browser script helpers in an isolated VM.
import { runInNewContext } from 'node:vm';
// oxlint-disable-next-line import/default -- Vite's ?raw loader exports this module's source as a default string.
import source from '../../scripts/debug-settings.mjs?raw';
import { MemoryStorage } from '../setup';
import { createSettings } from '../../src/engine/ui/Settings';

it('seeds versioned documents, merges Settings, and does not overwrite a once-seeded save on reload', () => {
  const localStorage = new MemoryStorage(), sessionStorage = new MemoryStorage();
  const context: Record<string, unknown> = { localStorage, sessionStorage };
  runInNewContext(source.replaceAll(/^export /gmu, ''), context);
  const write = context['writeSaveFixture'];
  if (typeof write !== 'function') throw new Error('Fixture helper missing');
  const fixture = write as (value: { scope: string; key: string; data: unknown; merge?: boolean; once?: string }) => void;
  fixture({ scope: 'global', key: 'settings', data: { touch: 'on' } });
  fixture({ scope: 'global', key: 'settings', data: { tex: 'img' }, merge: true });
  fixture({ scope: 'pine-hollow', key: 'purse', data: 19, once: 'purse' });
  fixture({ scope: 'pine-hollow', key: 'purse', data: 0, once: 'purse' });
  fixture({ scope: 'session', key: 'titleArrival', data: { slug: 'pine-hollow' } });
  expect(JSON.parse(localStorage.getItem('wildshard.save.v2.global') ?? '{}')).toEqual({ keys: { settings: { v: 1, data: { touch: 'on', tex: 'img' } } } });
  expect(localStorage.getItem('wildshard.save.v2.pine-hollow')).toContain('"data":19');
  expect(sessionStorage.getItem('wildshard.save.v2.session')).toContain('titleArrival');
  expect(localStorage.getItem('ws.settings.v1')).toBeNull();
});
it('serializes external-evaluator fixtures without needing a page closure', () => {
  const context: Record<string, unknown> = { localStorage: new MemoryStorage(), sessionStorage: new MemoryStorage() };
  runInNewContext(source.replaceAll(/^export /gmu, ''), context);
  const code = context['saveFixtureCode']; if (typeof code !== 'function') throw new Error('Code helper missing');
  const makeCode = code as (value: { scope: string; key: string; data: unknown }) => string;
  runInNewContext(makeCode({ scope: 'device', key: 'devMode', data: true }), context);
  const local = context['localStorage']; if (!(local instanceof MemoryStorage)) throw new Error('Storage missing');
  expect(local.getItem('wildshard.save.v2.device')).toContain('"data":true');
  expect(local.getItem('wildshard.save.v2.global')).toBe('{"keys":{}}');
});

it('seeds explicit memory variants in device slots and refuses ambiguous picks', () => {
  const localStorage = new MemoryStorage(), context: Record<string, unknown> = { localStorage, sessionStorage: new MemoryStorage() };
  runInNewContext(source.replaceAll(/^export /gmu, ''), context);
  const parser = context['deviceSavePicks'], code = context['saveFixtureCode'];
  if (typeof parser !== 'function' || typeof code !== 'function') throw new Error('Device fixture helpers missing');
  const parse = parser as (values: readonly string[]) => Record<string, string>;
  const makeCode = code as (value: { scope: string; key: string; data: unknown }) => string;
  const key = 'debug.plugin.pine-hollow.pineMemoryTrim';
  const picks = parse([`${key}=on`, 'debug.plugin.driftwood-isle.driftwoodHybrid=off']);
  for (const [name, data] of Object.entries(picks)) runInNewContext(makeCode({ scope: 'device', key: name, data }), context);
  expect(JSON.parse(localStorage.getItem('wildshard.save.v2.device') ?? '{}')).toEqual({ keys: {
    [key]: { v: 1, data: 'on' }, 'debug.plugin.driftwood-isle.driftwoodHybrid': { v: 1, data: 'off' },
  } });
  expect(localStorage.getItem('wildshard.save.v2.global')).toBe('{"keys":{}}');
  expect(() => parse([`${key}=on`, `${key}=off`])).toThrow('Duplicate');
  expect(() => parse([`${key}=`])).toThrow('Invalid');
});


it('makes capture time effective through the real Developer fence without changing ordinary save fixtures', async () => {
  const localStorage = new MemoryStorage(), sessionStorage = new MemoryStorage();
  const context: Record<string, unknown> = { localStorage, sessionStorage };
  runInNewContext(source.replaceAll(/^export /gmu, ''), context);
  const helper = context['developerSettings'], plain = context['debugSettings'];
  if (typeof helper !== 'function' || typeof plain !== 'function') throw new Error('Settings helpers missing');
  const scripts = { addInitScript: (fn: (value: unknown) => void, value: unknown): void => { fn(value); } };
  const seed = plain as (target: typeof scripts, picks: Record<string, string>) => Promise<void>;
  const capture = helper as (target: typeof scripts, picks: Record<string, string>) => Promise<void>;
  const codec = context['fixtureStorage'];
  if (typeof codec !== 'function') throw new Error('Storage codec missing');
  const storage = codec as (scope: string) => Pick<Storage, 'getItem' | 'setItem'>;
  const device = storage('device'), store = storage('global');
  const enabled = (): boolean => JSON.parse(device.getItem('devMode') ?? 'false') === true;
  await seed(scripts, { time: 'midday', weather: 'rain' });
  expect(createSettings(store, () => '', { enabled }).setting('time')).toBe('live');
  await capture(scripts, { time: 'midday', weather: 'rain' });
  const settings = createSettings(store, () => '', { enabled });
  expect(settings.setting('time')).toBe('midday');
  expect(settings.setting('weather')).toBe('rain');
  expect(enabled()).toBe(true);
});
