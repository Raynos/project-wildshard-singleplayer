import { Scope } from '#engine/app/scope';
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { hudSlots } from '#engine/ui/hudSlots';

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
