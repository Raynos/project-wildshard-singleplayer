// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { app } from '../src/engine/app/runtime';
import { CONTENT_CAPS as C, CONTENT_MB as MB } from '../src/engine/core/config';
import { setDev } from '../src/engine/core/devMode';
import { ResidencyAllocator, type ResidencyCategory } from '../src/game/grid/allocator';
import { BUDGET_CATEGORIES, budgetPoints, PLATFORM_OWNER, SHARD_BUDGET, tone } from '../src/game/grid/budgetPoints';
import { BUDGET_REFRESH_MS, installBudgetOverlay } from '../src/game/grid/budgetOverlay';

const attr = (node: Element | null | undefined, name: string): string | undefined => node?.getAttribute(`data-${name}`) ?? undefined;
afterEach(() => { setDev(false); document.body.replaceChildren(); vi.useRealTimers(); });

/** A crossroads: a runtime home sim, two shardfile neighbours with libraries and tiles, the road's tiles and the commons. */
function crossroads(): ResidencyAllocator {
  const allocator = new ResidencyAllocator();
  const claim = (id: string, category: ResidencyCategory, bytes: number, owner: string): void => {
    expect(allocator.reserve({ id, category, bytes: Math.round(bytes), owner, distance: 0, needed: true })).not.toBeNull();
  };
  claim('sim:home', 'sim', 180 * MB, 'home');
  claim('library:home', 'library', 22 * MB, 'home');
  for (let i = 0; i < 6; i++) claim(`l0:home:${i}`, 'l0', (3 + i * 0.3) * MB, 'home');
  claim('far:pine', 'far', 1.2 * MB, 'pine'); claim('library:pine', 'library', 31 * MB, 'pine'); claim('sim:pine', 'sim', 24 * MB, 'pine');
  claim('l1:pine:0', 'l1', 2.5 * MB, 'pine'); claim('l0:pine:0', 'l0', 4.4 * MB, 'pine');
  claim('far:tpl', 'far', 0.9 * MB, 'tpl');
  claim('l0:road:0', 'l0', 6 * MB, PLATFORM_OWNER); claim('l1:road:0', 'l1', 3 * MB, PLATFORM_OWNER);
  claim('sim:highway', 'sim', 4 * MB, 'platform.highway');
  claim('commons:h', 'commons', 5 * MB, PLATFORM_OWNER); claim('product:edge', 'product', 12_345, 'pine');
  return allocator;
}

it('scores every allocator byte once: categories, owners and tiles sum to the cost model', () => {
  const allocator = crossroads(), entries = allocator.entries(), cost = allocator.cost();
  const points = budgetPoints({ entries, cost });
  const sum = (bytes: Readonly<Record<string, number>>): number => BUDGET_CATEGORIES.reduce((total, category) => total + (bytes[category] ?? 0), 0);
  expect(sum(points.crossroads.bytes)).toBe(cost.accounted);
  expect(points.shards.reduce((total, shard) => total + shard.total, 0)).toBe(cost.accounted);
  // the road is the platform's tiles; every other category is the allocator's own
  expect(points.crossroads.bytes.road).toBe(9 * MB);
  expect(points.crossroads.bytes.l0 + points.crossroads.bytes.road + points.crossroads.bytes.l1).toBe(cost.input.l0 + cost.input.l1);
  expect(points.crossroads.bytes.library).toBe(cost.input.libraries);
  expect(points.crossroads.bytes.sim).toBe(cost.input.sims);
  expect(points.crossroads.bytes.far).toBe(cost.input.far);
  expect(points.crossroads.bytes.commons).toBe(cost.input.commons);
  expect(points.crossroads.playing).toBe(cost.playing);
  expect(points.crossroads.points).toBe(Math.round((cost.playing / C.playing) * 100));
  // per shard: Pine's ~63 MB against one of four shards' budget; the platform has no byte budget
  const pine = points.shards.find((shard) => shard.owner === 'pine');
  expect(pine?.total).toBe(Math.round(1.2 * MB) + 31 * MB + 24 * MB + Math.round(2.5 * MB) + Math.round(4.4 * MB) + 12_345);
  expect(pine?.points).toBe(Math.round((pine?.total ?? 0) / SHARD_BUDGET * 100));
  expect(points.shards.at(-1)?.owner).toBe(PLATFORM_OWNER);
  expect(points.shards.at(-1)?.points).toBeNull();
  // tiles: Pine's 4.4 MB L0 is over its 4 MB cap (red); the home's 3.9 MB one is amber (98), its 3 MB one green (75)
  const tile = (id: string) => points.tiles.find((t) => t.id === id);
  expect(tile('l0:pine:0')).toMatchObject({ points: 110, tone: 'red' });
  expect(tile('l0:home:0')).toMatchObject({ points: 75, tone: 'green' });
  expect(tile('l0:home:3')).toMatchObject({ points: 98, tone: 'amber' });
  expect(points.tiles.some((t) => t.owner === PLATFORM_OWNER)).toBe(false);
  expect([tone(79), tone(80), tone(100), tone(101)]).toEqual(['green', 'amber', 'amber', 'red']);
});

it("shows only in Developer mode, and its numbers are the live allocator's", () => {
  vi.useFakeTimers();
  const root = document.createElement('div'); document.body.append(root);
  const scope = app.engineScope.child('test.grid-budget');
  const allocator = crossroads();
  setDev(false);
  const overlay = installBudgetOverlay({ scope, hudRoot: root, allocator, name: (owner) => ({ home: 'Driftwood Isle', pine: 'Pine Hollow', tpl: 'Template' })[owner] ?? owner,
    measuredMB: (owner) => (owner === 'home' ? 868 : null), shard: (owner) => ['home', 'pine', 'tpl'].includes(owner) });
  // off: nothing built, no timer
  expect(root.querySelector('.ws-grid-budget')).toBeNull();
  expect(overlay.state()).toBeNull();
  setDev(true);
  const strip = root.querySelector<HTMLElement>('.ws-grid-budget');
  expect(strip?.hidden).toBe(false);
  const cost = allocator.cost(), head = strip?.querySelector<HTMLElement>('.ws-grid-budget-x');
  expect(Number(attr(head, 'playing'))).toBe(cost.playing);
  expect(Number(attr(head, 'accounted'))).toBe(cost.accounted);
  expect(head?.textContent).toBe(`XROADS ${Math.round(cost.playing / C.playing * 100)} · ${(Math.round(cost.playing / 1e5) / 10).toFixed(1)}/1000.0 MB`);
  // one chip per owner, its bytes the owner's entries summed straight from the allocator's table
  const owned = new Map<string, number>();
  for (const entry of allocator.entries()) owned.set(entry.owner, (owned.get(entry.owner) ?? 0) + entry.bytes);
  const chips = [...(strip?.querySelectorAll<HTMLElement>('.ws-grid-budget-chip[data-owner]') ?? [])];
  expect(new Map(chips.map((chip) => [attr(chip, 'owner'), Number(attr(chip, 'bytes'))]))).toEqual(owned);
  expect(chips.map((chip) => chip.textContent.split(' ')[0])).toEqual(['DRIFTWOOD', 'PINE', 'TEMPLATE', 'ROAD', 'PLATFORM.HIGHWAY']);
  expect(chips.map((chip) => attr(chip, 'tone'))).toEqual(['red', 'green', 'green', 'none', 'none']);
  // collapsed, only the warned shards show by name; the rest are counted (2 green shards, the page-wide owners' MB)
  expect(chips.map((chip) => chip.hidden)).toEqual([false, true, true, true, true]);
  expect(strip?.querySelector('.ws-grid-budget-bar')?.textContent).toContain('2 OKPLATFORM 18.0');
  // the tap expands the raw bytes per category: the crossroads' section equals the cost model's input
  strip?.click();
  const category = (name: string): number => Number(attr(strip?.querySelector<HTMLElement>(`.ws-grid-budget-sec [data-category="${name}"]`), 'bytes'));
  expect(category('library')).toBe(cost.input.libraries);
  expect(category('sim')).toBe(cost.input.sims);
  expect(category('far')).toBe(cost.input.far);
  expect(category('l0') + category('l1') + category('road')).toBe(cost.input.l0 + cost.input.l1);
  expect(strip?.textContent).toContain('MEASURED868.0 MB');
  expect(strip?.textContent).toContain('OVERLAP80.0 MB');
  // live: a new claim shows at the next tick; an untouched table repaints nothing
  const before = strip?.querySelector('.ws-grid-budget-x');
  vi.advanceTimersByTime(BUDGET_REFRESH_MS);
  expect(strip?.querySelector('.ws-grid-budget-x')).toBe(before);
  allocator.reserve({ id: 'far:new', category: 'far', bytes: MB, owner: 'tpl', distance: 0, needed: true });
  vi.advanceTimersByTime(BUDGET_REFRESH_MS);
  expect(Number(attr(strip?.querySelector<HTMLElement>('.ws-grid-budget-x'), 'accounted'))).toBe(allocator.cost().accounted);
  expect(overlay.state()?.crossroads.accounted).toBe(allocator.cost().accounted);
  // off again: hidden, the timer stops (no repaint after a change)
  setDev(false);
  expect(strip?.hidden).toBe(true);
  allocator.reserve({ id: 'far:later', category: 'far', bytes: MB, owner: 'tpl', distance: 0, needed: true });
  vi.advanceTimersByTime(BUDGET_REFRESH_MS * 3);
  expect(overlay.state()?.crossroads.accounted).not.toBe(allocator.cost().accounted);
  scope.dispose();
  expect(root.children).toHaveLength(0);
});
