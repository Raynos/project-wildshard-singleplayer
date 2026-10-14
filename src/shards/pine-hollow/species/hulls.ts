import { riggedHulls } from '@wildshard/sdk/looks/riggedHulls';
import { pineThrallExtras } from '../runtime/looks/riggedHulls';
import coatPages from '../data/coatPages.generated.json' with { type: 'json' };
import { PINE_HULLS } from '../data/creatureHulls';
import { pineCoatUrl, pineCreatureRigUrl } from './rigs';

/**
 * pineCreatures — Pine Hollow's generated creature hulls (PINE-HOLLOW-REMASTER PH-M1 / PH-M2), pre-skinned to the
 * procedural species' own skeletons: the rigged-hull family of data/hulls.ts (`@wildshard/sdk/looks/riggedHulls` loads
 * the rigs, presses the bears' flaps, adopts each variant's baked coat; runtime/looks/riggedHulls.ts adds the thralls' eyes and
 * ferns).
 */
const COAT_PAGES: Readonly<Record<string, { image: string }>> = { ...coatPages.tiers.phone, ...coatPages.tiers.desktop };
const PINE_CREATURES = riggedHulls(PINE_HULLS, {
  rig: (hull) => pineCreatureRigUrl(hull), coat: (hull, kind, variant) => pineCoatUrl(hull, kind, variant),
  coatImage: (key) => COAT_PAGES[key]?.image, extras: pineThrallExtras,
});

/** every Pine Hollow rig, loaded (the animals boot step: every rig, before a herd spawns) */
export const preloadPineCreatures: () => Promise<void> = PINE_CREATURES.preload;
/** the rigged hull for (kind, variant) bound to the variant's bones; null → keep the procedural mesh */
export const skinPineHull: typeof PINE_CREATURES.skin = PINE_CREATURES.skin;
