

export interface SignpostParams {
  /** the arrow boards, top down: each points this way (radians about +Y, 0 = +z: world (sin, cos)) */
  readonly arrows: readonly number[];
  /** each board's lettering, top down (E318: Jake, "letter them" — a blank board is a placeholder); '' or none = blank */
  readonly labels?: readonly string[];
}


export interface PlankStepParams {
  /** width across the climb, metres */
  readonly w: number;
  /** its roll with the ground across it, radians (E118) */
  readonly roll: number;
  /** which way the climb runs, radians about +Y */
  readonly yaw: number;
  readonly dark: boolean;
}
export interface CatalogueParams {
  readonly fencePost: Record<string, never>;
  readonly signpost: SignpostParams;
  readonly plankStep: PlankStepParams;
}
