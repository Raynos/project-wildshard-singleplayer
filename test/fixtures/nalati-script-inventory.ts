import { NALATI_WEATHER } from './nalati-weather';
import { nalatiScriptSections } from '../../src/shards/nalati-grasslands/generators/scriptInventory';
import { NALATI_TITAN_PROGRAMS } from './nalati-titan';
import { NALATI_RIDING_PROGRAMS } from './nalati-riding';
import { NALATI_KOKPAR } from './nalati-kokpar';
import { originalHeldMetadata } from './nalati-held-original';

/** Frozen original admission inventory; production supplies its own freshly constructed held projection. */
export const NALATI_SCRIPT_SECTIONS: ReturnType<typeof nalatiScriptSections> = nalatiScriptSections(originalHeldMetadata().held.program.v2, NALATI_KOKPAR, NALATI_RIDING_PROGRAMS, NALATI_TITAN_PROGRAMS, NALATI_WEATHER.rows);
