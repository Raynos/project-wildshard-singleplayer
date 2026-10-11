type NativeEffectId = `effect.${string}`;
type NativeTag = `${string}.${string}`;
interface NativeEffectRow {
  id: NativeEffectId; kind: 'permanent'; tags: readonly NativeTag[];
  modifiers: readonly { attr: string; op: 'add' | 'mul' | 'override'; value: number }[];
  grants?: readonly NativeTag[]; stacking: 'none' | { max: number }; group?: string; removes?: readonly NativeEffectId[];
}
type GoodId = 'whetstone-1' | 'whetstone-2' | 'heart-1' | 'heart-2' | 'sea-chart' | 'cape';
interface GoodRow { id: GoodId; name: string; does: string; icon: 'whetstone' | 'heart' | 'chart' | 'cape'; price: number; needs?: GoodId }

const permanent = (id: NativeEffectId, modifiers: NativeEffectRow['modifiers'] = [], grants: NativeEffectRow['grants'] = []): NativeEffectRow =>
  ({ id, kind: 'permanent', tags: [], modifiers, grants, stacking: 'none' });
/** Existing owned perks, modifiers, stacking and cosmetic grants in original registration order. */
export const DRIFTWOOD_EFFECTS: readonly NativeEffectRow[] = [
  { ...permanent('effect.sturdy-heart', [{ attr: 'maxHealth', op: 'add', value: 20 }]), stacking: { max: 2 } },
  permanent('effect.charm.1', [{ attr: 'maxHealth', op: 'add', value: 10 }]),
  permanent('effect.charm.2', [{ attr: 'dodgeCooldownMul', op: 'mul', value: 0.7 }]),
  permanent('effect.charm.3', [], ['cosmetic.seaglass-glow']),
  { ...permanent('effect.whetstone.1', [{ attr: 'damage', op: 'mul', value: 1.25 }]), group: 'whetstone' },
  { ...permanent('effect.whetstone.2', [{ attr: 'damage', op: 'mul', value: 1.5 }]), group: 'whetstone', removes: ['effect.whetstone.1'] },
  permanent('effect.bear-claw', [{ attr: 'heavyDamageMul', op: 'mul', value: 1.2 }]),
  permanent('effect.boar-tusk', [], ['guard.dodge']),
  permanent('effect.hit-cap', [{ attr: 'incomingCap', op: 'override', value: 20 }]),
  permanent('effect.captain-hat', [], ['cosmetic.hat.captain']),
  permanent('effect.cape', [], ['cosmetic.cape']),
];
/** Existing per-species bounty values. */
export const DRIFTWOOD_COIN_VALUES: Readonly<Record<string, number>> = {
  crab: 1, monkey: 1, boar: 2, sailor: 5, bear: 10, captain: 25,
};
/** Existing six trader goods, names, icons, prerequisites and prices. */
export const GOODS: readonly GoodRow[] = [
  { id: 'whetstone-1', name: 'Whetstone I', does: 'Sword damage +25 %', icon: 'whetstone', price: 12 },
  { id: 'whetstone-2', name: 'Whetstone II', does: 'Sword damage +50 %', icon: 'whetstone', price: 22, needs: 'whetstone-1' },
  { id: 'heart-1', name: 'Sturdy Heart I', does: 'Max health 120', icon: 'heart', price: 14 },
  { id: 'heart-2', name: 'Sturdy Heart II', does: 'Max health 140', icon: 'heart', price: 22, needs: 'heart-1' },
  { id: 'sea-chart', name: 'Sea chart', does: 'Unfound sea glass on the map', icon: 'chart', price: 12 },
  { id: 'cape', name: 'Sailcloth cape', does: 'A look · worn from GEAR', icon: 'cape', price: 8 },
];

/** Bounty from the original full island clear. */
export const FULL_CLEAR = 92;
