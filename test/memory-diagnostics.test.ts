// @vitest-environment happy-dom
import { afterEach, expect, test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import { setDev } from '../src/engine/core/devMode';
import { contentCost, type ContentCostInput } from '../src/format/contentCost';
import { MemoryAdmission } from '../src/format/product';
import { installBudgetOverlay } from '../src/game/grid/budgetOverlay';
import { installMemoryWarning } from '../src/game/grid/memoryWarning';

const scopes: Scope[] = [];
const owner = (): Scope => { const scope = new Scope('memory-diagnostics'); scopes.push(scope); return scope; };
afterEach(() => { for (const scope of scopes.splice(0)) scope.dispose(); setDev(false); document.body.replaceChildren(); });

test('the collapsed percentage and MB pair use the same per-shard playing limit', () => {
  setDev(true);
  const scope = owner(), hud = document.createElement('div'), bytes = 321_621_621;
  document.body.append(hud);
  const input: ContentCostInput = { l0: 0, l1: 0, far: 0, libraries: 0, sims: bytes, commons: 0, overlap: 80_000_000 };
  const overlay = withOwner(scope, () => installBudgetOverlay({ scope, hudRoot: hud, name: () => 'DRIFTWOOD ISLE',
    allocator: { entries: () => [{ id: 'sim:dw', category: 'sim', bytes, owner: 'dw', distance: 0, needed: true, refs: 1, holds: 0, accountedBytes: bytes }],
      cost: () => ({ ...contentCost(input), input }) } }));
  expect(hud.querySelector('[data-owner="dw"]')?.textContent).toBe('DRIFTWOOD ISLE 61% OF LIMIT · 737 / 1200 MB');
  expect(overlay.state()?.shards[0]?.points).not.toBe(61);
  expect(overlay.state()?.shards[0]?.tone).toBe('red');
  expect(hud.querySelector<HTMLElement>('[data-owner="dw"]')?.dataset['tone']).toBe('amber');
});

test('cold neighbour estimates stay in history while HUD warnings follow the entered owner', () => {
  setDev(true);
  const scope = owner(), memory = new MemoryAdmission(() => true), hud = document.createElement('div');
  document.body.append(hud); scope.onDispose(() => { memory.dispose(); });
  memory.accept({ stage: 'actual', owner: 'nine', id: 'nine:estimate', claimedBytes: 1, accountedBytes: 1,
    playingBytes: 1_590_900_000, loadingBytes: 1_500_000_000, playingCap: 1_200_000_000, loadingCap: 1_800_000_000 });
  const enter = withOwner(scope, () => installMemoryWarning(memory, scope, hud, 'dw'));
  expect(hud.children).toHaveLength(0);
  enter('nine');
  expect(hud.querySelector('.ws-memory-warning-chip')?.textContent).toBe('MEMORY LIMIT · nine ESTIMATE · +390.9 MB');
  enter('dw'); expect(hud.querySelector<HTMLElement>('.ws-memory-warning')?.hidden).toBe(true);
  expect(memory.reports()).toHaveLength(1);
  memory.accept({ stage: 'resident', owner: 'pine', id: 'pine:resident', claimedBytes: 1, accountedBytes: 1,
    playingBytes: 1_250_000_000, loadingBytes: 1_500_000_000, playingCap: 1_200_000_000, loadingCap: 1_800_000_000 });
  expect(hud.querySelector('.ws-memory-warning-chip')?.textContent).toBe('MEMORY LIMIT · pine RESIDENT · +50.0 MB');
  expect(hud.querySelectorAll('.ws-memory-warning-report')).toHaveLength(1);
  enter(null); expect(hud.querySelector<HTMLElement>('.ws-memory-warning')?.hidden).toBe(false);
  setDev(false); expect(hud.querySelector<HTMLElement>('.ws-memory-warning')?.hidden).toBe(true);
  scope.dispose(); enter('nine'); expect(hud.children).toHaveLength(0);
});
