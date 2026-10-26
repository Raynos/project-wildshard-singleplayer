import { nalatiScriptSections } from '../../src/shards/nalati-grasslands/generators/scriptInventory';
import { originalHeldMetadata } from './nalati-held-original';

/** Frozen original admission inventory; production supplies its own freshly constructed held projection. */
export const NALATI_SCRIPT_SECTIONS: ReturnType<typeof nalatiScriptSections> = nalatiScriptSections(originalHeldMetadata().held.program.v2);
