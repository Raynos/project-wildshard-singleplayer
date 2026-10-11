import { parseNpcRow } from '@wildshard/sdk/questGraph';
import { SCOUT_ROW } from '../data/questPresentation';

/** Sefa's generated model (data/files.ts DUNE_MODELS), selected by her authored figure. */
export const SCOUT_MODEL = SCOUT_ROW.figure.model;
/** Compile the authored NPC with the existing quest schema before either native owner installs it. */
export const SCOUT_NPC = parseNpcRow(SCOUT_ROW);
