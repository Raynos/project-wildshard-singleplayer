import { islandFoliageBatches } from './islandDressing';

/** Original ordered content aliases, owned by the same foliage bank that emits their bytes. */
export type PalmFileAliases = Readonly<Record<'phone' | 'desktop', Readonly<Record<'world' | 'tall' | 'young' | 'leaning', string>>>>;

/** Missing or ambiguous identities refuse; no generated public file is borrowed. */
export function palmFilesFrom(byUrl: Readonly<Record<string, string>>): PalmFileAliases {
  const file = (hash: string, kind: 'glb' | 'bin'): string => {
    const matches = Object.keys(byUrl).filter(url => url.endsWith(`/palm-${hash}.${kind}`));
    const [url] = matches;
    if (matches.length !== 1 || url === undefined) throw new Error('Foliage content identity requires one owned alias');
    return url;
  };
  return {
  phone: {
    world: file('b215817e315b21685f4860a94a6e706466ffaf53ac9edc4d1c29fec3aa6f2392', 'bin'),
    tall: file('d36d04bdd1422b63288cafb727786e9620dc834b71f97cc57ed31c9bd9c89778', 'glb'),
    young: file('885ecf0eaf989af2eb5230df72afa3a05db302c2fe0b601f5cb2163fad08d67b', 'glb'),
    leaning: file('e94d0aac993f41fd5896fa109e66363f828df28f0b8bf9a1e57cba632a17fb06', 'glb'),
  },
  desktop: {
    world: file('4a6d31124c14498f867d244c61c244b9855701711a051781f938e0a1df1a4e88', 'bin'),
    tall: file('f602a3eaae282c8dd8ac6deab657f2e48f07f10c29222c5e2ae3f6c1e0553055', 'glb'),
    young: file('558b3f163eae01e096627eab4aee28e80fa108de7b50c0a29d9781b245da16d3', 'glb'),
    leaning: file('f1068c4fcd0adadb4f85e0c48b99391046f09a722b182de67ca1d04bab0220f6', 'glb'),
  },
  };
}
export const PALM_FILES = palmFilesFrom(islandFoliageBatches().byUrl);
