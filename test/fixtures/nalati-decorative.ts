// oxlint-disable-next-line import/no-nodejs-modules -- Prepare original native author metadata before scene assertions.
import { readFileSync } from 'node:fs';
import { withPortableMath } from '../../src/commons/bake/portableMath';
import { decorativeRows } from '../../src/shards/nalati-grasslands/generators/decorativeInput';

/** Complete native profiles; no retired generated scene or decorative metadata is read. */
export const nalatiDecorative = withPortableMath(() => decorativeRows(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin')));
