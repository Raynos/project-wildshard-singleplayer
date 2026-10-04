import { Scope } from '../../src/engine/app/scope';
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { HudSlots, hudSlots } from '../../src/engine/ui/hudSlots';

describe('scoped HUD placement before touch controls mount', () => {
  it('does not resurrect disposed rows, discs or layer callbacks from a parked snapshot', () => {
    const original = hudSlots.snapshot();
    try {
      hudSlots.restore({ layer: null, status: null, pending: [] });
      const row = document.createElement('div'); hudSlots.statusRow(row, 3);
      const disc = hudSlots.disc({ cls: 'fixture', icon: '', label: 'Fixture', spot: 'up0' }, new Scope('disc'));
      let calls = 0; const cancel = hudSlots.onLayer(() => { calls++; });
      const parked = hudSlots.snapshot();
      hudSlots.discard(row); hudSlots.discard(disc); cancel();
      expect(hudSlots.snapshot().pending).toHaveLength(0);
      hudSlots.restore(parked);
      const layer = document.createElement('div'), status = document.createElement('div');
      hudSlots.mount(layer, status);
      expect(layer.children).toHaveLength(0); expect(status.children).toHaveLength(0); expect(calls).toBe(0);
      const live = hudSlots.disc({ cls: 'live', icon: '', label: 'Live', spot: 'aim' }, new Scope('live'));
      expect(layer.contains(live)).toBe(true); hudSlots.discard(live); expect(layer.contains(live)).toBe(false);
    } finally { hudSlots.restore(original); }
  });
});


it('preserves default row classes/order and restores manifest band order for residents', () => {
  const slots = new HudSlots(), scope = new Scope('level');
  const base = document.createElement('div'), content = document.createElement('div');
  const layer = document.createElement('div'), status = document.createElement('div'); slots.mount(layer, status);
  slots.widget('band.2', base, 0, scope); slots.widget('band.3', content, 2, scope);
  expect(base.classList.contains('ws-touch-row')).toBe(false); expect(base.style.order).toBe('0');
  expect(content.classList.contains('ws-touch-row')).toBe(true); expect(content.style.order).toBe('2');
  slots.configure(['band.1', 'band.3', 'band.2']); expect(Number(content.style.order)).toBeLessThan(Number(base.style.order));
  const parked = slots.snapshot(); slots.configure(); slots.restore(parked);
  const extra = document.createElement('div'); slots.widget('band.3', extra, 3, scope);
  expect(Number(extra.style.order)).toBeLessThan(Number(base.style.order));
  scope.dispose(); expect(status.childElementCount).toBe(0);
});
