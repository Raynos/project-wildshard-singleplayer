/**
 * The hunting lodge's contract board (PINE-HOLLOW-REMASTER PH-C6, Jake's PH-U21: "a rotating set of 3; finishing one
 * draws the next; no real-time clock; works offline") — the pure rules, no THREE, no DOM (test/pine-quest.test.ts).
 *
 * Three slots, each one contract of a kind:
 *   species  "Take 3 deer"                 any kill of that species (thralls do not count)
 *   rarity   "Take 2 uncommon animals"     any kill of that rarity or better (thralls, elites and the King excluded)
 *   elite    "Take Old Blackpaw"           the named elite (kind + variant, the identity elites.ts keeps)
 *   thrall   "Cull 3 thralls"              the King's moss-grown elk / boar (they roam the old-growth at night, PH-C7)
 * A contract that is filled is CLAIMED at the board: it pays (a lodge ribbon or more — the trophy the trader takes —
 * bolts, heartwood; the third claim ever also pays the Hollow Ash crossbow finish, PH-U16 "contracts pay in trophies and
 * skins") and the slot draws the next. TEARING ONE DOWN draws a fresh one in its slot and resets the streak (the
 * "Lodge Regular" achievement counts claims in a row).
 *
 * The draw is deterministic: contract number `serial` is a hash of the serial, so the sequence is the same for every
 * player and a reload never rerolls anything. Nothing reads the clock.
 *
 *   const board = loadBoard(store);             // store = localStorage (or a Map in tests)
 *   recordKill(board, { kind, variant, rarity, elite, thrall })  → the slots it advanced
 *   claim(board, i) → the reward, or null when slot i is not filled;  reroll(board, i);  saveBoard(board, store)
 */

export type ContractKind = 'species' | 'rarity' | 'elite' | 'thrall';
export type RewardItem = 'lodge-ribbon' | 'amber-heartwood' | 'amber-resin';
export interface Reward { items: { id: RewardItem; n: number }[]; bolts: number; skin?: 'hollow-ash' }
export interface Contract {
  /** the draw number (unique, increasing) */
  serial: number;
  kind: ContractKind;
  /** species id / rarity / elite id / 'thrall' */
  target: string;
  need: number;
  have: number;
  /** the notice's heading and its line ("Venison for the lodge", "Take 3 deer") */
  title: string;
  goal: string;
  reward: Reward;
}
export interface Board { next: number; slots: Contract[]; claimed: number; streak: number; best: number }

/** a kill as the board sees it */
export interface KillInfo { kind: string; variant?: string | undefined; rarity?: string | undefined; elite: string | null; thrall: boolean }

const SPECIES: { id: string; plural: string; need: number; title: string }[] = [
  { id: 'deer', plural: 'deer', need: 3, title: 'Venison for the lodge' },
  { id: 'boar', plural: 'boar', need: 3, title: 'The rooting boar' },
  { id: 'elk', plural: 'elk', need: 2, title: 'Elk for the smokehouse' },
  { id: 'bear', plural: 'bear', need: 1, title: 'A bear too bold' },
];
const RARITY: { id: string; need: number; title: string }[] = [
  { id: 'uncommon', need: 2, title: 'Something unusual' },
  { id: 'rare', need: 1, title: 'A rare coat' },
];
/** the elites by id, with the identity a kill carries (elites.ts PINE_ELITE_ANIMALS — kept here so this stays import-free) */
export const ELITE_TARGETS: Record<string, { name: string; kind: string; variant: string }> = {
  ironhide: { name: 'Old Ironhide', kind: 'boar', variant: 'ironhide' },
  'ghost-stag': { name: 'the Ghost Stag', kind: 'deer', variant: 'ghost' },
  blackpaw: { name: 'Old Blackpaw', kind: 'bear', variant: 'black-old' },
  'imperial-bull': { name: 'the Imperial Bull', kind: 'elk', variant: 'imperial' },
};
const ELITES = Object.keys(ELITE_TARGETS);
const RARITY_RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 };

/** the elite id a (kind, variant) kill is, or null */
export function eliteOf(kind: string, variant: string | undefined): string | null {
  for (const [id, e] of Object.entries(ELITE_TARGETS)) if (e.kind === kind && e.variant === variant) return id;
  return null;
}

/** a small integer hash → [0, 1) (mulberry32 of the serial) */
function rand(serial: number, salt: number): number {
  let t = (serial * 0x9e3779b1 + salt * 0x85ebca6b) >>> 0;
  t = (t + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(list: readonly T[], r: number): T => {
  const v = list[Math.min(list.length - 1, Math.floor(r * list.length))];
  if (v === undefined) throw new Error('contracts: empty list');
  return v;
};

/** the contract of `kind` on `target` (null for a target the tables do not know) */
export function contractFor(serial: number, kind: ContractKind, target: string): Contract | null {
  if (kind === 'species') {
    const s = SPECIES.find((x) => x.id === target);
    return s ? { serial, kind, target, need: s.need, have: 0, title: s.title, goal: `Take ${s.need} ${s.plural}`, reward: { items: [{ id: 'lodge-ribbon', n: 1 }], bolts: 10 } } : null;
  }
  if (kind === 'rarity') {
    const s = RARITY.find((x) => x.id === target);
    return s ? { serial, kind, target, need: s.need, have: 0, title: s.title, goal: s.need > 1 ? `Take ${s.need} ${s.id} animals` : `Take a ${s.id} animal`, reward: { items: [{ id: 'lodge-ribbon', n: 2 }], bolts: 0 } } : null;
  }
  if (kind === 'elite') {
    const e = ELITE_TARGETS[target];
    return e ? { serial, kind, target, need: 1, have: 0, title: 'A name on the board', goal: `Take ${e.name}`, reward: { items: [{ id: 'lodge-ribbon', n: 3 }, { id: 'amber-heartwood', n: 1 }], bolts: 0 } } : null;
  }
  if (target === 'thrall') return { serial, kind, target, need: 3, have: 0, title: 'Cull the moss-grown', goal: 'Put down 3 thralls', reward: { items: [{ id: 'lodge-ribbon', n: 2 }, { id: 'amber-resin', n: 3 }], bolts: 0 } };
  return null;
}

/** contract number `serial`, avoiding a (kind, target) already on the board. Serial 0 is always a deer contract (an easy start). */
export function draw(serial: number, taken: readonly Contract[] = []): Contract {
  const clash = (c: Contract): boolean => taken.some((t) => t.kind === c.kind && t.target === c.target);
  for (let salt = 0; salt < 24; salt++) {
    const r = rand(serial, salt), r2 = rand(serial, salt + 101);
    const kind: ContractKind = serial === 0 ? 'species' : r < 0.45 ? 'species' : r < 0.65 ? 'rarity' : r < 0.8 ? 'elite' : 'thrall';
    const target = kind === 'species' ? (serial === 0 ? 'deer' : pick(SPECIES, r2).id) : kind === 'rarity' ? pick(RARITY, r2).id : kind === 'elite' ? pick(ELITES, r2) : 'thrall';
    const c = contractFor(serial, kind, target);
    if (c && !clash(c)) return c;
  }
  // every salt clashed (cannot happen with 3 slots and this many targets)
  const any = contractFor(serial, 'thrall', 'thrall');
  if (!any) throw new Error('contracts: no thrall contract');
  return any;
}

export function newBoard(): Board {
  const slots: Contract[] = [];
  for (let i = 0; i < 3; i++) slots.push(draw(i, slots));
  return { next: 3, slots, claimed: 0, streak: 0, best: 0 };
}

/** does kill `k` count toward `c`? */
export function counts(c: Contract, k: KillInfo): boolean {
  switch (c.kind) {
    case 'species': return !k.thrall && k.kind === c.target;
    case 'rarity': return !k.thrall && k.elite === null && (RARITY_RANK[k.rarity ?? 'common'] ?? 0) >= (RARITY_RANK[c.target] ?? 9) && (RARITY_RANK[k.rarity ?? 'common'] ?? 0) < 3;
    case 'elite': return k.elite === c.target;
    case 'thrall': return k.thrall;
    default: return false;
  }
}

/** a kill: every slot it counts for moves on by one (capped at `need`); returns the slots that moved */
export function recordKill(b: Board, k: KillInfo): number[] {
  const moved: number[] = [];
  b.slots.forEach((c, i) => { if (c.have < c.need && counts(c, k)) { c.have++; moved.push(i); } });
  return moved;
}

export const isFilled = (c: Contract): boolean => c.have >= c.need;

/** claim slot `i`: its reward (the third claim ever adds the Hollow Ash finish), the next contract drawn into the slot */
export function claim(b: Board, i: number): Reward | null {
  const c = b.slots[i];
  if (c === undefined || !isFilled(c)) return null;
  b.claimed++; b.streak++; b.best = Math.max(b.best, b.streak);
  const reward: Reward = { items: c.reward.items.map((x) => ({ ...x })), bolts: c.reward.bolts };
  if (b.claimed === 3) reward.skin = 'hollow-ash';
  b.slots[i] = draw(b.next++, b.slots.filter((_, j) => j !== i));
  return reward;
}

/** tear slot `i` down: a fresh contract in its place, the streak back to 0 */
export function reroll(b: Board, i: number): void {
  if (b.slots[i] === undefined) return;
  b.streak = 0;
  b.slots[i] = draw(b.next++, b.slots.filter((_, j) => j !== i));
}

// ── persistence (per shard, 'ws.lodge.v1') ──

export const BOARD_STORE = 'ws.lodge.v1';
export interface KV { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** the saved board, or a new one: each slot is rebuilt from its serial, kind and target (the words and the reward come
 *  from today's tables) and keeps only its progress */
export function loadBoard(store: KV | null): Board {
  const raw = ((): unknown => { try { return JSON.parse(store?.getItem(BOARD_STORE) ?? 'null'); } catch { return null; } })();
  if (!isObj(raw) || !Array.isArray(raw['slots']) || raw['slots'].length !== 3) return newBoard();
  const slots: Contract[] = [];
  for (const s of raw['slots']) {
    if (!isObj(s)) return newBoard();
    const serial = num(s['serial'], 0), kind = s['kind'], target = s['target'];
    const c = (kind === 'species' || kind === 'rarity' || kind === 'elite' || kind === 'thrall') && typeof target === 'string' ? contractFor(serial, kind, target) : null;
    const slot = c ?? draw(serial, slots);
    slot.have = Math.max(0, Math.min(slot.need, Math.floor(num(s['have'], 0))));
    slots.push(slot);
  }
  const next = Math.max(num(raw['next'], 3), ...slots.map((c) => c.serial + 1));
  return { next, slots, claimed: num(raw['claimed'], 0), streak: num(raw['streak'], 0), best: num(raw['best'], 0) };
}

export function saveBoard(b: Board, store: KV | null): void {
  try { store?.setItem(BOARD_STORE, JSON.stringify({ next: b.next, slots: b.slots.map((c) => ({ serial: c.serial, kind: c.kind, target: c.target, have: c.have })), claimed: b.claimed, streak: b.streak, best: b.best })); } catch { /* not persisted this session */ }
}
