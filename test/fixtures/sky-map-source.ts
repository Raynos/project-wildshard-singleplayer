// oxlint-disable-next-line import/no-nodejs-modules -- Only tracked original native inputs enter the map fixture bank.
import { readFileSync } from 'node:fs';
import { SKY_MAP_INPUTS } from '../../src/shards/far-reach/generators/bake-map.mjs';

export function originalSkyMapInputs(): Map<string, Uint8Array> {
  return new Map(SKY_MAP_INPUTS.map(url => [url, new Uint8Array(readFileSync(`public${url}`))]));
}
