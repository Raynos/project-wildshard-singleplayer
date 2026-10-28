import { islandFoliageBatches } from './islandDressing';

/** Original ordered content aliases, owned by the same foliage bank that emits their bytes. */
export type HibiscusFileAliases = Readonly<Record<'phone' | 'desktop', Readonly<Record<'world' | 'flowering' | 'leaf' | 'small', string>>>>;

/** Missing or ambiguous identities refuse; no generated public file is borrowed. */
export function hibiscusFilesFrom(byUrl: Readonly<Record<string, string>>): HibiscusFileAliases {
  const file = (hash: string, kind: 'glb' | 'bin'): string => {
    const matches = Object.keys(byUrl).filter(url => url.endsWith(`/hibiscus-${hash}.${kind}`));
    const [url] = matches;
    if (matches.length !== 1 || url === undefined) throw new Error('Foliage content identity requires one owned alias');
    return url;
  };
  return {
  phone: {
    world: file('3e1779a84ad4aaf5d2814319d916ca58a30a6c63aca6c0ebf83ef0ec14f6bae6', 'bin'),
    flowering: file('2c6a70b68edfffabe89d0ac2e9da6b8c4a966a48c208b682c11d13a6a9d08a3b', 'glb'),
    leaf: file('c40be28442e3c90e29daf344584f0a5a1755208bbecef90885550bed34877b5a', 'glb'),
    small: file('aeac7ca64346bdd2fada7caef7282ecf48239405035dfe80c034511c321ff606', 'glb'),
  },
  desktop: {
    world: file('38a4f8b6ba5c423dfa20a693ea244abf4f153305d869d71f22e2c2b2742af22d', 'bin'),
    flowering: file('acbca3a2e7648a25850a9a4136c6d9a029b8e40e783864040d27898c9fa0e975', 'glb'),
    leaf: file('1de27243c39cec65d43d65c46a92e3c434ffc74a1a04d46dc390c44db1043232', 'glb'),
    small: file('fc5bf4dab40c5ef822fb213527b18e8ebeb6c12f5482660113baf1476d3abe74', 'glb'),
  },
  };
}
export const HIBISCUS_FILES = hibiscusFilesFrom(islandFoliageBatches().byUrl);
