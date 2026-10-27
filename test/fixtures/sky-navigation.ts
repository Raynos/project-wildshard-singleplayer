// oxlint-disable-next-line import/no-nodejs-modules -- Read the original tracked immutable navigation input, never its copied handoff.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the fixture to the repository's author folder.
import { resolve } from 'node:path';
import { skyNavigationRows, SKY_NAVIGATION_INPUT, type SkyNavigationRows } from '../../src/shards/far-reach/generators/navigation';

/** Original declaration input; the defining constructor verifies its complete immutable hash. */
export function originalSkyNavigation(): SkyNavigationRows {
  return skyNavigationRows(new Uint8Array(readFileSync(resolve('src/shards/far-reach', SKY_NAVIGATION_INPUT))));
}
