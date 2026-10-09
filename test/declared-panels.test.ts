// @vitest-environment happy-dom
// SF28: every shard panel converted to a declared panel builds exactly the markup its hand-built predecessor built.
// Each `reference*` below is the replaced shard code, kept here verbatim as the oracle (tests may build DOM).
import { afterEach, describe, expect, it } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { declarePanel, type PanelSvg } from '../src/engine/ui/panel';
import { BoardPanel, CountChip, rewardLine } from '../src/shards/pine-hollow/quest/ui';
import { isFilled, newBoard, type Board } from '../src/shards/pine-hollow/quest/contracts';
import { ALERT, EYE_HALF, EYE_OPEN, EYE_SHUT, STEALTH_GRASS_ROW, STEALTH_LAYER, STEALTH_ROW } from '../src/shards/nalati-grasslands/stealth';
import { nameBox } from '../src/shards/nalati-grasslands/ride/HorseNamePrompt';
import { HORSE_NAME_MAX } from '../src/shards/nalati-grasslands/ride/horseNames';
import { PORTAL_VEIL } from '../src/shards/nine-dragon-stack/world/portalVeil';

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

/** strip the whitespace-only text nodes an HTML template leaves between absolutely placed children (they draw nothing) */
const tight = (root: Element): Element => {
  for (const n of Array.from(root.childNodes)) if (n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() === '') n.remove(); else if (n instanceof Element) tight(n);
  return root;
};

describe('Nalati panels', () => {
  it('the stealth layer, its status rows and the eye icons are the hand-built markup', () => {
    // HEAD 7faaca58d src/shards/nalati-grasslands/stealth.ts
    const root = document.createElement('div'); root.className = 'ws-stealth';
    root.innerHTML = `<div class="ws-stealth-vig"></div>
      <div class="ws-stealth-pip"><i class="ws-stealth-eye"></i><span class="ws-stealth-label"></span></div>
      <div class="ws-stealth-chev"></div>
      <div class="ws-stealth-grass"><span>Grass</span><b><i></i></b></div>
      <div class="ws-stealth-hint"></div>`;
    const hint = root.querySelector('.ws-stealth-hint'); if (hint) hint.textContent = 'Tall grass · C crouch';
    expect(declarePanel(STEALTH_LAYER).root.isEqualNode(tight(root))).toBe(true);
    const row = document.createElement('div'); row.className = 'ws-stealth-row'; row.dataset['state'] = 'none';
    row.innerHTML = '<i class="ws-stealth-eye"></i><span class="ws-stealth-label"></span>';
    expect(declarePanel(STEALTH_ROW).root.isEqualNode(row)).toBe(true);
    const grass = document.createElement('div'); grass.className = 'ws-stealth-grassrow'; grass.innerHTML = '<span>Grass</span><b><i></i></b>';
    expect(declarePanel(STEALTH_GRASS_ROW).root.isEqualNode(grass)).toBe(true);
    const icons: [PanelSvg, string][] = [
      [EYE_OPEN, '<svg viewBox="0 0 24 24"><path d="M1.5 12c2.8-4.6 6.3-7 10.5-7s7.7 2.4 10.5 7c-2.8 4.6-6.3 7-10.5 7S4.3 16.6 1.5 12z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3.4" fill="currentColor"/></svg>'],
      [EYE_HALF, '<svg viewBox="0 0 24 24"><path d="M1.5 12c2.8-4.6 6.3-7 10.5-7s7.7 2.4 10.5 7c-2.8 4.6-6.3 7-10.5 7S4.3 16.6 1.5 12z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 10.5h17" stroke="currentColor" stroke-width="1.7"/><path d="M8.6 10.5a3.4 3.4 0 0 0 6.8 0z" fill="currentColor"/></svg>'],
      [EYE_SHUT, '<svg viewBox="0 0 24 24"><path d="M2 10c2.9 3.6 6.2 5.4 10 5.4S19.1 13.6 22 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5.6 13.4 4 16M9.4 15 8.8 18M14.6 15l.6 3M18.4 13.4 20 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'],
      [ALERT, '<svg viewBox="0 0 24 24"><path d="M12 2.5v12.5" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><circle cx="12" cy="20.4" r="2.1" fill="currentColor"/></svg>'],
    ];
    for (const [svg, html] of icons) {
      const view = declarePanel({ tag: 'i', cls: 'ws-stealth-eye', ref: 'eye' }); view.fill('', [svg]);
      const ref = document.createElement('i'); ref.className = 'ws-stealth-eye'; ref.innerHTML = html;
      expect(view.root.isEqualNode(ref)).toBe(true);
      expect(view.root.firstElementChild?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    }
  });
  it('the horse name box is the hand-built box', () => {
    // HEAD 7faaca58d src/shards/nalati-grasslands/ride/HorseNamePrompt.ts
    const root = document.createElement('div'); root.className = 'ws-glass ws-ride-namebox';
    const cap = document.createElement('div'); cap.className = 'ws-ride-namecap'; cap.textContent = 'Name your horse';
    const input = document.createElement('input');
    input.className = 'ws-ride-nameinput'; input.type = 'text'; input.maxLength = HORSE_NAME_MAX; input.value = 'Camp horse';
    input.autocomplete = 'off'; input.spellcheck = false;
    input.setAttribute('autocapitalize', 'words'); input.setAttribute('enterkeyhint', 'done'); input.setAttribute('aria-label', 'Horse name');
    const row = document.createElement('div'); row.className = 'ws-ride-namebtns';
    const cancel = document.createElement('button'), save = document.createElement('button');
    cancel.type = 'button'; save.type = 'button'; cancel.className = 'ws-ride-namebtn'; save.className = 'ws-ride-namebtn ok';
    cancel.textContent = 'Cancel'; save.textContent = 'Save';
    row.append(cancel, save); root.append(cap, input, row);
    const view = declarePanel(nameBox('Camp horse'));
    expect(view.root.isEqualNode(root)).toBe(true);
    expect(view.value('input')).toBe('Camp horse');
  });
});

describe('Nine-Dragon panels', () => {
  it('the portal veil is the hand-built veil', () => {
    // HEAD 7faaca58d src/shards/nine-dragon-stack/world/portalVeil.ts
    const veil = document.createElement('div'); veil.className = 'nd-portal-veil';
    veil.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;display:none;z-index:60;background:radial-gradient(circle at 50% 50%,#2a1648 0%,#0a0612 70%)';
    const view = declarePanel(PORTAL_VEIL);
    expect(view.root.style.cssText).toBe(veil.style.cssText);
    expect(view.root.isEqualNode(veil)).toBe(true);
    view.style('', 'opacity', '0.500'); view.style('', 'display', 'block');
    veil.style.opacity = '0.500'; veil.style.display = 'block';
    expect(view.root.isEqualNode(veil)).toBe(true);
  });
});
