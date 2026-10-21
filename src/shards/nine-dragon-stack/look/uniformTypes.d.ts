export interface SharedUniformRows {
  readonly uTime: number;
  readonly uCam: { readonly v3: readonly [number, number, number]; };
  readonly uRootAt: { readonly v3: readonly [number, number, number]; };
  readonly uRes: { readonly v2: readonly [number, number]; };
  readonly uDpr: number;
  readonly uNear: number;
  readonly uLinePx: number;
  readonly uGroundPx: number;
  readonly uLineFade: { readonly v2: readonly [number, number]; };
  readonly uInkMid: number;
  readonly uInk0: { readonly rgb: number };
  readonly uInk1: { readonly rgb: number };
  readonly uLineFog: number;
  readonly uGoldDim: { readonly rgb: number };
  readonly uSilver: { readonly rgb: number };
  readonly uGold: { readonly rgb: number };
  readonly uPaper: { readonly rgb: number };
  readonly uPaperDeep: { readonly rgb: number };
  readonly uLightDir: { readonly v3: readonly [number, number, number]; readonly normalize: true; };
  readonly uShade: { readonly rgb: number };
  readonly uPool: number;
  readonly uStain: number;
  readonly uMottle: number;
  readonly uWeave: number;
  readonly uSilkPaper: number;
  readonly uWashTint: { readonly v3: readonly [number, number, number]; };
  readonly uWinWarm: { readonly rgb: number };
  readonly uWinCool: { readonly rgb: number };
  readonly uWinDark: { readonly rgb: number };
  readonly uSutraWin: { readonly rgb: number };
  readonly uFogBase: number;
  readonly uFogStart: number;
  readonly uFogBaseCol: { readonly rgb: number };
  readonly uBands: { readonly v4s: readonly (readonly [number, number, number, number])[] };
  readonly uBandCols: { readonly rgbs: readonly number[] };
  readonly uBandWin: { readonly v3: readonly [number, number, number]; };
  readonly uGlint: { readonly v4: readonly [number, number, number, number]; };
  readonly uAccentFog: number;
  readonly uFlag: { readonly v4: readonly [number, number, number, number]; };
  readonly uFlagJoint: number;
  readonly uGroundY: number;
  readonly uTilePitch: { readonly v2: readonly [number, number]; };
  readonly uPaintFlag: number;
  readonly uPaintStone: { readonly v3: readonly [number, number, number]; };
  readonly uShaft: { readonly v4: readonly [number, number, number, number]; };
  readonly uShaftK: { readonly v4: readonly [number, number, number, number]; };
  readonly uShaftLit: number;
  readonly uFogDeep: { readonly v4: readonly [number, number, number, number]; };
  readonly uDeepAir: { readonly v4: readonly [number, number, number, number]; };
  readonly uDeepAir2: { readonly v4: readonly [number, number, number, number]; };
  readonly uPuff: { readonly v2: readonly [number, number]; };
  readonly uDeepAmb: { readonly v4: readonly [number, number, number, number]; };
  readonly uWetSky: { readonly v2: readonly [number, number]; };
  readonly uDry: number;
}

/** One tier's ambient-occlusion configuration, in the engine AO pass's own field names. */
interface AoTier {
  readonly aoRadius: number; readonly distanceFalloff: number; readonly intensity: number; readonly aoSamples: number;
  readonly denoiseSamples: number; readonly denoiseIterations: number; readonly denoiseRadius: number; readonly halfRes: boolean;
}
/** The admitted ambient-occlusion and fog tuning row. */
export interface AoTuning {
  readonly phone: AoTier;
  readonly desktop: AoTier;
  readonly color: readonly [number, number, number];
  readonly fog: readonly [number, number];
}
