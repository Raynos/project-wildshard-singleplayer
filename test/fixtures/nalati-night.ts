import { nalatiNightRows } from '../../src/shards/nalati-grasslands/generators/nightRows';
import { NALATI_WEATHER } from './nalati-weather';

/** GR6: the night roster rows as the product builds them (nightRows.ts) around the compiled weather decision; the retired
 *  job's data/night.generated.json no longer exists. */
export const NALATI_NIGHT: ReturnType<typeof nalatiNightRows> = nalatiNightRows({ script: NALATI_WEATHER.rows.script, bytes: NALATI_WEATHER.rows.bytes });
