import rows from './islets.generated.json' with { type: 'json' };
import { parseSocketLift } from '@wildshard/format/socketLift';
import { ISLET_EDGES } from './isletDesign';

/** Four admitted cached links in native edge order; no layout derivation runs in the client. */
export const ISLET_LIFTS = ISLET_EDGES.map((edge, index) => {
  const row = rows.lifts[index];
  if (row === undefined || row.edge !== edge) throw new Error('Malformed generated Rising Islet link');
  return { edge, lift: parseSocketLift(row.lift) };
});
