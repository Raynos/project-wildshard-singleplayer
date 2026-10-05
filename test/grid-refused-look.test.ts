// SF58 (12), G167: what a shard that can't load shows. In the grid its cell is dressed per (refusal, far view): B, the far
// view frozen grey under a static dome; A (no far view), the void and the SHARD UNAVAILABLE sign; nothing for a cell that
// loads. In SHARD SELECT its card is dimmed with an amber UNAVAILABLE badge and the reason, and cannot be entered.
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { Group, Mesh } from 'three';
import { Scope } from '../src/engine/app/scope';
import type { GridCell } from '../src/game/grid/assembly';
import type { FarViewStatus, ShardRefusal } from '../src/game/grid/refusal';
import { installRefusedLook } from '../src/game/grid/refusedLook';
import { buildTitleDeck, titleCards } from '../src/game/titleDeck';

const home: GridCell = { instance: 'driftwood-isle', slug: 'driftwood-isle', cell: [0, 0], origin: { x: 0, y: 0, z: 0 } };
const pine: GridCell = { instance: 'pine-hollow', slug: 'pine-hollow', cell: [1, 0], origin: { x: 560, y: 0, z: 0 } };

function rig() {
  const root = new Group(); root.position.set(560, 0, 0);
  const state: { refusal: ShardRefusal | null; far: FarViewStatus } = { refusal: null, far: 'loading' }, greys: [string, boolean][] = [];
  const scope = new Scope('refused-look-test');
  const look = installRefusedLook({ home, scope, cells: [{ cell: pine, name: 'Pine Hollow', root }],
    ports: { refusal: () => state.refusal, far: () => state.far, feet: () => ({ x: 0, z: 0 }), grey: (id, on) => { greys.push([id, on]); } } });
  const names = (): string[] => { const out: string[] = []; root.traverse((node) => { if (node instanceof Mesh) out.push(node.name); }); return out.sort(); };
  return { root, state, greys, scope, look, names };
}

describe('G167: the refused cell in the grid', () => {
  it('a cell that loads is never dressed and nothing is built', () => {
    const r = rig(); r.state.far = 'resident';
    for (let k = 0; k < 5; k++) r.look.step();
    expect(r.names()).toEqual([]); expect(r.greys).toEqual([]); expect(r.look.state().cells).toEqual([]);
    r.scope.dispose();
  });
  it('B: a refused shard with a drawn far view freezes it grey under one static dome', () => {
    const r = rig(); r.state.refusal = 'too-big'; r.state.far = 'resident';
    r.look.step(); r.look.step();
    expect(r.names()).toEqual(['grid-refused-dome']);
    expect(r.greys).toEqual([['pine-hollow', true]]); // once, not per step
    expect(r.look.state().cells).toEqual([{ instance: 'pine-hollow', look: 'frozen', refusal: 'too-big' }]);
    r.scope.dispose();
    expect(r.names()).toEqual([]); expect(r.greys.at(-1)).toEqual(['pine-hollow', false]);
  });
  it('A: with no far view, the void and the SHARD UNAVAILABLE sign, turned toward the traveller; a far view arriving turns it into B', () => {
    const r = rig(); r.state.refusal = 'safety'; r.state.far = 'none';
    r.look.step();
    expect(r.names()).toEqual(['grid-refused-sign', 'grid-refused-void']);
    let sign: Mesh | undefined; r.root.traverse((node) => { if (node instanceof Mesh && node.name === 'grid-refused-sign') sign = node; });
    expect(sign?.rotation.y).toBeCloseTo(Math.atan2(0 - 560, 0)); // faces the road at the home side
    expect(r.greys).toEqual([]);
    r.state.far = 'resident'; r.look.step();
    expect(r.names()).toEqual(['grid-refused-dome']); expect(r.greys).toEqual([['pine-hollow', true]]);
    r.state.refusal = null; r.look.step(); // a retry that admits undresses it
    expect(r.names()).toEqual([]); expect(r.greys.at(-1)).toEqual(['pine-hollow', false]);
    r.scope.dispose();
  });
  it('a new reason rebuilds the sign once', () => {
    const r = rig(); r.state.refusal = 'safety'; r.state.far = 'none';
    r.look.step(); r.state.refusal = 'load'; r.look.step();
    expect(r.look.state().cells).toEqual([{ instance: 'pine-hollow', look: 'void', refusal: 'load' }]);
    expect(r.names()).toEqual(['grid-refused-sign', 'grid-refused-void']);
    r.scope.dispose();
  });
});

describe('G167: the UNAVAILABLE card in SHARD SELECT', () => {
  it('is dimmed, badged UNAVAILABLE, shows the reason, keeps the save and cannot be entered', () => {
    const cards = titleCards(false, () => null, (slug) => (slug === 'driftwood-isle' ? 'too-big' : null));
    expect(cards.find((card) => card.slug === 'driftwood-isle')?.unavailable).toBe('too-big');
    const onEnter = vi.fn<() => void>();
    const deck = buildTitleDeck({ cards, active: null, onEnter, onExplore: () => undefined, onSettings: () => undefined });
    const index = deck.cards.findIndex((card) => card.slug === 'driftwood-isle');
    deck.select(index, false);
    const card = deck.root.querySelectorAll<HTMLElement>('.ws-menu-card')[index];
    expect(card?.classList.contains('ws-menu-card-upgrade')).toBe(true); // the G86 dimming
    expect(card?.classList.contains('ws-menu-card-unavailable')).toBe(true);
    expect(card?.querySelector('.ws-menu-card-needs')?.textContent).toBe('UNAVAILABLE');
    expect(card?.querySelector('small')?.textContent).toBe('TOO BIG FOR THIS DEVICE');
    const play = deck.root.querySelector<HTMLButtonElement>('.ws-menu-play');
    expect(play?.disabled).toBe(true);
    expect(play?.querySelector('b')?.textContent).toBe('UNAVAILABLE');
    expect(play?.querySelector('small')?.textContent).toBe('YOUR SAVE IS KEPT');
    deck.activate(); expect(onEnter).not.toHaveBeenCalled();
    deck.dispose();
  });
  it('G86\'s NEEDS UPGRADE card wins over a session refusal, and other shards stay enterable', () => {
    const cards = titleCards(false, (slug) => (slug === 'driftwood-isle' ? 0 : null), () => 'safety');
    expect(cards.find((card) => card.slug === 'driftwood-isle')?.unavailable).toBeUndefined();
    expect(titleCards(false, () => null, () => null).every((card) => card.unavailable === undefined)).toBe(true);
  });
});
