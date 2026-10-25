// oxlint-disable-next-line import/no-nodejs-modules -- Independent pre-conversion Wasm oracle; production never imports or encodes it.
import { readFileSync } from 'node:fs';
import metadata from './pine-life-program.json' with { type: 'json' };

/** Reconstruct the original standalone test program from its exact native bytes. */
export const PINE_LIFE_ORIGINAL = { ...metadata,
  bytes: readFileSync('test/fixtures/pine-life-program.wasm').toString('base64') };
