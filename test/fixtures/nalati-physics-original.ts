// oxlint-disable-next-line import/no-nodejs-modules -- Read the complete independently retained original metadata for native proof controls.
import { readFileSync } from 'node:fs';
import { hashImmutableBytes } from '../../src/sdk/immutable';

/** Original 763,286-byte metadata, independent of the replacement source constructor. */
export function originalNalatiPhysics(): unknown {
  const bytes = new Uint8Array(readFileSync('test/fixtures/nalati-physics-original.json'));
  if (bytes.length !== 763286 || hashImmutableBytes(bytes) !== '1d74aa8e39f172b53a024210d3fed205efc9524b287b5c32861148c2727e64e4') throw new Error('Original Nalati physics metadata differs');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
}
