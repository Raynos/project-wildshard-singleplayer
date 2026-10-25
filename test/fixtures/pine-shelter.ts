// oxlint-disable-next-line import/no-nodejs-modules -- Preserve the original executable as an independent test oracle.
import { readFileSync } from 'node:fs';
import metadata from './pine-shelter-program.json' with { type: 'json' };

/** Original authoring bytes; production never imports or encodes this fixture. */
export const PINE_SHELTER_ORIGINAL = { ...metadata,
  bytes: readFileSync('test/fixtures/pine-shelter-program.wasm').toString('base64') };
