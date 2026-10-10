/**
 * The sign (E306 / E315 second pass): every shop sign, plaque, paper strip and banner the fragment hangs — hand-bent
 * neon calligraphy on a dark plank board (@wildshard/sdk/looks/neonText: the SDF glyphs lit over their board), a lightbox (a
 * mono atlas word glowing in its tint), a gold-lettered plaque, a paper strip (the menus, the couplets, 福), a cloth
 * banner (麵). One model, its variants the styles; a copy's params are its words, colours and size. The fragment draws
 * them as it always has — the lightboxes, plaques, strips and banners are quads in the one `signs` mesh over the sign
 * atlas, the neon ones the `neon` boards and tubes — and build.ts registers every copy there (`place` with `drawnInto`,
 * `registerSigns`), so a sign costs no draw of its own. Built here alone, centred on the origin and facing +z, for the
 * Model Explorer; a variant's words are ones the fragment hangs (its atlas cell is drawn: the atlas is finished once).
 * SHARD-PLATFORM M3: the build and the copies are the SDK's sign model (@wildshard/sdk/looks/signModel); its row, defaults
 * and variants are data (data/signs.ts).
 */
import type { Object3D } from 'three';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import type { PlacedSign } from '@wildshard/sdk/looks/signs';
import { type SignModelLook, type SignModelParams, registerSignCopies, signParts } from '@wildshard/sdk/looks/signModel';
import { SIGN_DEFAULTS, SIGN_MODEL, SIGN_VARIANTS, type SignStyle } from '../data/signs';
import { ndLook, need } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/signs.ts';

/** a sign copy's params (the SDK sign model's, over Nine Dragon's styles) */
export type SignParams = SignModelParams<SignStyle>;

/** the fragment's calligraphy and sign atlas, as the sign model draws with them */
function signLook(ctx: ModelContext): SignModelLook<SignStyle> {
  const look = ndLook(ctx);
  return { calligraphy: look.calligraphy, atlas: () => need(look.neon, 'the sign atlas') };
}

export const sign = defineModel<SignParams>({
  id: 'nine-dragon-stack/sign', name: 'Sign (neon, lightbox, plaque, paper strip, banner)', category: 'props', pipeline: 'code', file: FILE,
  defaults: SIGN_DEFAULTS,
  variants: SIGN_VARIANTS,
  build: (ctx, p) => signParts(ctx, p, signLook(ctx), SIGN_MODEL),
  specimenYaw: Math.PI, // (the Explorer's camera looks down +z: turned, the sign's face (+z) faces it)
});

/**
 * Register the fragment's signs where they are drawn: the atlas ones on the `signs` mesh, the neon calligraphy on the
 * neon boards (one `place` each; the copies are counted on the one card)
 */
export function registerSigns(ctx: ModelContext, placed: readonly PlacedSign<SignStyle>[], meshes: { readonly atlas: Object3D; readonly neon: Object3D }): void {
  registerSignCopies(sign, ctx, placed, meshes, SIGN_MODEL);
}
