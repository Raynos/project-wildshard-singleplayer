// oxlint-disable-next-line import/no-nodejs-modules -- Prepare native test metadata without a generated runtime handoff.
import { readFileSync } from 'node:fs';
import { nalatiRuntimeRows } from '../../src/shards/nalati-grasslands/generators/runtimeRows';

const places: unknown = JSON.parse(readFileSync('src/shards/nalati-grasslands/data/places.json', 'utf8'));
const paint: unknown = JSON.parse(readFileSync('src/shards/nalati-grasslands/data/poiPaint.json', 'utf8'));
/** Original native metadata flows through the defining pure preparation algorithm. */
export const nalatiRuntime = nalatiRuntimeRows({ places, paint }).runtime;
