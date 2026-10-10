// Nine Dragon authoring row shapes; these declarations have no runtime dependency.
/** Nine Dragon’s authored SignModelParams row shape. */
export interface SignModelParams<S extends string = string> {
  readonly style: S;
  readonly text: string;
  /** mono styles: the neon / lightbox tint; colour styles: the characters' colour */
  readonly color: string;
  readonly vertical: boolean;
  /** colour styles: the ground (paper, lacquer) */
  readonly ink?: string;
  /** character height, metres */
  readonly size: number;
  /** both faces (a blade sign hanging out from a wall) */
  readonly blade: boolean;
  readonly board?: number;
  readonly gain?: number;
}
/** Nine Dragon’s authored SignVariantRow row shape. */
export interface SignVariantRow<S extends string = string> {
  readonly id: string;
  readonly label: string;
  readonly params: Partial<SignModelParams<S>>;
}
/** Nine Dragon’s authored SignModelRow row shape. */
export interface SignModelRow {
  readonly key: string;
  /** the styles drawn as SDF calligraphy when the look has it */
  readonly calligraphyStyles: readonly string[];
  /** a calligraphy copy's gain is gain / calligraphyGain × tubeGain (its default gain draws the tubes at tubeGain) */
  readonly calligraphyGain: number;
  readonly tubeGain: number;
  /** styles whose words run along y (the blade's etch): their face's up is +x */
  readonly sideways: readonly string[];
  readonly neonDepth: number;
  readonly bladeDepth: number;
  readonly depth: number;
  /** how far an atlas sign's board stands off its face */
  readonly standoff: number;
  /** the variant a style is shown as (a style with no entry: the variant of its own name) */
  readonly variantOf: Readonly<Record<string, string>>;
  readonly pieces: { readonly atlas: string; readonly neon: string };
}
