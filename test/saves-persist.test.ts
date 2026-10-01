import { expect, it, vi } from 'vitest';
import { SaveStore } from '#engine/saves/store';
import { MemoryStorage } from './setup';

it('requests persistence once on a home-screen page and stores the device result', async () => {
  vi.resetModules(); vi.stubGlobal('navigator', {}); vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const { persistHomeScreen } = await import('#engine/saves/runtime');
  const local = new MemoryStorage(), persist = vi.fn(() => Promise.resolve(true));
  const store = new SaveStore({ local, session: null, persist });
  persistHomeScreen(store); persistHomeScreen(store); await store.persist();
  expect(persist).toHaveBeenCalledTimes(1);
  expect(local.getItem('wildshard.save.v2.device')).toContain('"storage.persisted":{"v":1,"data":true}');
});
it('does not request persistence in a browser tab', async () => {
  vi.resetModules(); vi.stubGlobal('navigator', {}); vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const { persistHomeScreen } = await import('#engine/saves/runtime');
  const persist = vi.fn(() => Promise.resolve(false)); persistHomeScreen({ persist });
  expect(persist).not.toHaveBeenCalled();
});
