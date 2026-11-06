// oxlint-disable-next-line import/no-nodejs-modules -- A proof reads the bake's own files.
import { readFileSync } from 'node:fs';
import { readGridCollision, type GridCollisionStrip } from '../../src/game/shared/grid/gridCollision';

/** The road's collision as the bake left it, for a proof whose worker is not the deployed one. */
export function bakedGridCollision(): Promise<readonly GridCollisionStrip[]> {
  return Promise.resolve(readGridCollision(JSON.parse(readFileSync('out/.app/grid-collision/strips.json', 'utf8')), readFileSync('out/.app/grid-collision/shapes.bin')));
}
