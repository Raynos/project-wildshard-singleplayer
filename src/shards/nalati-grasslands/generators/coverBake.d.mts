/** Typed as its readers use them (the rows cross admission schemas downstream). */
export interface NalatiCoverLife { readonly kind: string; readonly perches: readonly unknown[]; readonly row: { readonly count: number } & Readonly<Record<string, unknown>> }
export interface NalatiCoverProfile {
  readonly catalogue: readonly unknown[];
  readonly packed: { readonly bin: { readonly file: string; readonly bytes: number }; readonly bytes: number; readonly rows: readonly unknown[] };
  readonly life: readonly NalatiCoverLife[];
}
export interface NalatiCoverRows {
  readonly phone: NalatiCoverProfile; readonly desktop: NalatiCoverProfile; readonly materials: Readonly<Record<string, unknown>>;
  readonly butterflies: { readonly phone: number; readonly desktop: number }; readonly hue: readonly string[]; readonly flyScale: number; readonly raptors: number;
}
export interface NalatiCover { readonly rows: NalatiCoverRows; readonly bins: ReadonlyMap<string, Uint8Array> }
export const COVER_FLOCKS: { readonly butterflies: { readonly phone: number; readonly desktop: number }; readonly raptors: number };
export const COVER_INPUTS: readonly string[];
export function coverBinName(tier: 'phone' | 'desktop'): string;
export function nalatiCoverBake(read: (url: string) => Uint8Array): Promise<NalatiCover>;
