import { NALATI_WEATHER } from './nalati-weather';
import { NALATI_CHARGE } from './nalati-charge';
import paint from './nalati-poi-paint-original.json' with { type: 'json' };
import { NALATI_TITAN_PROGRAMS } from './nalati-titan';
import { NALATI_RIDING_PROGRAMS } from './nalati-riding';
import { NALATI_KOKPAR } from './nalati-kokpar';
import { originalSpeciesJson } from './nalati-original-species';
import * as v from 'valibot';
import { nalatiOutputRows } from '../../src/shards/nalati-grasslands/generators/output';
import { originalHeldMetadata } from './nalati-held-original';
import { nalatiCover } from './nalati-cover';
import { nalatiGrass } from './nalati-grass-bake';
import { nalatiSpear } from './nalati-spear';
import { NALATI_VIEW_BLOBS } from './nalati-view-modules';
const rows = v.parse(v.object({ crackBytes: v.array(v.number()), looks: v.unknown(), presentation: v.unknown(), hullBook: v.unknown() }),
  originalSpeciesJson('species.json'));
/** Existing predecessor template only; source/cache product tests call prepareOutput directly. */
export const output: ReturnType<typeof nalatiOutputRows> = nalatiOutputRows(rows, originalHeldMetadata(), paint, nalatiCover, nalatiGrass, nalatiSpear.rows, NALATI_VIEW_BLOBS, NALATI_KOKPAR, NALATI_RIDING_PROGRAMS, NALATI_TITAN_PROGRAMS, NALATI_WEATHER, NALATI_CHARGE.rows);
