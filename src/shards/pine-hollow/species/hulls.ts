import { riggedHulls } from '@wildshard/sdk/species/riggedHulls';
import { PINE_HULLS } from '../data/hulls';
import { pineCoatUrl, pineCreatureRigUrl } from './rigs';

/**
 * pineCreatures — Pine Hollow's generated creature hulls (PINE-HOLLOW-REMASTER PH-M1 / PH-M2), pre-skinned to the
 * procedural species' own skeletons: the rigged-hull family of data/hulls.ts (`@wildshard/sdk/species/riggedHulls` loads
 * the rigs, presses the bears' flaps, paints or adopts each variant's coat and adds the thralls' eyes and ferns).
 */
const PINE_CREATURES = riggedHulls(PINE_HULLS, { rig: (hull) => pineCreatureRigUrl(hull), coat: (hull, kind, variant) => pineCoatUrl(hull, kind, variant) });

/** every Pine Hollow rig, loaded (the animals boot step: every rig, before a herd spawns) */
export const preloadPineCreatures: () => Promise<void> = PINE_CREATURES.preload;
/** the rigged hull for (kind, variant) bound to the variant's bones; null → keep the procedural mesh */
export const skinPineHull: typeof PINE_CREATURES.skin = PINE_CREATURES.skin;
/** the coat bake's source (scripts/bake-coats.mjs, through the `harness.shard.pine-hollow` capture handle's `coats`) */
export const pineCoatSources: typeof PINE_CREATURES.coatSources = PINE_CREATURES.coatSources;
