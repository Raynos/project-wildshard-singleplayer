/** Deterministic contracts over admitted rows. Saves retain serials and progress; current rows own words and rewards. */
import type { ContractCatalogue, ContractReward as Reward } from '@wildshard/format/contracts';

export interface Contract {
  
  serial: number;
  kind: string;
  
  target: string;
  need: number;
  have: number;
  
  title: string;
  goal: string;
  reward: Reward;
}
/** Durable counters and the currently accepted offers; serials never rewind on claim or tear. */
export interface Board { next: number; slots: Contract[]; claimed: number; streak: number; best: number }

export interface KillInfo { kind: string; variant?: string | undefined; rarity?: string | undefined; elite: string | null; tags: readonly string[] }

/** Match an observed body to a declared named target independently of its presentation. */
export function eliteOf(contracts: ContractCatalogue, kind: string, variant: string | undefined): string | null {
  for (const [id, e] of Object.entries(contracts.elites)) if (e.kind === kind && e.variant === variant) return id;
  return null;
}

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

/** Rebuild an offer and detached reward from today's content, without accepting saved payout values. */
export function contractFor(contracts: ContractCatalogue, serial: number, kind: string, target: string): Contract | null {
  const row = contracts.rows.find((offer) => offer.kind === kind && offer.target === target);
  return row === undefined ? null : { serial, kind, target, have: 0, need: row.need, title: row.title, goal: row.goal,
    reward: { ...row.reward, items: row.reward.items.map((item) => ({ id: item.id, n: item.n })) } };
}

/** Draw by serial alone; collisions retry a bounded salt sequence before the authored fallback. */
export function draw(contracts: ContractCatalogue, serial: number, taken: readonly Contract[] = []): Contract {
  const clash = (c: Contract): boolean => taken.some((t) => t.kind === c.kind && t.target === c.target);
  for (let salt = 0; salt < contracts.attempts; salt++) {
    const r = rand(serial, salt), r2 = rand(serial, salt + 101);
    const band = contracts.draws.find(row => r < row.below);
    if (band === undefined) throw new Error('Missing contract draw band');
    const first = contracts.initial[serial];
    const kind = first?.kind ?? band.kind, target = first?.target ?? pick(band.targets, r2);
    const c = contractFor(contracts, serial, kind, target);
    if (c !== null && !clash(c)) return c;
  }
  // The authored fallback also defines the exhausted collision policy.
  const fallback = contractFor(contracts, serial, contracts.fallback.kind, contracts.fallback.target);
  if (fallback === null) throw new Error('contracts: no fallback offer');
  return fallback;
}

/** Start every declared slot using the first serials, with no wall-clock dependency. */
export function newBoard(contracts: ContractCatalogue): Board {
  const slots: Contract[] = [];
  for (let i = 0; i < contracts.slots; i++) slots.push(draw(contracts, i, slots));
  return { next: contracts.slots, slots, claimed: 0, streak: 0, best: 0 };
}

/** Evaluate the offer's data predicate against one authoritative death observation. */
export function counts(contracts: ContractCatalogue, c: Contract, k: KillInfo): boolean {
  const rule = contracts.matches.find(row => row.kind === c.kind);
  if (rule === undefined || rule.excludeTags.some(tag => k.tags.includes(tag)) || (rule.excludeElite && k.elite !== null)) return false;
  if (rule.match === 'species') return k.kind === c.target;
  if (rule.match === 'elite') return k.elite === c.target;
  if (rule.match === 'tag') return k.tags.includes(c.target);
  const rank = contracts.ranks[k.rarity ?? contracts.defaultRank] ?? 0;
  return rank >= (contracts.ranks[c.target] ?? Infinity) && (rule.belowRank === undefined || rank < rule.belowRank);
}

/** Advance every matching slot once, capped at its need; return the affected slot indices. */
export function recordKill(contracts: ContractCatalogue, b: Board, k: KillInfo): number[] {
  const moved: number[] = [];
  b.slots.forEach((c, i) => { if (c.have < c.need && counts(contracts, c, k)) { c.have++; moved.push(i); } });
  return moved;
}

export const isFilled = (c: Contract): boolean => c.have >= c.need;

/** Consume a filled offer exactly once and return its reward, including authored claim milestones. */
export function claim(contracts: ContractCatalogue, b: Board, i: number): Reward | null {
  const c = b.slots[i];
  if (c === undefined || !isFilled(c)) return null;
  b.claimed++; b.streak++; b.best = Math.max(b.best, b.streak);
  const reward: Reward = { items: c.reward.items.map((x) => ({ ...x })), bolts: c.reward.bolts,
    ...(c.reward.skin === undefined ? {} : { skin: c.reward.skin }) };
  const milestone = contracts.milestones.find(row => row.claimed === b.claimed);
  if (milestone !== undefined) reward.skin = milestone.skin;
  b.slots[i] = draw(contracts, b.next++, b.slots.filter((_, j) => j !== i));
  return reward;
}

/** Replace a slot with the next serial and reset only the current streak. */
export function reroll(contracts: ContractCatalogue, b: Board, i: number): void {
  if (b.slots[i] === undefined) return;
  b.streak = 0;
  b.slots[i] = draw(contracts, b.next++, b.slots.filter((_, j) => j !== i));
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Read the legacy page wire silently, rebuilding all content from admitted rows. */
export function loadBoard(contracts: ContractCatalogue, saved: string | null): Board {
  const raw = ((): unknown => { try { return JSON.parse(saved ?? 'null'); } catch { return null; } })();
  if (!isObj(raw) || !Array.isArray(raw['slots']) || raw['slots'].length !== contracts.slots) return newBoard(contracts);
  const slots: Contract[] = [];
  for (const s of raw['slots']) {
    if (!isObj(s)) return newBoard(contracts);
    const serial = num(s['serial'], 0), kind = s['kind'], target = s['target'];
    const c = typeof kind === 'string' && typeof target === 'string' ? contractFor(contracts, serial, kind, target) : null;
    const slot = c ?? draw(contracts, serial, slots);
    slot.have = Math.max(0, Math.min(slot.need, Math.floor(num(s['have'], 0))));
    slots.push(slot);
  }
  const next = Math.max(num(raw['next'], contracts.slots), ...slots.map((c) => c.serial + 1));
  return { next, slots, claimed: num(raw['claimed'], 0), streak: num(raw['streak'], 0), best: num(raw['best'], 0) };
}

/** Serialize only serial identities and counters; the page or native save owner performs storage. */
export function saveBoard(b: Board): string {
  return JSON.stringify({ next: b.next, slots: b.slots.map(c => ({ serial: c.serial, kind: c.kind, target: c.target, have: c.have })),
    claimed: b.claimed, streak: b.streak, best: b.best });
}
