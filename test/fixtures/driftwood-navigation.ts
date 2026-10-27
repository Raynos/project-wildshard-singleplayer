// oxlint-disable-next-line import/no-nodejs-modules -- The fixture decodes the tracked original native source, never a generated header.
import { readFileSync } from 'node:fs';
import { driftwoodNavigationRows, DRIFTWOOD_NAVIGATION_INPUT } from '../../src/shards/driftwood-isle/generators/navigation';
export const DRIFTWOOD_NAVIGATION = driftwoodNavigationRows(new Uint8Array(readFileSync(`src/shards/driftwood-isle/${DRIFTWOOD_NAVIGATION_INPUT}`)));
