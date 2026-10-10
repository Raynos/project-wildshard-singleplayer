// The facade kit's catalogue as the page holds it (G285): which pieces there are, how the batch draws them (the shared
// geometries, the pieces merged into the shell, the clutter that shrinks into the wall) and where each one's distance
// LOD starts. The pieces themselves are built at build time (../../generators/facadePieces.ts) and baked
// (../../generators/specimens.ts: `facade:<id>`, `facade:<id>:far`); the shell's merged pieces are in the layout bake.
import { Matrix4 } from 'three';

/** the style bible's washes for the kit (sRGB hex) */
export const PAL = {
  slab: 0xa9abab, slabDark: 0x8f9294, rail: 0x23252b, metal: 0x3a3d44, ac: 0xd2d1c9, acDark: 0xa9aaa4, pipe: 0x7c8187,
  rust: 0x8a6650, tankBlue: 0x6f8fb5, tankGrey: 0x9aa0a6, shack: 0xaaa59b, timber: 0x6e5238, malachite: 0x2f8a6a,
  azurite: 0x2e5fa3, cinnabar: 0xc23b22, pot: 0xa4532e, leaf: 0x3f7e4e, leafLight: 0x5b9a5e, leafDark: 0x2e6443,
  clamshell: 0xf2eee4, ink: 0x2a2c31,
} as const;

/** a window cage's two grammar widths */
export const CAGE_W = [1.5, 2.7] as const;
/** the one cage piece's width (both grammar sizes scale it: E281, a draw fewer) */
export const CAGE_W0 = 2.0;

/** every piece of the kit, in its catalogue order (the grammar's ids and the shared geometries the batch draws several
 *  ids with, batch.ts DRAWN_AS) */
export const PIECE_IDS = [
  'balcony', 'balconySolid', 'balconyTimber', 'cageS', 'cageW', 'acUnit', 'acBox', 'pipe',
  'laundryOut', 'laundryAlong', 'awning', 'plant', 'planter', 'signBox', 'signFlat', 'tank',
  'shackG', 'shackB', 'bayBox', 'ledge', 'eave', 'post', 'shutter', 'antenna',
  'dish', 'lantern', 'couplet', 'washLine', 'box', 'rail', 'cage', 'shack',
] as const;
export type PieceId = typeof PIECE_IDS[number];
const IDS: ReadonlySet<string> = new Set(PIECE_IDS);
export const isPiece = (s: string): s is PieceId => IDS.has(s);

/** pieces small enough to shrink into the wall past the clutter distance (their program shrinks them; batch.ts) */
export const SMALL: ReadonlySet<PieceId> = new Set<PieceId>(['plant', 'planter', 'laundryOut', 'laundryAlong', 'dish']);

/**
 * The facade lane's draw diet (E281: ~28 draws against a cap of 20; multi-draw is prohibited, E271 / E272).
 * DRAWN_AS: ids that share another piece's geometry — the placement is composed with `local` and its colour
 * multiplied by `tint` (the ledges, bay boxes and gallery posts are one unit box; the two cages one cage; the two
 * rooftop shacks one shack whose roof takes the tint). BAKED: the few-and-small pieces (red couplets, shutters, sign
 * boards and boxes, window ACs, the wash on street lines, awnings) are merged into the shell, which is drawn anyway.
 */
const S = (x: number, y: number, z: number): Matrix4 => new Matrix4().makeScale(x, y, z);
export const DRAWN_AS: Readonly<Partial<Record<PieceId, { readonly as: PieceId; readonly local: Matrix4; readonly tint: number }>>> = {
  ledge: { as: 'box', local: S(1, 0.1, 0.36), tint: PAL.slab },
  bayBox: { as: 'box', local: S(1, 1, 0.6), tint: 0xffffff },
  post: { as: 'box', local: new Matrix4().makeTranslation(0, 0, -0.11).multiply(S(0.22, 1, 0.22)), tint: 0xb8321f },
  cageS: { as: 'cage', local: S(CAGE_W[0] / CAGE_W0, 1, 1), tint: 0xffffff },
  cageW: { as: 'cage', local: S(CAGE_W[1] / CAGE_W0, 1, 1), tint: 0xffffff },
  shackG: { as: 'shack', local: new Matrix4(), tint: PAL.malachite },
  shackB: { as: 'shack', local: new Matrix4(), tint: PAL.azurite },
};
export const BAKED: ReadonlySet<PieceId> = new Set<PieceId>(['couplet', 'shutter', 'signFlat', 'signBox', 'acBox', 'washLine', 'awning']);

/**
 * (E283, Jake's pick: the distance LODs) the pieces with parts thinner than a pixel from
 * a distance: past `from` m the batch draws the piece without them (the cage's and railings' flat bars, the ACs'
 * brackets, the lanterns' cords) — `from` is where the dropped part is ~half a pixel wide on the phone frame (1 px ≈ 1 mm
 * a metre off), so it was a broken dotted line there already
 */
export const PIECE_LOD_FROM: Readonly<Partial<Record<PieceId, number>>> = {
  cage: 40, // bars 1.8 cm, cross bars 2 cm
  balcony: 50, // bars 2.4 cm
  rail: 55, // lattice 2.8 cm
  lantern: 60, // cord 1.5 cm, tassel 3 cm
  acUnit: 70, // brackets 3–4 cm
  balconyTimber: 100, // balusters 5 cm
};
