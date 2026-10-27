import { driftwoodReefBank } from './reefBank';

/** The authored specimen keys and immutable world alias. */
export interface ReefFileAliases {
  readonly coral: Readonly<Record<'default' | 'brain' | 'staghorn' | 'fan' | 'tube', string>>;
  readonly weed: Readonly<Record<'default' | 'tint-0' | 'tint-1' | 'tint-2' | 'tint-3', string>>;
  readonly star: Readonly<Record<'default' | 'tint-0' | 'tint-1' | 'tint-2', string>>;
  readonly world: string;
}

/** Resolve the original content identities only from this producer's owned aliases.
 * Missing or ambiguous records refuse; no public generated file is borrowed. */
export function reefFilesFrom(byUrl: Readonly<Record<string, string>>): ReefFileAliases {
  const file = (hash: string, kind: 'glb' | 'bin'): string => {
    const matches = Object.keys(byUrl).filter(url => url.endsWith(`/reef-${hash}.${kind}`));
    const [url] = matches;
    if (matches.length !== 1 || url === undefined) throw new Error(`Reef content identity needs one owned alias: ${hash}.${kind}`);
    return url;
  };
  return {
  "coral": {
    "default": file('02f2b47255677bc4a8cd39bd108b926f880c5537cd3b1cc2c1a6d7f19f4aab9c', 'glb'),
    "brain": file('02f2b47255677bc4a8cd39bd108b926f880c5537cd3b1cc2c1a6d7f19f4aab9c', 'glb'),
    "staghorn": file('572d17e81fc703118e1d90987463b8a564ffad60eaa675bd408858ed0c923f5b', 'glb'),
    "fan": file('9fbf2206037c0395af83166dfe7b68b090f8973b3a3ba3657b694d5758209841', 'glb'),
    "tube": file('51e9132044fad3eeb9d3aef9c66d946469bfbea505b8cfcaba65324df918b7fb', 'glb')
  },
  "weed": {
    "default": file('9b514bf9dc7b3d427ceab2a1f931e90818ddea3a70a6f7e4dcb5ca55415e9b51', 'glb'),
    "tint-0": file('9b514bf9dc7b3d427ceab2a1f931e90818ddea3a70a6f7e4dcb5ca55415e9b51', 'glb'),
    "tint-1": file('a0e8fa576978c14e5252dc37df430d6ade9aff4bef95a0887d0e7afb9ee58fc1', 'glb'),
    "tint-2": file('61f3569798f8fc19e5b2920e3f669c231f27eb6bfa2d42ae8caf42f9d225c3ba', 'glb'),
    "tint-3": file('3f47d6ebfe8205ec34f7719102d6f9e5d9a7373d78643a49d475793175f22b13', 'glb')
  },
  "star": {
    "default": file('45877f4c35af380f7d7e1acdfaf3637fc33b3f727fa0449be78484026132eff9', 'glb'),
    "tint-0": file('45877f4c35af380f7d7e1acdfaf3637fc33b3f727fa0449be78484026132eff9', 'glb'),
    "tint-1": file('c0858d03822e7b99f4f259ac5e3adff466f3e600d15a1d4021b7b8ed853bf719', 'glb'),
    "tint-2": file('75230cd7b309506697a43599b6ef36d0e69dd07f4de5bdc5482cc69b65009687', 'glb')
  },
  "world": file('2485e39982beb460e69e164562f178b6214cc080bedfa8e17281d8bd86a9f8f6', 'bin')
} as const;
}

/** Original ordered reef aliases, resolved from freshly constructed owned bytes. */
export const REEF_FILES = reefFilesFrom(driftwoodReefBank().byUrl);
