import paint from './nalati-poi-paint-original.json' with { type: 'json' };
import { originalSpeciesJson } from './nalati-original-species';
import * as v from 'valibot';
import { nalatiOutputRows } from '../../src/shards/nalati-grasslands/generators/output';
import { originalHeldMetadata } from './nalati-held-original';
const rows = v.parse(v.object({ crackBytes: v.array(v.number()), looks: v.unknown(), presentation: v.unknown(), hullBook: v.unknown() }),
  originalSpeciesJson('species.json'));
/** Existing predecessor template only; source/cache product tests call prepareOutput directly. */
export const output: ReturnType<typeof nalatiOutputRows> = nalatiOutputRows(rows, originalHeldMetadata(), paint);
