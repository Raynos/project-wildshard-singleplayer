// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Box3, Group, PerspectiveCamera, Scene, Vector3 } from 'three';
import { app } from '../src/engine/app/runtime';
import { Scope } from '../src/engine/app/scope';
import type { World } from '../src/engine/core/bootstrap';
import type { Game } from '../src/engine/core/Game';
import type { Explore } from '../src/engine/explore/Explore';
import type { CatalogEntry } from '../src/engine/explore/catalog';
import { Compare } from '../src/engine/explore/Compare';
import { MiniMap } from '../src/engine/explore/MiniMap';
import { ModelExplorer } from '../src/engine/explore/ModelExplorer';
import { SetExplorer } from '../src/engine/explore/SetExplorer';
import { WorldRegistry } from '../src/engine/world/registry';
import { fakeWorld } from './fake/world';
import { legacyDouble } from './fake/FakeGame';

const hostile = '<img src=x onerror="bad()"><script>bad()</script>& "literal"';
const previousRegistry = app.registryValue;
let scope: Scope;
beforeEach(() => {
  scope = new Scope('literal-explore'); app.levelScope = scope; app.registryValue = new WorldRegistry();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { scope.dispose(); app.levelScope = null; app.registryValue = previousRegistry; vi.restoreAllMocks(); document.body.replaceChildren(); });
function fixture(): { world: World; explore: Explore } {
  const sky = fakeWorld().sky;
  const level = legacyDouble<Game['level']>({ id: 'literal-fixture', pois: [{ id: 'poi', name: hostile, x: 0, z: 0 }],
    explore: { world: '/world.jpg', models: '/models.jpg', sets: '/sets.jpg', practice: '/practice.jpg',
      compare: [{ id: hostile, label: hostile, model: 'model', live: '/live.jpg', image: '/mockup.jpg', target: '/source.jpg' }] } });
  const game = legacyDouble<Game>({ scene: new Scene(), camera: new PerspectiveCamera(), canvas: document.createElement('canvas'), level });
  const world = legacyDouble<World>({ game, sky });
  const explore = legacyDouble<Explore>({ root: document.createElement('div'), title: { name: hostile, thumb: '', landscape: '' },
    setCompareOpen: () => undefined, flyTo: () => undefined, openSet: () => undefined });
  return { world, explore };
}
it('keeps compare IDs and names literal, retaining target selection and the split overlay', () => {
  const { world, explore } = fixture(), compare = new Compare(explore, world);
  const button = explore.root.querySelector<HTMLButtonElement>('.ws-x-target'); if (button === null) throw new Error('Missing target');
  expect(button.dataset['id']).toBe(hostile); expect(button.querySelector('b')?.textContent).toBe(hostile); button.click();
  expect(compare.isOpen).toBe(true); expect(compare.context()).toEqual({ compare: hostile, mockup: '/source.jpg' });
  expect(explore.root.querySelector('.ws-x-compare-head b')?.textContent).toBe(hostile);
  expect(explore.root.querySelector('script,[onerror]')).toBeNull(); expect(explore.root.querySelectorAll('img')).toHaveLength(2);
  compare.close(); expect(compare.isOpen).toBe(false);
});
it('keeps the mini-map title and point-of-interest label literal beside their existing glyphs', () => {
  const { world, explore } = fixture(); new MiniMap(explore, world);
  expect(explore.root.querySelector('.ws-x-map-head b')?.textContent).toBe(hostile);
  expect(explore.root.querySelector('.ws-x-pin span')?.textContent).toBe(hostile);
  expect(explore.root.querySelector('.ws-x-pin i')).not.toBeNull(); expect(explore.root.querySelector('img,script,[onerror]')).toBeNull();
});
it('keeps model and set catalogue names literal with their unchanged statistics and chips', () => {
  const { world, explore } = fixture();
  const entry: CatalogEntry = { id: 'model', name: hostile, category: 'props', file: hostile, live: false, object: () => new Group(),
    pipeline: ['code'], buildMs: 0, copies: 2, drawnAs: 'single' };
  const models = new ModelExplorer(explore, world, [entry]);
  expect(models.el.querySelector('.ws-x-model b')?.textContent).toBe(hostile);
  expect(models.el.querySelectorAll('.ws-x-model small')).toHaveLength(2);
  app.registry.sets.push({ id: 'set', name: hostile, file: hostile, members: [{ model: 'model', copies: 2 }], bounds: new Box3(new Vector3(), new Vector3(1, 1, 1)) });
  const sets = new SetExplorer(explore, world, [entry]); sets.show({});
  expect(sets.el.querySelector('.ws-x-setlist-head span')?.textContent).toBe(`Sets · ${hostile}`);
  expect(sets.el.querySelector('.ws-x-set-text b')?.textContent).toBe(hostile);
  expect(sets.el.querySelector('.ws-x-setchip')?.textContent).toContain(hostile);
  expect(models.el.querySelector('img,script,[onerror]')).toBeNull(); expect(sets.el.querySelector('img,script,[onerror]')).toBeNull(); sets.hide();
});
