import { expect, it } from 'vitest';
import { PineLodge, PINE_LODGE_ACT } from '../../../src/shards/pine-hollow/runtime/lodge';
import { claim, newBoard, recordKill, reroll, ELITE_TARGETS, type Contract, type KillInfo } from '../../../src/shards/pine-hollow/quest/contracts';

const prompt = { x: -169, y: 5, z: -114 };
function setup() {
  const effects: unknown[] = [];
  const lodge = new PineLodge({ prompt, radius: 2.8, addItem: (id, n) => { effects.push(['item', id, n]); },
    addBolts: n => { effects.push(['bolts', n]); }, ownSkin: id => { effects.push(['skin', id]); }, streak: n => { effects.push(['streak', n]); } });
  return { lodge, effects };
}
function killFor(c: Contract): KillInfo {
  if (c.kind === 'elite') {
    const elite = ELITE_TARGETS[c.target]; if (elite === undefined) throw new Error('Missing authored elite');
    return { kind: elite.kind, variant: elite.variant, elite: c.target, thrall: false };
  }
  return { kind: c.kind === 'species' ? c.target : 'deer', rarity: c.kind === 'rarity' ? c.target : 'common', elite: null, thrall: c.kind === 'thrall' };
}
const compact = (b: ReturnType<typeof newBoard>) => ({ next: b.next, slots: b.slots.map(c => ({ serial: c.serial, kind: c.kind, target: c.target, have: c.have })),
  claimed: b.claimed, streak: b.streak, best: b.best });

it('matches the real page contract draws, overlapping kills and reward order through 5000 claims/tears and restores', () => {
  const { lodge, effects } = setup(), page = newBoard();
  lodge.use(PINE_LODGE_ACT.claim0, prompt); expect(effects).toEqual([]);
  lodge.use(PINE_LODGE_ACT.open, { ...prompt, x: prompt.x + 2.8 }); expect(lodge.active).toBe(false);
  lodge.use(PINE_LODGE_ACT.open, prompt); expect(lodge.active).toBe(true);
  const expected: unknown[] = [];
  for (let i = 0; i < 5000; i++) {
    const slot = i % 3, c = page.slots[slot]; if (c === undefined) throw new Error('Missing contract slot');
    const kill = killFor(c);
    for (let n = 0; n < c.need; n++) { recordKill(page, kill); lodge.killed(kill); }
    if (i % 7 === 0) { reroll(page, slot); lodge.use(PINE_LODGE_ACT.tear0 + slot, prompt); }
    else {
      const reward = claim(page, slot); if (reward === null) throw new Error('Unfilled oracle contract');
      for (const item of reward.items) expected.push(['item', item.id, item.n]);
      if (reward.bolts > 0) expected.push(['bolts', reward.bolts]);
      if (reward.skin !== undefined) expected.push(['skin', reward.skin]);
      expected.push(['streak', page.streak]); lodge.use(PINE_LODGE_ACT.claim0 + slot, prompt);
    }
    expect(lodge.snapshot().board).toEqual(compact(page));
    if (i % 113 === 0) { const before = effects.length; lodge.restore(lodge.snapshot()); expect(effects).toHaveLength(before); }
  }
  expect(effects).toEqual(expected);
  expect(effects.filter(e => JSON.stringify(e) === JSON.stringify(['skin', 'hollow-ash']))).toHaveLength(1);
  lodge.use(PINE_LODGE_ACT.close, prompt); const before = lodge.snapshot();
  lodge.use(PINE_LODGE_ACT.tear0, prompt); expect(lodge.snapshot()).toEqual(before);
});

it('refuses corrupt authored rows and counters before changing state or replaying any reward', () => {
  const { lodge, effects } = setup(); lodge.use(PINE_LODGE_ACT.open, prompt);
  const initial = lodge.snapshot();
  const bad = [
    { ...initial, version: 2 },
    { ...initial, extra: true },
    { ...initial, board: { ...initial.board, slots: initial.board.slots.slice(1) } },
    { ...initial, board: { ...initial.board, next: Number.NaN } },
    { ...initial, board: { ...initial.board, next: 2 } },
    { ...initial, board: { ...initial.board, streak: 1 } },
    { ...initial, board: { ...initial.board, claimed: 1 } },
    { ...initial, board: { ...initial.board, slots: initial.board.slots.map((slot, i) => i === 0 ? { ...slot, target: 'invented' } : slot) } },
    { ...initial, board: { ...initial.board, slots: initial.board.slots.map((slot, i) => i === 0 ? { ...slot, have: 4 } : slot) } },
    { ...initial, board: { ...initial.board, slots: initial.board.slots.map(slot => ({ ...slot, serial: 0 })) } },
  ];
  for (const value of bad) { expect(() => lodge.restore(value)).toThrow(); expect(lodge.snapshot()).toEqual(initial); expect(effects).toEqual([]); }
});
