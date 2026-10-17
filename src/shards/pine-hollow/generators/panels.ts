import { parsePanelDefinition, type PanelTemplate, type PanelValue } from '@wildshard/format/panelTemplate';
import { contractCatalogue } from './contractRows';
import { itemName } from './trades';

const read = (path: string): PanelValue => ({ read: path });
const concat = (...parts: PanelValue[]): PanelValue => ({ concat: parts });
const filled = { left: read('c.have'), op: 'gte' as const, right: read('c.need') };
const rewards = Object.fromEntries(contractCatalogue().rows.map(row => {
  const parts = row.reward.items.map(item => `${item.n} ${itemName(item.id, item.n)}`);
  if (row.reward.bolts > 0) parts.push(`${row.reward.bolts} bolts`);
  return [`${row.kind}.${row.target}`, parts.join(' · ')];
}));
const boardBody: PanelTemplate[] = [
  { cls: 'ws-ph-tally', children: ['claimed', 'streak', 'best'].map((key, i) => ({ tag: 'span', cls: '', text: concat(['Claimed ', 'In a row ', 'Best '][i] ?? '', read(key)) })) },
  { repeat: { source: 'slots', as: 'c', index: 'slot' }, cls: concat('ws-ph-note', { choose: filled, yes: ' filled', no: '' }),
    props: [['--tilt', concat({ lookup: { 0: -1.2, 1: 0.8, 2: -0.5 }, key: read('slot'), fallback: 0 }, 'deg')]], children: [
      { tag: 'i', cls: 'ws-ph-pin' },
      { cls: 'ws-ph-note-kind', text: { lookup: { species: 'Game', rarity: 'Rare coat', elite: 'Wanted', thrall: 'Cull' }, key: read('c.kind'), fallback: 'Cull' } },
      { cls: 'ws-ph-note-title', text: read('c.title') }, { cls: 'ws-ph-note-goal', text: read('c.goal') },
      { cls: 'ws-ph-note-bar', children: [
        { repeat: { source: 'c.need', as: 'k' }, tag: 'i', cls: { choose: { left: read('k'), op: 'lt', right: read('c.have') }, yes: 'on', no: '' } },
        { tag: 'b', cls: 'ws-ph-note-count', text: concat(read('c.have'), ' / ', read('c.need')) },
      ] },
      { cls: 'ws-ph-note-pay', text: concat('Pays ', { lookup: rewards, key: concat(read('c.kind'), '.', read('c.target')), fallback: '' }) },
      { cls: 'ws-ph-note-row', children: [
        { when: filled, tag: 'button', cls: 'ws-ph-seal', button: 'button', text: 'Claim', ref: concat('claim.', read('slot')), action: { id: 'claim', arg: read('slot') } },
        { tag: 'button', cls: 'ws-ph-tear', button: 'button', text: 'Tear down', ref: concat('tear.', read('slot')), action: { id: 'tear', arg: read('slot') } },
      ] },
    ] },
  { cls: 'ws-ph-foot', text: 'A filled notice is claimed here. Tearing one down posts the next and ends your run.' },
];
/** Static markup, display strings and input policy; live draws and rewards remain with their existing owners. */
export const PINE_PANELS = {
  board: parsePanelDefinition({ lifetime: 'persistent', showClass: 'show', closeRef: 'close', closeKeys: ['Escape', 'KeyE'], stopEvents: ['pointerdown'],
    frame: { cls: 'ws-ph-panel ws-ph-board', children: [
      { cls: 'ws-ph-frame', children: [
        { cls: 'ws-ph-head', children: [{ cls: 'ws-ph-kicker', text: 'The hunting lodge' }, { cls: 'ws-ph-title', text: 'Contracts' }] },
        { cls: 'ws-ph-body', ref: 'body' },
      ] }, { tag: 'button', cls: 'ws-ph-close', button: 'button', text: 'Close', ref: 'close' },
    ] }, body: boardBody }),
  count: parsePanelDefinition({ lifetime: 'persistent', showClass: 'show',
    frame: { cls: 'ws-ph-count', children: [{ tag: 'span', cls: 'ws-ph-count-label', ref: 'label', text: read('label') },
      { tag: 'b', cls: 'ws-ph-count-n', ref: 'n', text: concat(read('n'), ' / ', read('of')) }] },
    transient: { milliseconds: 3600, flags: [{ cls: 'full', when: { left: read('n'), op: 'gte', right: read('of') } }] } }),
};
