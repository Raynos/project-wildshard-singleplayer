import { parsePineSpots } from './sections';
import rows from '../data/spotsRows.json' with { type: 'json' };

function spotRows() {
  const { notice: _notice, ...spots } = rows;
  const payload = { version: 1, profile: 'authored rows', notice: 'DO NOT EDIT: regenerate with generators/spots.ts (pine-spots).', ...spots };
  parsePineSpots(payload);
  return payload;
}
/** G350-PH: Pine Hollow's quest spots from authoring inputs only: the authored rows (each placed interactable and its
 * prompt, the speakers, the lodge board, the talk, lanterns, zipline and lever-action). No world or runtime code runs.
 * GR8: called by the product and the shared pickups bake (no scheduler job, no generated file). */
export const pineSpots: () => ReturnType<typeof spotRows> = spotRows;
