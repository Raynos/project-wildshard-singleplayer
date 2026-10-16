// @vitest-environment happy-dom
import { CONTRACTS } from './fixtures/pine-contracts';
import { expect, test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { DeclaredPanel } from '../src/sdk/panels';
import { BoardPanel } from '../src/shards/pine-hollow/quest/ui';
import { claim, newBoard, reroll } from '../src/shards/pine-hollow/quest/contracts';
import { nameBox } from '../src/shards/nalati-grasslands/ride/HorseNamePrompt';
import { cleanHorseName } from '../src/shards/nalati-grasslands/ride/horseNames';

test('the persistent lodge board retains its frame, payouts, keys and scoped row listeners', () => {
  const scope = new Scope('board-lifecycle'), board = newBoard(CONTRACTS), events: string[] = [], panel = new BoardPanel(() => board, scope);
  const first = board.slots[0];
  if (first === undefined) throw new Error('Missing first contract');
  first.have = first.need;
  panel.onOpen = () => { events.push(`open:${panel.isOpen}`); };
  panel.onClose = () => { events.push(`close:${panel.isOpen}`); };
  panel.onClaim = i => { events.push(`claim:${i}`); expect(claim(CONTRACTS, board, i)).not.toBeNull(); };
  panel.onReroll = i => { events.push(`tear:${i}`); reroll(CONTRACTS, board, i); };
  try {
    const root = panel.root;
    expect(root.isConnected).toBe(true); expect(panel.isOpen).toBe(false);
    expect(root.querySelector('.ws-ph-title')?.textContent).toBe('Contracts');
    expect(root.querySelector('.ws-ph-kicker')?.textContent).toBe('The hunting lodge');
    panel.open(); panel.open();
    expect(root.classList.contains('show')).toBe(true);
    const oldClaim = panel.view.node('claim.0'); oldClaim.click(); oldClaim.click();
    expect(board.claimed).toBe(1); expect(events.filter(event => event.startsWith('claim:'))).toEqual(['claim:0']);
    const oldTear = panel.view.node('tear.0'); oldTear.click(); oldTear.click();
    expect(events.filter(event => event.startsWith('tear:'))).toEqual(['tear:0']);
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', repeat: true }));
    expect(panel.isOpen).toBe(true);
    const use = new KeyboardEvent('keydown', { code: 'KeyE', cancelable: true }); document.dispatchEvent(use);
    expect(use.defaultPrevented).toBe(true); expect(panel.isOpen).toBe(false);
    expect(root.isConnected).toBe(true); expect(root.classList.contains('show')).toBe(false);
    const content = root.textContent; panel.open(); expect(root.textContent).toBe(content);
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
    panel.open(); panel.view.node('close').click(); panel.close();
    expect(events.filter(event => event.startsWith('open:') || event.startsWith('close:')))
      .toEqual(['open:true', 'close:false', 'open:true', 'close:false', 'open:true', 'close:false']);
    panel.open(); scope.dispose(); panel.open();
    expect(panel.isOpen).toBe(false); expect(root.isConnected).toBe(false);
  } finally { scope.dispose(); }
});

test('the W3 horse-name content can borrow fresh scopes, submit keys, focus and layer ownership', () => {
  const owner = new Scope('horse-panel-lifecycle'), saves: string[] = [], layers: string[] = [];
  let current = 'Camp horse';
  const panel = new DeclaredPanel(() => nameBox(current), owner, {
    lifetime: 'open',
    bind(view, scope, close) {
      layers.push('push'); scope.onDispose(() => { layers.push('pop'); });
      const done = (save: boolean): void => {
        const name = cleanHorseName(view.value('input')); close();
        if (save && name.length > 0) saves.push(name);
      };
      view.on('', 'keydown', e => {
        e.stopPropagation();
        if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); done(true); }
        else if (e.code === 'Escape') done(false);
      }, scope);
      view.on('cancel', 'click', () => { done(false); }, scope);
      view.on('save', 'click', () => { done(true); }, scope);
    },
  });
  panel.onOpen = () => { panel.view.select('input'); };
  try {
    expect(() => panel.view).toThrow('no mounted view');
    panel.open(); const first = panel.view;
    expect(document.activeElement).toBe(first.node('input'));
    first.node('input').dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'Enter', cancelable: true }));
    expect(saves).toEqual(['Camp Horse']); expect(first.root.isConnected).toBe(false);
    expect(document.activeElement).not.toBe(first.node('input')); expect(layers).toEqual(['push', 'pop']);
    first.node('save').click(); expect(saves).toHaveLength(1);
    current = 'Second horse'; panel.open();
    expect(panel.view).not.toBe(first); expect(panel.view.value('input')).toBe(current);
    panel.view.node('cancel').click(); expect(saves).toHaveLength(1);
    panel.open(); owner.dispose();
    expect(panel.isOpen).toBe(false); expect(() => panel.view).toThrow('no mounted view');
    expect(layers).toEqual(['push', 'pop', 'push', 'pop', 'push', 'pop']);
    panel.open(); expect(panel.isOpen).toBe(false);
  } finally { owner.dispose(); }
});
