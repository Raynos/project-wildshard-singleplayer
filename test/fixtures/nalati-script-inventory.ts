import { NALATI_ADMISSION } from './nalati-admission';
import { NALATI_WEATHER } from './nalati-weather';
import { NALATI_CHARGE } from './nalati-charge';
import { nalatiScriptSections } from '../../src/shards/nalati-grasslands/generators/scriptInventory';
import { NALATI_TITAN_PROGRAMS } from './nalati-titan';
import { NALATI_RIDING_PROGRAMS } from './nalati-riding';
import { NALATI_KOKPAR } from './nalati-kokpar';
import { originalHeldMetadata } from './nalati-held-original';

/** Frozen original admission inventory; production supplies its own freshly constructed held projection. */
export function originalNalatiScriptSections(...args: Parameters<typeof nalatiScriptSections>): ReturnType<typeof nalatiScriptSections> {
  const result = new Map(nalatiScriptSections(...args));
  const rows = result.get('actors/return-scripts');
  if (!Array.isArray(rows)) throw new Error('Missing original script inventory');
  result.set('actors/return-scripts', rows.filter((row: unknown) => typeof row !== 'object' || row === null || !('id' in row) || row.id !== 'practice.course'));
  return result;
}
export const NALATI_SCRIPT_SECTIONS: ReturnType<typeof nalatiScriptSections> = originalNalatiScriptSections(originalHeldMetadata().held.program.v2, NALATI_KOKPAR, NALATI_RIDING_PROGRAMS, NALATI_TITAN_PROGRAMS, NALATI_WEATHER.rows, NALATI_ADMISSION, NALATI_CHARGE.rows);
