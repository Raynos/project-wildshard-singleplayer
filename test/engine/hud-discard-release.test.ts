// @vitest-environment happy-dom
// SF57 (E435): a page-scoped HUD adapter serves every resident shard; discarding a resident's disc must release what it
// registered on the page scope (its listeners and the press closure over the shard's world), not only remove the node.
import { expect, it } from 'vitest';
import { HudSlots } from '../../src/engine/ui/hudSlots';
import { Scope } from '../../src/engine/app/scope';

it('discard releases a disc\'s, pill\'s and widget\'s page-scope listeners and node holds, visit after visit', () => {
  const page = new Scope('page'), slots = new HudSlots();
  const before = page.census;
  for (let visit = 0; visit < 3; visit++) {
    const world = { big: new Float32Array(1024) };
    const disc = slots.disc({ cls: 'x', icon: '', label: 'Crouch', spot: 'up0', press: () => { world.big[0] = 1; } }, page);
    const pill = document.createElement('div'); slots.pill(pill, () => { world.big[1] = 1; }, page);
    const widget = document.createElement('div'); slots.widget('band.1', widget, 0, page);
    expect(page.census.listeners).toBeGreaterThan(before.listeners);
    slots.discard(disc); slots.discard(pill); slots.discard(widget);
    expect(page.census).toEqual(before);
  }
  page.dispose();
});
