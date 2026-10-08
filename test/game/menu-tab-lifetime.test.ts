// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { withOwner } from '../../src/engine/app/ownership';
import { Scope } from '../../src/engine/app/scope';
import { GameMenu } from '../../src/engine/ui/Menu';
import type { FullMap } from '../../src/engine/ui/Map';
import { BagMenu, bagMenu } from '../../src/game/bag/tabs';
import { Inventory } from '../../src/game/Inventory';
import { Progress } from '../../src/game/Progress';
import { legacyDouble } from '../fake/FakeGame';

it('removes real tab button listeners and Bag registrations without accumulating parent disposers', () => {
  const scope = new Scope('menu-lifetime');
  const map = legacyDouble<FullMap>({ mount: () => undefined, show: () => undefined, hide: () => undefined, fit: () => undefined,
    zoom: 1, hasRoom: false, quest: null });
  const menu = withOwner(scope, () => new GameMenu({ fullMap: map, settings: () => ({ weapons: new Set(), melee: false, tracers: false, huntersEye: false }) }));
  new BagMenu(menu, { progress: new Progress('pine-hollow'), inventory: new Inventory('pine-hollow'), kit: () => [] });
  const baseline = scope.census;
  try {
    for (let entry = 0; entry < 50; entry++) {
      const off = menu.addTab({ id: 'temporary', title: 'Temporary' });
      const button = menu.root.querySelector('[data-tab="temporary"]');
      expect(button).not.toBeNull(); expect(scope.census.listeners).toBe(baseline.listeners + 1);
      off(); off(); expect(scope.census).toEqual(baseline);
      button?.dispatchEvent(new MouseEvent('click')); expect(scope.census).toEqual(baseline);
      const stop = newFinds();
      expect(menu.root.querySelector('[data-tab="finds"]')).not.toBeNull();
      stop(); stop();
      expect(menu.root.querySelector('[data-tab="finds"]')).toBeNull(); expect(scope.census).toEqual(baseline);
    }
  } finally { scope.dispose(); }
  expect(scope.census).toMatchObject({ listeners: 0, disposers: 0 });
  function newFinds(): () => void {
    // Use the production Bag registry, rather than a standalone callback counter.
    return bagMenu(menu).addFinds('fixture', () => ({ counters: [], next: null, sections: [], glass: [] }));
  }
});

it('SF57: an early remove drops the page menu hold on a fragment, a loot row and a settings section (their closures)', () => {
  const scope = new Scope('menu-lifetime');
  const map = legacyDouble<FullMap>({ mount: () => undefined, show: () => undefined, hide: () => undefined, fit: () => undefined,
    zoom: 1, hasRoom: false, quest: null });
  const menu = withOwner(scope, () => new GameMenu({ fullMap: map, settings: () => ({ weapons: new Set(), melee: false, tracers: false, huntersEye: false }) }));
  new BagMenu(menu, { progress: new Progress('pine-hollow'), inventory: new Inventory('pine-hollow'), kit: () => [] });
  const bag = bagMenu(menu);
  const baseline = scope.census;
  try {
    for (let visit = 0; visit < 20; visit++) {
      // what a resident shard registers on the page menu, removed when its own scope leaves (context.ts bag.fragment)
      const offFragment = bag.fragment('finds', { id: 'shard.finds', render: (panel) => { panel.append(`visit ${visit}`); } });
      const offLoot = bag.addLoot('shard.loot', { gear: () => null, finds: null, wear: () => undefined });
      const row = document.createElement('div');
      const offSection = menu.addSettingsSection('save', [row], { refresh: () => { row.textContent = `visit ${visit}`; } });
      expect(scope.census.disposers).toBeGreaterThan(baseline.disposers);
      offFragment(); offLoot(); offSection();
      offFragment(); offLoot(); offSection();
      expect(scope.census).toEqual(baseline);
      expect(row.isConnected).toBe(false);
    }
  } finally { scope.dispose(); }
  expect(scope.census).toMatchObject({ listeners: 0, disposers: 0 });
});
