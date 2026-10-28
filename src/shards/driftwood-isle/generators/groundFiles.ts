import { driftwoodFacetedGroundBank } from './facetedGroundBank';

/** The original ground draw slots, resolved from their producer's owned aliases. */
export interface GroundFileAliases {
  readonly ground: string;
  readonly slab: string;
}

/** Each ground part must have one producer-owned public alias. */
export function groundFilesFrom(byUrl: Readonly<Record<string, string>>): GroundFileAliases {
  const file = (name: string): string => {
    const matches = Object.entries(byUrl).filter(([, value]) => value === name);
    const [match] = matches;
    if (matches.length !== 1 || match === undefined) throw new Error(`Ground part needs one owned alias: ${name}`);
    return match[0];
  };
  return { ground: file('world/ground/ground.glb'), slab: file('world/ground/slab.glb') };
}

/** Content URLs come from the same bank that supplies the admitted product bytes. */
export const GROUND_FILES = groundFilesFrom(driftwoodFacetedGroundBank().byUrl);
