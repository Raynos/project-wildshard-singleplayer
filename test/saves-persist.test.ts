import { expect, it, vi } from 'vitest';
import { SaveStore } from '#engine-internal/saves/store';
import { homeScreenPersistence } from '#engine-internal/saves/runtime';
import { MemoryStorage } from './setup';

// each test builds its own persistence with the display it stands in (no module reset, no stubbed globals: E422)
it('requests persistence once on a home-screen page and stores the device result', async () => {
  const persistHomeScreen = homeScreenPersistence(() => true);
  const local = new MemoryStorage(), persist = vi.fn(() => Promise.resolve(true));
  const store = new SaveStore({ local, session: null, persist });
  persistHomeScreen(store); persistHomeScreen(store); await store.persist();
  expect(persist).toHaveBeenCalledTimes(1);
  expect(local.getItem('wildshard.save.v2.device')).toContain('"storage.persisted":{"v":1,"data":true}');
});
it('does not request persistence in a browser tab', () => {
  const persistHomeScreen = homeScreenPersistence(() => false);
  const persist = vi.fn(() => Promise.resolve(false)); persistHomeScreen({ persist });
  expect(persist).not.toHaveBeenCalled();
});
