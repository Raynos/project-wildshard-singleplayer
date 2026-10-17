import type { TierOverrides } from '@wildshard/engine/level/spec';

export type NdTier = keyof TierOverrides;
export function paintSize(tier: NdTier): number { return tier === 'phone' ? 512 : 1024; }
export function decalScale(tier: NdTier): number { return tier === 'phone' ? 0.5 : 1; }
