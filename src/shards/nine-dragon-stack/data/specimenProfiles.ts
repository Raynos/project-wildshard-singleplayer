/** Shared specimen defaults and variants. Authoring never imports the model card's runtime renderer. */
export interface SpecimenProfile<P extends object> {
  readonly defaults: P;
  readonly variants: readonly { readonly id: string; readonly label: string; readonly params: Partial<P> }[];
}

/** Gate dimensions in their own space; placement and material stay with the runtime model. */
export const PAIFANG = {
  square: { posts: [-5.45, -2.15, 2.15, 5.45], s: 1.85, plaque: '九龍', couplets: null, neonEaves: null, lions: false, k: 0.78, paint: 'cinnabar' },
  stair: { posts: [-5.6, -3.1, 3.1, 5.6], s: 1.3, plaque: '九龍', couplets: null, neonEaves: null, lions: false, paint: 'cinnabar' },
  well: { posts: [-5.4, -2.3, 2.3, 5.4], s: 1.05, plaque: '九龍', couplets: ['萬家燈火', '天下一家'], neonEaves: null, lions: false },
} as const;

export const PAIFANG_PROFILE: SpecimenProfile<{ readonly kind: keyof typeof PAIFANG }> = {
  defaults: { kind: 'square' },
  variants: [
    { id: 'square', label: 'Lantern Square (cinnabar)', params: { kind: 'square' } },
    { id: 'stair', label: 'The stair-street', params: { kind: 'stair' } },
    { id: 'well', label: 'The Well\'s gate bridge (mineral)', params: { kind: 'well' } },
  ],
};
export const HOOK_PROFILE: SpecimenProfile<{ readonly reach: number }> = {
  defaults: { reach: 0.9 },
  variants: [
    { id: 'reach-0.6', label: 'Reach 0.6 m', params: { reach: 0.6 } },
    { id: 'reach-0.7', label: 'Reach 0.7 m', params: { reach: 0.7 } },
    { id: 'reach-0.8', label: 'Reach 0.8 m', params: { reach: 0.8 } },
    { id: 'reach-0.9', label: 'Reach 0.9 m', params: { reach: 0.9 } },
    { id: 'reach-1', label: 'Reach 1 m', params: { reach: 1 } },
    { id: 'reach-1.3', label: 'Reach 1.3 m', params: { reach: 1.3 } },
  ],
};
export const STOOL_PROFILE: SpecimenProfile<{ readonly wash: number }> = {
  defaults: { wash: 0xc23b22 },
  variants: [
    { id: 'c23b22', label: 'Cinnabar', params: { wash: 0xc23b22 } },
    { id: '2e5fa3', label: 'Azurite', params: { wash: 0x2e5fa3 } },
    { id: '3e5a4a', label: 'Malachite', params: { wash: 0x3e5a4a } },
  ],
};
export const SCOOTER_PROFILE: SpecimenProfile<{ readonly wash: number }> = {
  defaults: { wash: 0xb8321f },
  variants: [
    { id: 'b8321f', label: 'Red', params: { wash: 0xb8321f } },
    { id: '2e5fa3', label: 'Blue', params: { wash: 0x2e5fa3 } },
    { id: '7fbf9a', label: 'Mint', params: { wash: 0x7fbf9a } },
  ],
};
export const FIGURE_PROFILE: SpecimenProfile<{ readonly pose: 'stand' | 'sit' | 'cook'; readonly umbrella: boolean }> = {
  defaults: { pose: 'stand', umbrella: false },
  variants: [
    { id: 'stand', label: 'Standing', params: {} },
    { id: 'umbrella', label: 'With an umbrella', params: { umbrella: true } },
    { id: 'sit', label: 'Seated', params: { pose: 'sit' } },
    { id: 'cook', label: 'Cooking', params: { pose: 'cook' } },
  ],
};
export const LAUNDRY_PROFILE: SpecimenProfile<{ readonly kind: 'gallery' | 'lower' | 'pole'; readonly span: number; readonly rise: number }> = {
  defaults: { kind: 'gallery', span: 2.6, rise: -0.05 },
  variants: [
    { id: 'gallery', label: 'Between gallery posts', params: { kind: 'gallery', span: 2.6, rise: -0.05 } },
    { id: 'lower', label: 'Along a lower-Well front', params: { kind: 'lower', span: 2.4, rise: -0.05 } },
    { id: 'pole', label: 'A pole out from the wall', params: { kind: 'pole', span: 1.6, rise: 0.05 } },
  ],
};
export const LOTUS_PROFILE: SpecimenProfile<{ readonly capped: boolean }> = {
  defaults: { capped: true },
  variants: [
    { id: 'lotus', label: 'Lotus cap', params: { capped: true } },
    { id: 'bare', label: 'Far crossings (no cap)', params: { capped: false } },
  ],
};
