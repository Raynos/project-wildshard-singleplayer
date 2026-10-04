import type { TierOverrides } from '@wildshard/engine/level/spec';

export type NdTier = keyof TierOverrides;
export function glyphLayout(tier: NdTier): { cell: number; fontPx: number; spread: number; skeletonSpread: number } {
  return tier === 'phone' ? { cell: 64, fontPx: 46, spread: 9, skeletonSpread: 13 }
    : { cell: 128, fontPx: 92, spread: 18, skeletonSpread: 26 };
}
export function signLayout(tier: NdTier): { mw: number; mh: number; cw: number; ch: number; unit: number; pad: number } {
  return tier === 'phone' ? { mw: 1024, mh: 2048, cw: 512, ch: 1024, unit: 48, pad: 4 }
    : { mw: 2048, mh: 4096, cw: 1024, ch: 2048, unit: 96, pad: 8 };
}
export function paintSize(tier: NdTier): number { return tier === 'phone' ? 512 : 1024; }
export function decalScale(tier: NdTier): number { return tier === 'phone' ? 0.5 : 1; }
