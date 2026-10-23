// oxlint-disable-next-line import/no-nodejs-modules -- Native fixtures read only the remaining unconverted source assets.
import fs from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- These fixture programs run from the repository root.
import { resolve } from 'node:path';
import { templateTerrain } from '../../src/shards/_template/generators/terrain';
import { templateProduct } from '../../src/shards/_template/generators/product';

const { assets: terrain, ...rows } = templateTerrain();
/** Native tests consume producer rows and bytes; other readers still need the product module's legacy default. */
export const TEMPLATE_SOURCE = templateProduct(rows);
/** Preserve independently owned input bytes for each admission. Other producers migrate in subsequent GR1 slices. */
export function templateAssets(): Map<string, Uint8Array> {
  return new Map(TEMPLATE_SOURCE.files.map(file => [file.hash,
    new Uint8Array(terrain.get(file.hash) ?? fs.readFileSync(resolve('src/shards/_template/assets', file.hash)))]));
}
