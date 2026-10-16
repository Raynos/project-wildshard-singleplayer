import type { CardAttributeRow, CardGroupRow } from '@wildshard/sdk/looks/cardField';

/**
 * The shapes of Sky Reach's baked camera-facing cards (generators/skyCards.ts → data/skyCards.ts): the cumulus field and
 * the sun's glow. Their graphs and card fields are built at build time (generators/skyCardsLook.ts,
 * generators/sunGlowLook.ts) into data/skyDressing.generated.json.
 */

/** The sun's three card programs (bloom, wide, shaft). */
export type SunGlowProgram = 'sunBloom' | 'sunWide' | 'sunShaft';

/** A baked instanced card field: its mesh name, render order, the quad's size, its program and per-instance attributes. */
export interface SkyCardField<P extends string> {
  readonly name: string;
  readonly order: number;
  readonly plane: readonly [number, number];
  readonly program: P;
  readonly attributes: Readonly<Record<string, CardAttributeRow>>;
}

/** The baked cards (generators/skyCards.ts → data/skyCards.ts): the cumulus field and the sun's glow. */
export interface SkyCardRows {
  readonly cumulus: SkyCardField<'cumulus'>;
  readonly sunGlow: CardGroupRow<SunGlowProgram>;
}
