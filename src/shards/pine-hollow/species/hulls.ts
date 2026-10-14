import type * as THREE from 'three';
import { loadRigFile } from '@wildshard/engine/anim/rig';
import { TIER } from '@wildshard/engine/core/tier';
import { riggedHulls } from '@wildshard/sdk/looks/riggedHulls';
import coatPages from '../data/coatPages.generated.json' with { type: 'json' };
import { PINE_HULLS } from '../data/creatureHulls';
import { pineCoatUrl, pineCreatureRigUrl } from './rigs';

/**
 * pineCreatures — Pine Hollow's generated creature hulls (PINE-HOLLOW-REMASTER PH-M1 / PH-M2), pre-skinned to the
 * procedural species' own skeletons: the rigged-hull family of data/hulls.ts (`@wildshard/sdk/looks/riggedHulls` loads
 * the rigs, presses the bears' flaps, adopts each variant's baked coat and appends the thralls' glass eyes and fern
 * clumps, baked per tier by generators/bake-pine-thrall-extras.mjs into a node per thrall, `<kind>_<variant>`).
 */
const COAT_PAGES: Readonly<Record<string, { image: string }>> = { ...coatPages.tiers.phone, ...coatPages.tiers.desktop };
const thrallParts = new Map<string, THREE.BufferGeometry>();
let partsLoading: Promise<void> | null = null;
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true;
/** the thralls' baked parts for this tier, once (a failed load leaves the thralls on their bare hulls) */
function loadThrallParts(): Promise<void> {
  partsLoading ??= loadRigFile(TIER === 'phone' ? '/assets/pine-hollow/creatures/thrall-extras.phone.glb' : '/assets/pine-hollow/creatures/thrall-extras.glb')
    .then((gltf) => { gltf.scene.traverse((o) => { if (isMesh(o)) thrallParts.set(o.name, o.geometry); }); return undefined; })
    .catch((e: unknown) => { console.error('[pine-hollow] the thralls\' baked eyes and ferns did not load:', e); });
  return partsLoading;
}

const PINE_CREATURES = riggedHulls(PINE_HULLS, {
  rig: (hull) => pineCreatureRigUrl(hull), coat: (hull, kind, variant) => pineCoatUrl(hull, kind, variant),
  coatImage: (key) => COAT_PAGES[key]?.image, parts: (kind, variant) => thrallParts.get(`${kind}_${variant}`) ?? null,
});

/** every Pine Hollow rig, loaded (the animals boot step: every rig, before a herd spawns); the thralls' parts first, so a
 *  loaded rig always finds them */
export const preloadPineCreatures = (): Promise<void> => loadThrallParts().then(PINE_CREATURES.preload);
/** the rigged hull for (kind, variant) bound to the variant's bones; null → keep the procedural mesh */
export const skinPineHull: typeof PINE_CREATURES.skin = PINE_CREATURES.skin;
