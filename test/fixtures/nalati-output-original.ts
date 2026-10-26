// oxlint-disable-next-line import/no-nodejs-modules -- Preserve the full original species metadata for independent predecessor oracles.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { nalatiOutputRows } from '../../src/shards/nalati-grasslands/generators/output';
const rows = v.parse(v.object({ crackBytes: v.array(v.number()), looks: v.unknown(), presentation: v.unknown(), hullBook: v.unknown() }),
  JSON.parse(readFileSync('src/shards/nalati-grasslands/data/species.generated.json', 'utf8')));
/** Existing predecessor template only; source/cache product tests call prepareOutput directly. */
export const output: ReturnType<typeof nalatiOutputRows> = nalatiOutputRows(rows);
