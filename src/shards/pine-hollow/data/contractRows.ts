/** Authored lodge offers; the native board keeps draw, kill, claim and save laws. */
export type ContractKind = 'species' | 'rarity' | 'elite' | 'thrall';
export type RewardItem = 'lodge-ribbon' | 'amber-resin';
export interface Reward { items: { id: RewardItem; n: number }[]; bolts: number; skin?: 'hollow-ash' }

interface AuthoredContract {
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

export const SPECIES: { id: string; plural: string; need: number; title: string }[] = [
  { id: 'deer', plural: 'deer', need: 3, title: 'Venison for the lodge' },
  { id: 'boar', plural: 'boar', need: 3, title: 'The rooting boar' },
  { id: 'elk', plural: 'elk', need: 2, title: 'Elk for the smokehouse' },
  { id: 'bear', plural: 'bear', need: 1, title: 'A bear too bold' },
];
export const RARITY: { id: string; need: number; title: string }[] = [
  { id: 'uncommon', need: 2, title: 'Something unusual' },
  { id: 'rare', need: 1, title: 'A rare coat' },
];
/** the elites by id, with the identity a kill carries (eliteRoster.ts PINE_ELITE_ANIMALS — kept here so this stays import-free) */
export const ELITE_TARGETS: Record<string, { name: string; kind: string; variant: string }> = {
  ironhide: { name: 'Old Ironhide', kind: 'boar', variant: 'ironhide' },
  'ghost-stag': { name: 'the Ghost Stag', kind: 'deer', variant: 'ghost' },
  blackpaw: { name: 'Old Blackpaw', kind: 'bear', variant: 'black-old' },
  'imperial-bull': { name: 'the Imperial Bull', kind: 'elk', variant: 'imperial' },
};

const ELITES = Object.keys(ELITE_TARGETS);

/** the contract of `kind` on `target` (null for a target the tables do not know) */
function authorContract(serial: number, kind: ContractKind, target: string): AuthoredContract | null {
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
    return e ? { serial, kind, target, need: 1, have: 0, title: 'A name on the board', goal: `Take ${e.name}`, reward: { items: [{ id: 'lodge-ribbon', n: 3 }, { id: 'amber-resin', n: 4 }], bolts: 0 } } : null;
  }
  if (target === 'thrall') return { serial, kind, target, need: 3, have: 0, title: 'Cull the moss-grown', goal: 'Put down 3 thralls', reward: { items: [{ id: 'lodge-ribbon', n: 2 }, { id: 'amber-resin', n: 3 }], bolts: 0 } };
  return null;
}

/** The board offers authored quest content rows; a draw copies one and starts its counter at zero. */
export interface ContractRow extends Omit<AuthoredContract, 'serial' | 'have'> { id: string }
export const CONTRACT_ROWS: readonly ContractRow[] = [
  ...SPECIES.map((row) => ({ kind: 'species' as const, target: row.id })),
  ...RARITY.map((row) => ({ kind: 'rarity' as const, target: row.id })),
  ...ELITES.map((target) => ({ kind: 'elite' as const, target })),
  { kind: 'thrall' as const, target: 'thrall' },
].map(({ kind, target }) => {
  const row = authorContract(0, kind, target);
  if (row === null) throw new Error(`Invalid authored contract ${kind}.${target}`);
  return { id: `contract.${kind}.${target}`, kind, target, need: row.need, title: row.title, goal: row.goal, reward: row.reward };
});
