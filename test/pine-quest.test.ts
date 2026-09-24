// src/pinehollow/quest/* (PINE-HOLLOW-REMASTER PH-C1 / C6 / C8): The Warden's Hollow over the shard's flags, the
// interactables table, the `?quest=` beats, the lodge's rotating contracts + their save, the trader's swaps.
import { describe, expect, it } from 'vitest';
import { Flags } from '../src/world/interact/flags';
import { flagsRaised } from '../src/world/interact/types';
import { validateTable } from '../src/world/interact/validate';
import { QuestState, lineFor, validateQuest } from '../src/game/quest/quest';
import { ITEMS } from '../src/game/Inventory';
import { achievementsFor } from '../src/game/achievements';
import { WARDENS_HOLLOW, RANGER, MILLER, TRADER, QUEST_DONE, QUEST_EXTERNAL, ERRAND_EXTERNAL, LANTERN_FLAGS } from '../src/pinehollow/quest/wardensHollow';
import { pineTable, RESIN_COUNT, RESIN_SPOTS, TOKEN_NAMES, type TableSites } from '../src/pinehollow/quest/table';
import { BEATS, beatFlags, isBeat, type Beat } from '../src/pinehollow/quest/beats';
import {
  newBoard, draw, recordKill, claim, reroll, isFilled, counts, loadBoard, saveBoard, eliteOf, BOARD_STORE, type Board, type KillInfo,
} from '../src/pinehollow/quest/contracts';
import { TRADES, tradeState, type TradeItem } from '../src/pinehollow/quest/trades';

const SITES: TableSites = {
  resin: RESIN_SPOTS.map(([x, z]) => ({ x, z })),
  tokens: TOKEN_NAMES.map((_, i) => ({ x: i * 10, z: 5 })),
  dam: { x: -138, z: 64, fx: -0.39, fz: -0.92, ax: -0.92, az: 0.39 },
  finder: { x: 36, y: 58, z: 215 },
  bench: { x: 35, y: 57, z: 217, yaw: 0.16 },
};
const TABLE = pineTable(SITES);
const raised = new Set<string>([...TABLE.external, ...QUEST_EXTERNAL, ...ERRAND_EXTERNAL, ...TABLE.rows.flatMap(flagsRaised)]);
const mem = (): Flags => new Flags('chunk://test/pine-quest', false);

describe('the interactables table', () => {
  it('validates (unique ids, every lock has a key, every read flag is raised, items exist)', () => {
    expect(validateTable(TABLE, { items: Object.keys(ITEMS) })).toEqual([]);
  });
  it('holds 30 resin drops and 8 tokens', () => {
    expect(RESIN_COUNT).toBe(30);
    expect(TABLE.rows.filter((r) => r.kind === 'pickup' && r.look === 'resin')).toHaveLength(30);
    expect(TABLE.rows.filter((r) => r.kind === 'pickup' && r.look === 'token')).toHaveLength(8);
  });
});

describe("The Warden's Hollow", () => {
  it('validates against the table and the runtime flags', () => {
    expect(validateQuest(WARDENS_HOLLOW, raised)).toEqual([]);
  });
  it('is the seven beats in order', () => {
    expect(WARDENS_HOLLOW.steps.map((s) => s.id)).toEqual(['pond', 'ridge', 'zip', 'den', 'stag', 'king', 'dawn']);
  });
  it('walks the beats as the flags come in, completing once', () => {
    const flags = mem();
    const q = new QuestState(WARDENS_HOLLOW, flags);
    const seen: (string | null)[] = [];
    let completed = 0;
    q.onStep = (s) => { seen.push(s?.id ?? null); };
    q.onComplete = () => { completed++; };
    expect(q.isStarted).toBe(false);
    expect(q.chip().label).toBe('Find the ranger');
    flags.set('talked:ranger');
    // the pond: the dam marker until the glass is out, then the lantern's
    expect(q.markers().map((m) => m.id)).toEqual(['dam']);
    flags.set('taken:pond-glass');
    expect(q.markers().map((m) => m.id)).toEqual(['pond-lantern']);
    for (const f of ['lit:pond', 'lit:ridge', 'used:ph-zip', 'lit:den', 'followed:stag', 'dead:king', 'seen:dawn']) flags.set(f);
    expect(seen).toEqual(['pond', 'ridge', 'zip', 'den', 'stag', 'king', 'dawn', null]);
    expect(completed).toBe(1);
    expect(flags.has(QUEST_DONE)).toBe(true);
  });
  it('an early King kill is already counted when the quest gets there', () => {
    const flags = mem();
    flags.set('dead:king');
    const q = new QuestState(WARDENS_HOLLOW, flags);
    for (const f of ['talked:ranger', ...LANTERN_FLAGS, 'used:ph-zip', 'followed:stag']) flags.set(f);
    expect(q.current?.id).toBe('dawn');
  });
  it("Hale's lines follow the quest (the lanterns in any order land on the right line)", () => {
    const flags = mem();
    expect(lineFor(RANGER, flags)?.sets).toEqual(['talked:ranger']);
    flags.set('talked:ranger'); flags.set('lit:den');                 // the den lit first: still the pond's line
    expect(lineFor(RANGER, flags)?.lines[0]).toMatch(/beaver pool/);
    for (const f of ['lit:pond', 'lit:ridge', 'used:ph-zip']) flags.set(f);
    expect(lineFor(RANGER, flags)?.sets).toEqual(['wait:night']);
    flags.set(QUEST_DONE);
    expect(lineFor(RANGER, flags)?.lines[0]).toMatch(/every lantern burning/);
  });
  it('the miller asks, then thanks; the trader introduces himself once', () => {
    const flags = mem();
    expect(lineFor(MILLER, flags)?.sets).toEqual(['errand:asked']);
    flags.set('errand:asked'); flags.set('errand:done');
    expect(lineFor(MILLER, flags)?.sets).toEqual(['errand:thanked']);
    expect(lineFor(TRADER, flags)?.sets).toEqual(['talked:trader']);
    flags.set('talked:trader');
    expect(lineFor(TRADER, flags)?.sets).toBeUndefined();
  });
});

describe('?quest= beats', () => {
  const at = (b: Beat): string | null => {
    const flags = mem();
    for (const f of beatFlags(b)) flags.set(f);
    const q = new QuestState(WARDENS_HOLLOW, flags);
    return q.isComplete ? 'complete' : q.current?.id ?? 'intro';
  };
  it('every beat starts the quest exactly there', () => {
    expect(at('ranger')).toBe('intro');
    for (const b of ['pond', 'ridge', 'zip', 'den', 'stag', 'king', 'dawn'] as const) expect(at(b)).toBe(b);
    expect(at('done')).toBe('complete');
    expect(at('hamlet')).toBe('intro');
  });
  it('knows its names; the night beats are at night', () => {
    expect(isBeat('king')).toBe(true);
    expect(isBeat('nope')).toBe(false);
    expect(BEATS.stag.night).toBe(true);
    expect(BEATS.king.night).toBe(true);
  });
});

describe('the lodge contracts', () => {
  const kill = (kind: string, o: Partial<KillInfo> = {}): KillInfo => ({ kind, variant: o.variant, rarity: o.rarity ?? 'common', elite: o.elite ?? eliteOf(kind, o.variant), thrall: o.thrall ?? false });

  it('draws the same sequence every time, never two alike on the board, the first an easy deer job', () => {
    const a = newBoard(), b = newBoard();
    expect(a).toEqual(b);
    expect(a.slots[0]).toMatchObject({ kind: 'species', target: 'deer' });
    for (let n = 0; n < 60; n++) {
      const slots = [draw(n), draw(n + 1000)];
      const c = draw(n + 2000, slots);
      expect(slots.some((s) => s.kind === c.kind && s.target === c.target)).toBe(false);
    }
  });
  it('counts kills by kind / rarity / elite / thrall', () => {
    const board = newBoard();
    const deer = board.slots.find((c) => c.kind === 'species' && c.target === 'deer');
    expect(deer).toBeDefined();
    if (!deer) return;
    expect(counts(deer, kill('deer'))).toBe(true);
    expect(counts(deer, kill('deer', { thrall: true }))).toBe(false);
    const rare = draw(0); rare.kind = 'rarity'; rare.target = 'uncommon';
    expect(counts(rare, kill('boar', { rarity: 'uncommon' }))).toBe(true);
    expect(counts(rare, kill('boar', { rarity: 'rare' }))).toBe(true);
    expect(counts(rare, kill('boar', { rarity: 'common' }))).toBe(false);
    expect(counts(rare, kill('boar', { variant: 'ironhide', rarity: 'legendary' }))).toBe(false); // an elite is its own job
    const elite = draw(0); elite.kind = 'elite'; elite.target = 'blackpaw';
    expect(counts(elite, kill('bear', { variant: 'black-old' }))).toBe(true);
    expect(counts(elite, kill('bear', { variant: 'black' }))).toBe(false);
    const cull = draw(0); cull.kind = 'thrall'; cull.target = 'thrall';
    expect(counts(cull, kill('elk', { thrall: true, rarity: 'rare' }))).toBe(true);
  });
  it('a filled contract is claimed: it pays, the next one is drawn into its slot, the streak counts; tearing down resets it', () => {
    const board = newBoard();
    expect(claim(board, 0)).toBeNull();                 // not filled
    for (let i = 0; i < 3; i++) recordKill(board, kill('deer'));
    expect(isFilled(board.slots[0] ?? draw(0))).toBe(true);
    const first = board.slots[0]?.serial;
    const pay = claim(board, 0);
    expect(pay?.items).toEqual([{ id: 'lodge-ribbon', n: 1 }]);
    expect(pay?.bolts).toBe(10);
    expect(board.slots[0]?.serial).not.toBe(first);
    expect(board.slots[0]?.serial).toBe(3);
    expect(board).toMatchObject({ claimed: 1, streak: 1, best: 1, next: 4 });
    reroll(board, 1);
    expect(board).toMatchObject({ streak: 0, best: 1, next: 5 });
  });
  it('the third claim ever pays the Hollow Ash finish too', () => {
    const board = newBoard();
    const fill = (i: number): void => { const c = board.slots[i]; if (c) c.have = c.need; };
    fill(0); claim(board, 0); fill(0); claim(board, 0); fill(1);
    expect(claim(board, 1)?.skin).toBe('hollow-ash');
    fill(2);
    expect(claim(board, 2)?.skin).toBeUndefined();
  });
  it('saves and loads per slot (progress kept), and a broken save is a new board', () => {
    const store = new Map<string, string>();
    const kv = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
    const board: Board = newBoard();
    recordKill(board, kill('deer')); recordKill(board, kill('deer'));
    const c0 = board.slots[0]; if (c0) c0.have = c0.need;
    claim(board, 0); reroll(board, 2);
    recordKill(board, kill(board.slots[1]?.target ?? 'boar'));
    saveBoard(board, kv);
    const back = loadBoard(kv);
    expect(back.slots.map((c) => [c.serial, c.kind, c.target, c.have])).toEqual(board.slots.map((c) => [c.serial, c.kind, c.target, c.have]));
    expect(back).toMatchObject({ next: board.next, claimed: 1, streak: 0, best: 1 });
    store.set(BOARD_STORE, '{"slots": 3}');
    expect(loadBoard(kv)).toEqual(newBoard());
    expect(loadBoard(null)).toEqual(newBoard());
  });
});

describe('the trader', () => {
  const pack = (have: Partial<Record<TradeItem, number>>) => ({ count: (id: TradeItem) => have[id] ?? 0 });
  it('swaps only what the pack can pay for, and a finish once', () => {
    const bolts = TRADES.find((t) => t.id === 'bolts-hide');
    const ash = TRADES.find((t) => t.id === 'hollow-ash');
    if (!bolts || !ash) throw new Error('missing trades');
    expect(tradeState(bolts, pack({ 'deer-hide': 1 }), () => false)).toMatchObject({ ok: false, missing: [{ item: 'deer-hide', n: 1 }] });
    expect(tradeState(bolts, pack({ 'deer-hide': 2 }), () => false).ok).toBe(true);
    const rich = pack({ 'bear-pelt': 1, 'amber-resin': 9 });
    expect(tradeState(ash, rich, () => false).ok).toBe(true);
    expect(tradeState(ash, rich, (s) => s === 'hollow-ash')).toMatchObject({ ok: false, owned: true });
  });
  it('asks only for items the pack knows, and never currency', () => {
    for (const t of TRADES) for (const g of t.give) expect(g.item in ITEMS, g.item).toBe(true);
  });
});

describe('Pine Hollow achievements (PH-C10)', () => {
  it('holds at least 14, each with a joke title', () => {
    const defs = achievementsFor('chunk://local/pine-hollow');
    expect(defs.length).toBeGreaterThanOrEqual(14);
    for (const d of defs) expect(d.title.length).toBeGreaterThan(0);
  });
});
