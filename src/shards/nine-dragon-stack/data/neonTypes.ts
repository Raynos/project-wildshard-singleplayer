// Nine Dragon authoring row shapes; these declarations have no runtime dependency.
/** Nine Dragon’s authored NeonTextLook row shape. */
export interface NeonTextLook {
  /** 0 brush fill ... 1 monoline tube */
  readonly mono: number;
  /** tube radius, rim width, fill thicken, seam darkness and width, halo reach (all em) and halo gain */
  readonly tubeRadius: number; readonly rim: number; readonly thicken: number; readonly seam: number; readonly seamWidth: number;
  readonly haloReach: number; readonly haloGain: number;
  /** the board's frame tube: inset, tube radius, corner radius (m); the board's lift by its own light */
  readonly frameInset: number; readonly frameRadius: number; readonly frameCorner: number; readonly boardLift: number;
  /** the board's colour (sRGB hex) */
  readonly board: number;
  /** the full glow gain */
  readonly gain: number;
}
