// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { Scope, TabRegistry, type TabSpec, type TabFragment, type KitEntry } from '#engine';
import { BagMenu, bagMenu } from '#game/bag/tabs';
import { Inventory } from '#game/Inventory';
import { Progress } from '#game/Progress';
import type { FindsView } from '#game/bag/bag';

function host() {
  const scope = new Scope('bag-test'), tabs = new TabRegistry(), panels = new Map<string, HTMLElement>();
  const menu = { scope, isOpen: true, close: vi.fn<(silent?: boolean) => void>(),
    addTab(spec: TabSpec): () => void {
      const off = tabs.tab(spec); panels.set(spec.id, document.createElement('div'));
      return () => { off(); panels.delete(spec.id); };
    },
    addTabFragment(tab: string, fragment: TabFragment): () => void { return tabs.fragment(tab, fragment); },
    refresh(): void { for (const [id, panel] of panels) { panel.replaceChildren(); tabs.render(id, panel); } },
  };
  return { menu, tabs, panels };
}
const view = (label: string): FindsView => ({ counters: [{ label, n: 1, of: 2 }], next: null, sections: [], glass: [] });
const weapon: KitEntry = { id: 'sword', name: 'Sword', ammoLabel: '', ammo: 0, magazine: 0, reserve: 0,
  equipped: true, icon: 'sword', melee: true, tracers: false, huntersEye: false };

describe('game-owned registered Bag tabs', () => {
  it('registers the shared paper doll, pack and feats, with live equipment actions and trade text', () => {
    const { menu, tabs, panels } = host();
    let selected = 'sword', worn = false;
    const kit = (): KitEntry[] => [weapon, { ...weapon, id: 'bow', name: 'Bow', equipped: selected === 'bow' }];
    new BagMenu(menu, { progress: new Progress('driftwood-isle'), inventory: new Inventory('driftwood-isle'), kit,
      onEquip: (id) => { selected = id; }, skins: () => [{ id: 'gold', name: 'Gold', blurb: 'Reward', worn }],
      onWearSkin: () => { worn = !worn; }, skinsTitle: 'Finishes',
      tools: () => [{ id: 'hook', name: 'Hook', kind: 'Tool', how: 'Grapple', icon: 'grapple' }],
      pack: { note: 'Trade stock', hint: 'Trade at the stall', line: () => 'Bolts' } });
    expect(tabs.registeredTabs.map((tab) => tab.id)).toEqual(['gear', 'inventory', 'achievements']);
    menu.refresh();
    const gear = panels.get('gear');
    expect(gear?.querySelector('.ws-gmenu-doll')).not.toBeNull();
    expect(gear?.textContent).toContain('Finishes'); expect(gear?.textContent).toContain('Hook');
    const bow = [...(gear?.querySelectorAll<HTMLButtonElement>('button.weapon') ?? [])].find((row) => row.textContent.includes('Bow'));
    bow?.click(); expect(selected).toBe('bow');
    gear?.querySelector<HTMLButtonElement>('button.cosmetic')?.click(); expect(worn).toBe(true);
    expect(panels.get('inventory')?.querySelectorAll('.ws-gmenu-slot').length).toBe(12);
    expect(panels.get('inventory')?.textContent).toContain('Trade stock');
    menu.scope.dispose();
  });
  it('honors declared game tabs while keeping independently registered content available', () => {
    const { menu, tabs } = host();
    const bag = new BagMenu(menu, { tabs: ['map', 'gear'], progress: new Progress('driftwood-isle'), inventory: new Inventory('driftwood-isle'), kit: () => [] });
    bag.addFinds('hidden', () => view('Hidden'));
    expect(tabs.registeredTabs.map((tab) => tab.id)).toEqual(['gear']);
    menu.addTab({ id: 'authored', title: 'Authored' });
    expect(tabs.registeredTabs.map((tab) => tab.id)).toEqual(['authored', 'gear']);
    menu.scope.dispose();
  });
  it('keeps independent finds owners and authored fragments, disposing the finds tab only after its last owner', () => {
    const { menu, tabs, panels } = host();
    const bag = new BagMenu(menu, { progress: new Progress('nine-dragon-stack'), inventory: new Inventory('nine-dragon-stack'), kit: () => [] });
    const offA = bag.addFinds('a', () => view('Alpha')), offB = bag.addFinds('b', () => view('Beta'));
    const offC = bag.fragment('finds', { id: 'authored', render: (panel) => { panel.append('Authored'); } });
    menu.refresh(); expect(panels.get('finds')?.textContent).toContain('Alpha'); expect(panels.get('finds')?.textContent).toContain('Beta');
    expect(() => bag.addFinds('b', () => view('Replacement'))).toThrow('Duplicate Bag finds');
    offA(); offB(); expect(tabs.registeredTabs.map((tab) => tab.id)).toContain('finds');
    expect(panels.get('finds')?.textContent).toBe('Authored');
    offC(); offC(); expect(tabs.registeredTabs.map((tab) => tab.id)).not.toContain('finds');
    menu.scope.dispose(); expect(() => bagMenu(menu)).toThrow('not installed');
  });
  it('supports a finds-only authored tab and rejects duplicate fragments without losing its owner', () => {
    const { menu, panels } = host();
    const bag = new BagMenu(menu, { progress: new Progress('nine-dragon-stack'), inventory: new Inventory('nine-dragon-stack'), kit: () => [] });
    const off = bag.fragment('finds', { id: 'places', render: (panel) => { panel.append('Places'); } });
    expect(() => bag.fragment('finds', { id: 'places', render: () => undefined })).toThrow('Duplicate UI fragment');
    menu.refresh(); expect(panels.get('finds')?.textContent).toBe('Places');
    off(); expect(panels.has('finds')).toBe(false); menu.scope.dispose();
  });
});
