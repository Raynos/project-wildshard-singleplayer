import { NALATI_ADMISSION } from './nalati-admission';
import { NALATI_WEATHER } from './nalati-weather';
import { NALATI_CHARGE } from './nalati-charge';
import query from './nalati-query-terrain-original.json' with { type: 'json' };
import { NALATI_TITAN_PROGRAMS } from './nalati-titan';
import { NALATI_RIDING_PROGRAMS } from './nalati-riding';
import { NALATI_KOKPAR } from './nalati-kokpar';
import navigation from './nalati-navigation-original.json' with { type: 'json' };
import { parseShardfileField } from '../../src/sdk/shardfile';
import { nalatiProductRows } from '../../src/shards/nalati-grasslands/generators/product';

type Inputs = Parameters<typeof nalatiProductRows>;
const terrain = parseShardfileField('terrain', query.terrain);
const navigationRows = parseShardfileField('navigation', navigation.navigation);
if (terrain === null || navigationRows === null) throw new Error('Missing original Nalati spatial inputs');
const queryRows = { terrain, files: parseShardfileField('files', query.files), critical: parseShardfileField('critical', query.critical) };
const nav = { navigation: navigationRows, files: parseShardfileField('files', navigation.files), critical: parseShardfileField('critical', navigation.critical) };

/** Original complete spatial inputs for unchanged header/cost controls; never a live source fallback. */
export function originalNalatiProductRows(species: Inputs[0], held: Inputs[1], render: Inputs[2]): ReturnType<typeof nalatiProductRows> {
  return nalatiProductRows(species, held, render, queryRows, nav, NALATI_KOKPAR, NALATI_RIDING_PROGRAMS, NALATI_TITAN_PROGRAMS, NALATI_WEATHER, NALATI_ADMISSION, NALATI_CHARGE.rows, program => atob(program.bytes).length);
}
