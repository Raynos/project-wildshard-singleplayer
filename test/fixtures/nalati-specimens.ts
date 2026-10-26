// oxlint-disable-next-line import/no-nodejs-modules -- Supply the original authored inputs and packed metadata to defining admission.
import { readFileSync } from 'node:fs';
import { nalatiDressingSpecimens } from '../../src/shards/nalati-grasslands/generators/dressingScene';

const read = (name: string): unknown => JSON.parse(readFileSync(`src/shards/nalati-grasslands/data/${name}.json`, 'utf8'));
/** Original specimen values come from the source composer, without the generated specimen declaration. */
export const nalatiSpecimens = nalatiDressingSpecimens(read('campCatalogue'), read('campMaterials'), JSON.parse(readFileSync('test/fixtures/nalati-packed-specimens-original.json', 'utf8')));
