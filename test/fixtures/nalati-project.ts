import { readProjectAssets } from '../../src/sdk/project';
import { runSnapshot } from './runSnapshot';

/** Nalati's project read over its author folder and public/assets, as the shipped-product suites read it (CI7: once per
 *  CI run, else per importing file). */
export function readNalatiProject(): ReturnType<typeof readProjectAssets> {
  return runSnapshot('nalati-project', () => readProjectAssets('src/shards/nalati-grasslands', undefined, { folder: 'nalati-grasslands', imageRoots: [
    { prefix: '/src/shards/nalati-grasslands/', directory: 'src/shards/nalati-grasslands' },
    { prefix: '/assets/', directory: 'public/assets' },
  ] }));
}
