import rows from '../data/spotsRows.json' with { type: 'json' };

/** G350-PH: Pine Hollow's quest spots from authoring inputs only: the authored rows (each placed interactable and its
 * prompt, the speakers, the lodge board, the talk, lanterns, zipline and lever-action). No world or runtime code runs. */
export function pineSpots(): Record<string, unknown> {
  const { notice: _notice, ...spots } = rows;
  return { version: 1, profile: 'authored rows', notice: 'DO NOT EDIT: regenerate with generators/spots.ts (pine-spots).', ...spots };
}
