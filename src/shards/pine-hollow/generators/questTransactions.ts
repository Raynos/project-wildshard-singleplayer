import { CONTRACT_ROWS } from '../data/contractRows';
import { TRADES } from '../data/trades';
import { WEAPON_FINISHES } from '../data/weaponFinishes';
import type { QuestPageInteractionsData } from '@wildshard/format/questInteractions';

type BorrowedCall = NonNullable<NonNullable<QuestPageInteractionsData['bindings']>['calls']>[number];

/** Finite authored payouts. The native board and shop decide whether a transaction is accepted. */
export const PINE_QUEST_TRANSACTIONS = {
  actions: [
    ...CONTRACT_ROWS.map(row => ({ id: row.id, after: [
      ...row.reward.items.map((_item, i) => ({ kind: 'call' as const, target: `${row.id}.item.${i}` })),
      ...(row.reward.bolts > 0 ? [{ kind: 'call' as const, target: `${row.id}.bolts` }] : []),
    ] })),
    { id: 'contract.finish', after: [
      { kind: 'call', target: 'finish.hollow-ash.own' }, { kind: 'call', target: 'finish.hollow-ash.wear' },
      { kind: 'toast', text: `${WEAPON_FINISHES['hollow-ash'].name} crossbow finish — ${WEAPON_FINISHES['hollow-ash'].blurb}` },
    ] },
    { id: 'contract.claimed', after: [{ kind: 'call', target: 'contract.chest' }, { kind: 'call', target: 'contract.pickup' }] },
    ...TRADES.map(row => ({ id: `trade.${row.id}`, after: [
      ...row.give.map((_item, i) => ({ kind: 'call' as const, target: `trade.${row.id}.cost.${i}` })),
      ...('skin' in row.get
        ? [{ kind: 'call' as const, target: `finish.${row.get.skin}.own` }, { kind: 'call' as const, target: `finish.${row.get.skin}.wear` }]
        : [{ kind: 'call' as const, target: `trade.${row.id}.ammo` }]),
      { kind: 'call' as const, target: 'trade.bark' }, { kind: 'call' as const, target: 'trade.chime' },
      { kind: 'toast' as const, text: `Traded · ${row.label}` },
    ] })),
  ],
  bindings: { calls: [
    ...CONTRACT_ROWS.flatMap(row => row.reward.items.map((item, i): BorrowedCall =>
      ({ target: `${row.id}.item.${i}`, owner: 'inventory', path: ['add'], args: [item.id, item.n] })).concat(
      row.reward.bolts > 0 ? [{ target: `${row.id}.bolts`, owner: 'crossbow', path: ['addBolts'], args: [row.reward.bolts] }] : [])),
    ...TRADES.flatMap(row => row.give.map((item, i): BorrowedCall =>
      ({ target: `trade.${row.id}.cost.${i}`, owner: 'inventory', path: ['take'], args: [item.item, item.n] })).concat(
      'bolts' in row.get ? [{ target: `trade.${row.id}.ammo`, owner: 'crossbow', path: ['addBolts'], args: [row.get.bolts] }]
        : 'ammo' in row.get ? [{ target: `trade.${row.id}.ammo`, owner: 'ammo', path: ['add'], optional: true, args: [row.get.ammo, row.get.n] }] : [])),
    ...(['hollow-ash', 'scarback-furnace'] as const).flatMap(id => [
      { target: `finish.${id}.own`, owner: 'skins', path: ['own'], args: [id] },
      { target: `finish.${id}.wear`, owner: 'finishes', path: [id, 'wear'] },
    ]),
    { target: 'contract.chest', owner: 'sfx', path: ['interact'], args: ['chest'] },
    { target: 'contract.pickup', owner: 'music', path: ['sting'], args: ['pickup'] },
    { target: 'trade.bark', owner: 'voice', path: ['current', 'bark'], optional: true, args: ['trader', { owner: 'points', path: ['trader'] }] },
    { target: 'trade.chime', owner: 'sfx', path: ['interact'], args: ['chime'] },
  ] },
} as const;
