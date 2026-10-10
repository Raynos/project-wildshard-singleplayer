import skins from './skins.json' with { type: 'json' };

/**
 * The template's creature looks (SHARD-PLATFORM SF16): the SF9c exported grey blob and boar, drawn by the client's
 * `platform.skin` recipe and animated from the creature's state (`platform.clips`; the export sampled the attack over
 * 1 s). `scripts/bake/template-skins.mjs` writes `skins.json` and the content-addressed files.
 */
export const INK_SKIN_LOOKS = skins.map((entry) => ({ id: entry.look, species: entry.species, recipe: 'platform.skin', material: null,
  parameters: { skin: entry.skin }, animation: { recipe: 'platform.clips', parameters: { attackSpan: 1 } } }));
/** Each skin's json file and its GLB, library roots (admitted, leased and charged with the level). */
export const INK_SKIN_FILES = skins.flatMap((entry) => entry.files);
export const INK_SKIN_LIBRARY = skins.map((entry) => entry.skin);
/** What the skins add to the library budget. */
export const INK_SKIN_COST = INK_SKIN_FILES.reduce((sum, file) => ({ resident: sum.resident + file.decoded + file.gpu, compressed: sum.compressed + file.compressed }), { resident: 0, compressed: 0 });
