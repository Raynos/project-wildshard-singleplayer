import type { UniformRows } from '@wildshard/game/plugin/shaderFamily';
/** A card uniform's pulse as data: each `update(t)` writes `base + amp · sin(t · rate + phase)`. */
export interface CardPulseRow {
  readonly uniform: string;
  readonly base: number;
  readonly amp: number;
  readonly rate: number;
  readonly phase: number;
}

/**
 * One card: a program, its own uniforms (over the program row's), an optional pulse, and where it stands: the caller's
 * named `quad` (else the row's plane), its `scale` (x, y, z, or one number for all three; default 1), its offset `at` and
 * its own render `order` (else the row's); `instances` draws it once per instance row, from the baked attributes.
 */
export interface CardRow<P extends string = string> {
  readonly program: P;
  readonly uniforms?: UniformRows;
  readonly pulse?: CardPulseRow;
  readonly quad?: string;
  readonly scale?: readonly [number, number, number] | number;
  readonly at?: readonly [number, number, number];
  readonly order?: number;
  readonly instances?: Readonly<Record<string, CardAttributeRow>>;
}

/** A group of cards: its name, the render order its cards draw at, its shared plane's size (default 1 × 1), the cards in draw order. */
export interface CardGroupRow<P extends string = string> {
  readonly name: string;
  readonly order: number;
  readonly plane?: readonly [number, number];
  readonly cards: readonly CardRow<P>[];
}

/** One per-instance attribute: its item size and its float32 bytes, base64 (the platform's byte order). */
export interface CardAttributeRow {
  readonly size: number;
  readonly float32: string;
}
