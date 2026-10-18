export interface FilamentRows {
  readonly uRes: { readonly v2: readonly [number, number] };
  readonly uProjection: { readonly v2: readonly [number, number] };
  readonly uCorePx: number; readonly uHaloPx: number; readonly uI: number;
  readonly uPulse: number; readonly uLen: number; readonly uTime: number;
  readonly uCore: { readonly v3: readonly [number, number, number] };
  readonly uHalo: { readonly v3: readonly [number, number, number] };
}
