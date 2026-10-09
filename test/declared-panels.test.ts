// @vitest-environment happy-dom
// SF28: every shard panel converted to a declared panel builds exactly the markup its hand-built predecessor built.
// Each `reference*` below is the replaced shard code, kept here verbatim as the oracle (tests may build DOM).
import { afterEach, describe, expect, it } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { declarePanel } from '../src/engine/ui/panel';
import { BoardPanel, CountChip, rewardLine } from '../src/shards/pine-hollow/quest/ui';
import { isFilled, newBoard, type Board } from '../src/shards/pine-hollow/quest/contracts';

afterEach(() => { document.body.innerHTML = ''; });
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; parent?.append(e); return e;
};

describe('the declared panel builder', () => {
  it('builds tags, classes, data, input properties, attributes, style and text in the hand-built order', () => {
    const view = declarePanel({ cls: 'a', data: { state: 'none' }, children: [
      { tag: 'input', cls: 'f', input: { type: 'text', maxLength: 5, value: 'Bo', autocomplete: 'off', spellcheck: false }, attrs: [['aria-label', 'Name']], ref: 'f' },
      { tag: 'span', style: { zIndex: '3', color: '#fff' }, props: [['--k', '1']], text: 'x', ref: 's' },
    ] });
    const ref = document.createElement('div'); ref.className = 'a'; ref.dataset['state'] = 'none';
    const f = document.createElement('input'); f.className = 'f'; f.type = 'text'; f.maxLength = 5; f.value = 'Bo'; f.autocomplete = 'off'; f.spellcheck = false; f.setAttribute('aria-label', 'Name');
    const s = document.createElement('span'); s.style.zIndex = '3'; s.style.color = '#fff'; s.style.setProperty('--k', '1'); s.textContent = 'x';
    ref.append(f, s);
    expect(view.root.outerHTML).toBe(ref.outerHTML);
    expect(view.value('f')).toBe('Bo');
    view.fill('', [{ tag: 'b', ref: 'new' }]);
    expect(view.has('f')).toBe(false); expect(view.has('new')).toBe(true);
    expect(() => declarePanel({ children: [{ ref: 'x' }, { ref: 'x' }] })).toThrow('duplicate ref');
  });
});

/** HEAD 7faaca58d src/shards/pine-hollow/quest/ui.ts: the hand-built lodge panel and board body */
function referenceBoard(b: Board): HTMLElement {
  const root = el('div', 'ws-ph-panel ws-ph-board');
  const frame = el('div', 'ws-ph-frame', root);
  const head = el('div', 'ws-ph-head', frame);
  el('div', 'ws-ph-kicker', head, 'The hunting lodge');
  el('div', 'ws-ph-title', head, 'Contracts');
  const body = el('div', 'ws-ph-body', frame);
  const close = el('button', 'ws-ph-close', root, 'Close'); close.type = 'button';
  const tally = el('div', 'ws-ph-tally', body);
  el('span', '', tally, `Claimed ${b.claimed}`); el('span', '', tally, `In a row ${b.streak}`); el('span', '', tally, `Best ${b.best}`);
  b.slots.forEach((c, i) => {
    const card = el('div', `ws-ph-note${isFilled(c) ? ' filled' : ''}`, body);
    card.style.setProperty('--tilt', `${[-1.2, 0.8, -0.5][i] ?? 0}deg`);
    el('i', 'ws-ph-pin', card);
    el('div', 'ws-ph-note-kind', card, c.kind === 'species' ? 'Game' : c.kind === 'rarity' ? 'Rare coat' : c.kind === 'elite' ? 'Wanted' : 'Cull');
    el('div', 'ws-ph-note-title', card, c.title);
    el('div', 'ws-ph-note-goal', card, c.goal);
    const bar = el('div', 'ws-ph-note-bar', card);
    for (let k = 0; k < c.need; k++) el('i', k < c.have ? 'on' : '', bar);
    el('b', 'ws-ph-note-count', bar, `${c.have} / ${c.need}`);
    el('div', 'ws-ph-note-pay', card, `Pays ${rewardLine(c)}`);
    const row = el('div', 'ws-ph-note-row', card);
    if (isFilled(c)) { const claim = el('button', 'ws-ph-seal', row, 'Claim'); claim.type = 'button'; }
    const tear = el('button', 'ws-ph-tear', row, 'Tear down'); tear.type = 'button';
  });
  el('div', 'ws-ph-foot', body, 'A filled notice is claimed here. Tearing one down posts the next and ends your run.');
  return root;
}

describe('Pine Hollow lodge panels', () => {
  it('the contract board is the hand-built board, closed and open, filled and empty', () => {
    document.body.innerHTML = '<div id="hud"></div>';
    const b = newBoard(), scope = new Scope('board'), board = new BoardPanel(() => b, scope);
    let claimed = -1; board.onClaim = (i) => { claimed = i; };
    board.render();
    expect(board.root.outerHTML).toBe(referenceBoard(b).outerHTML);
    const first = b.slots[0];
    if (first === undefined) throw new Error('no slot');
    first.have = first.need; b.claimed = 2; b.streak = 1; b.best = 4;
    board.open();
    const open = referenceBoard(b); open.classList.add('show');
    expect(board.root.outerHTML).toBe(open.outerHTML);
    expect(board.root.parentElement?.id).toBe('hud');
    board.root.querySelector('button.ws-ph-seal')?.dispatchEvent(new MouseEvent('click'));
    expect(claimed).toBe(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
    expect(board.isOpen).toBe(false); expect(board.root.classList.contains('show')).toBe(false);
    scope.dispose(); expect(board.root.isConnected).toBe(false);
  });
  it('the resin chip is the hand-built chip', () => {
    document.body.innerHTML = '<div id="hud"></div>';
    const scope = new Scope('count'), chip = new CountChip(scope);
    const ref = el('div', 'ws-ph-count'); el('span', 'ws-ph-count-label', ref); el('b', 'ws-ph-count-n', ref);
    expect(chip.root.outerHTML).toBe(ref.outerHTML);
    chip.show('Amber resin', 30, 30);
    const shown = ref.cloneNode(true);
    if (!(shown instanceof HTMLElement)) throw new Error('clone');
    const [label, n] = shown.children;
    if (label === undefined || n === undefined) throw new Error('chip children');
    label.textContent = 'Amber resin'; n.textContent = '30 / 30'; shown.classList.add('show'); shown.classList.toggle('full', true);
    expect(chip.root.outerHTML).toBe(shown.outerHTML);
    scope.dispose(); expect(chip.root.isConnected).toBe(false);
  });
});
