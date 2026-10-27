import rows from '../data/spotsRows.json' with { type: 'json' };

/** G350-DW: Driftwood's quest spots from authoring inputs only: the authored rows (each placed interactable and its prompt,
 * the talk, sword and reward spots, the zipline and the ordered prompt registrations). No world or runtime code runs. */
export function driftwoodSpots(): Omit<typeof rows, 'notice'> & { version: 1; profile: 'authored rows'; notice: string } {
  const { notice: _notice, ...spots } = rows;
  return { version: 1, profile: 'authored rows', notice: 'DO NOT EDIT: regenerate with generators/spots.ts (driftwood-spots).', ...spots };
}

/** The defining authored spot table, shared by declaration and proof readers. */
export const DRIFTWOOD_SPOTS = driftwoodSpots();
