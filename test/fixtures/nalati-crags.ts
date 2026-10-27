// oxlint-disable-next-line import/no-nodejs-modules -- The committed native lattice feeds the crag construction.
import { readFileSync } from 'node:fs';
import { nalatiCragRock, type NalatiCragRows } from '../../src/shards/nalati-grasslands/generators/cragRockProgram';

/** The crag rows as the product builds them (GR6), over the committed lattice. */
export const nalatiCragRows: NalatiCragRows = nalatiCragRock(new Uint8Array(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin'))).rows;
