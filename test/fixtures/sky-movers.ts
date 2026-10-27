// oxlint-disable-next-line import/no-nodejs-modules -- The original native header is tracked source, not an ignored product.
import { readFileSync } from 'node:fs';
import { skyMoverRows, SKY_MOVER_HEADER_INPUT } from '../../src/shards/far-reach/generators/moverHeader';

export function originalSkyMovers(): ReturnType<typeof skyMoverRows> {
  return skyMoverRows(new Uint8Array(readFileSync(`src/shards/far-reach/${SKY_MOVER_HEADER_INPUT}`)));
}

/** Keep the independent original JSON field order for the predecessor wire oracle. */
export function originalSkyMoverTransport(): unknown {
  const value: unknown = JSON.parse(readFileSync(`src/shards/far-reach/${SKY_MOVER_HEADER_INPUT}`, 'utf8'));
  return value;
}
