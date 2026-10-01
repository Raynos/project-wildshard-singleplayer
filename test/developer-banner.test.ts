// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { app, setDev } from '#engine';
import { mountDeveloperBanner } from '../src/engine/ui/developerBanner';

afterEach(() => { setDev(false); document.body.replaceChildren(); });
it('only shows a hidden-level banner in developer mode, and follows the switch live', () => {
  const root = document.createElement('div'); document.body.append(root);
  const scope = app.engineScope.child('test.developer-banner');
  setDev(false);
  mountDeveloperBanner(root, scope, 'DEVELOPER ONLY · TEMPLATE');
  const banner = root.querySelector<HTMLElement>('.ws-game-developer');
  expect(banner?.hidden).toBe(true);
  setDev(true);
  expect(banner?.hidden).toBe(false);
  expect(banner?.textContent).toBe('DEVELOPER ONLY · TEMPLATE');
  setDev(false);
  expect(banner?.hidden).toBe(true);
  scope.dispose();
  expect(root.children).toHaveLength(0);
});
it('builds no banner for player-facing levels even with developer mode on', () => {
  const root = document.createElement('div');
  const scope = app.engineScope.child('test.visible-level');
  setDev(true);
  mountDeveloperBanner(root, scope, undefined);
  expect(root.children).toHaveLength(0);
  scope.dispose();
});
