// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { app } from '../src/engine/app/runtime';
import { MemoryAttribution } from '../src/engine/core/memoryAttribution';
import { setDev } from '../src/engine/core/devMode';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { BUDGET_REFRESH_MS, installBudgetOverlay } from '../src/game/grid/budgetOverlay';
import { memoryRows } from '../src/game/grid/memoryRows';

afterEach(() => { setDev(false); vi.useRealTimers(); });

it('reconciles owner/asset storage groups and the below-threshold remainder while sorting domains', () => {
  const ledger = new MemoryAttribution(), resources = [{}, {}, {}, {}];
  for (const [i, resource] of resources.entries()) {
    ledger.label(resource, { owner: i < 2 ? 'engine/post' : 'level/forest', asset: `asset/${i}` });
    ledger.allocation(resource, i === 0 ? 'gpu' : 'ram', 'storage', [2e6, 3e6, 4e6, 200][i] ?? 0, i === 3 ? 'estimate' : 'exact');
  }
  const snapshot = ledger.snapshot(), owners = memoryRows(snapshot, 'owner', 'total');
  expect(owners.rows.map(row => row.owner)).toEqual(['engine/post', 'level/forest']);
  expect(owners.rows[1]?.estimated).toBe(200);
  const assets = memoryRows(snapshot, 'asset', 'ram');
  expect(assets.rows.map(row => row.asset)).toEqual(['asset/2', 'asset/1', 'asset/0']);
  expect(assets.omitted).toEqual({ gpu: 0, ram: 200 });
  for (const domain of ['gpu', 'ram'] as const) {
    expect(assets.rows.reduce((sum, row) => sum + row[domain], assets.omitted[domain])).toBe(snapshot.totals[domain]);
  }
});

it('extends the existing chip only when expanded, preserves budget lines, and refreshes live storage without listener growth', () => {
  vi.useFakeTimers(); const page = app.engineScope.child('test.memory-chip'), root = document.createElement('div'); document.body.append(root);
  const ledger = new MemoryAttribution(), allocator = new ResidencyAllocator(), resource = {}, unknown = {};
  ledger.label(resource, { owner: '<img src=x onerror=alert(1)>', asset: 'mesh/<script>bad</script>' });
  ledger.allocation(resource, 'gpu', 'buffer', 2e6); ledger.allocation(unknown, 'ram', 'array-buffer', 300);
  const read = vi.fn(() => ledger.snapshot(allocator.cost().accounted));
  setDev(false);
  const overlay = installBudgetOverlay({ scope: page, hudRoot: root, allocator, name: owner => owner, memory: read });
  expect(root.querySelector('.ws-grid-budget')).toBeNull(); expect(read).not.toHaveBeenCalled();
  setDev(true);
  expect(read).not.toHaveBeenCalled(); // collapsed stays the existing inexpensive accounted chip
  overlay.toggle();
  expect(root.textContent).toContain('PLAYING'); expect(root.textContent).toContain('LOAD');
  expect(root.textContent).toContain('GPU / RAM'); expect(root.textContent).toContain('NOT SAMPLED');
  expect(root.textContent).toContain('<img'); expect(root.querySelector('img')).toBeNull();
  expect(root.textContent).toContain('UNATTRIBUTED RAM STORAGE');
  const listeners = page.census.listeners;
  ledger.measurement({ webContentBytes: 900e6, labelledGpuBytes: 150e6, sampledAt: 123, source: 'native.json#pin=abc;pid=7' });
  ledger.allocation(resource, 'gpu', 'buffer', 5e6);
  vi.advanceTimersByTime(BUDGET_REFRESH_MS * 4);
  expect(page.census.listeners).toBe(listeners);
  expect(root.textContent).toContain('1050.0 MB'); expect(root.textContent).toContain('native.json#pin=abc;pid=7');
  expect(root.querySelector('[data-gpu-bytes="5000000"]')).not.toBeNull();
  const select = root.querySelector<HTMLSelectElement>('[aria-label="Group allocations"]');
  if (select === null) throw new Error('Missing group control');
  select.value = 'asset'; select.dispatchEvent(new Event('change'));
  expect(root.textContent).toContain('mesh/<script>bad</script>'); expect(root.querySelector('script')).toBeNull();
  expect(root.querySelector('.ws-grid-budget')?.getAttribute('aria-expanded')).toBe('true');
  overlay.toggle(); const reads = read.mock.calls.length;
  vi.advanceTimersByTime(BUDGET_REFRESH_MS * 3); expect(read).toHaveBeenCalledTimes(reads);
  expect(page.census.listeners).toBeLessThan(listeners);
  setDev(false); page.dispose(); root.remove();
  expect(page.census.listeners).toBe(0); expect(page.census.timers).toBe(0); expect(page.census.nodes).toBe(0);
});
