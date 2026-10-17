import type * as THREE from 'three';
import { loadRigFile, rigRoot } from '@wildshard/engine/anim/rig';
import { TIER } from '@wildshard/engine/core/tier';
import { riggedHulls, type RiggedHullFamilyRow, type RiggedHulls } from '@wildshard/sdk/looks/riggedHulls';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import coatPages from '../../data/coatPages.generated.json' with { type: 'json' };
import hulls from '../../data/creatureHulls.json' with { type: 'json' };
import { pineCoatUrl, pineRigFiles } from './rigs';

/**
 * pineCreatures — Pine Hollow's generated creature hulls (PINE-HOLLOW-REMASTER PH-M1 / PH-M2), pre-skinned to the
 * procedural species' own skeletons: the rigged-hull family of data/hulls.ts (`@wildshard/sdk/looks/riggedHulls` loads
 * the rigs, presses the bears' flaps, adopts each variant's baked coat and appends the thralls' glass eyes and fern
 * clumps, baked per tier by generators/bake-pine-thrall-extras.mjs into a node per thrall, `<kind>_<variant>`). The rigs
 * and their separate KTX2 maps are the product's named blobs (rigs.ts `pineRigFiles`, W2a).
 */
const rgb = ([r = 0, g = 0, b = 0]: readonly number[]): [number, number, number] => [r, g, b];
/** the family row (../../data/creatureHulls.json, the generators' coat recipes beside it): its hulls, flaps and fur tones */
const PINE_HULLS: RiggedHullFamilyRow = { ...hulls, fur: Object.fromEntries(Object.entries(hulls.fur).map(([hull, coats]) =>
  [hull, Object.fromEntries(Object.entries(coats).map(([id, f]) => [id, { rim: rgb(f.rim), sheenColor: rgb(f.sheenColor) }]))])) };
const COAT_PAGES: Readonly<Record<string, { image: string }>> = { ...coatPages.tiers.phone, ...coatPages.tiers.desktop };
const thrallParts = new Map<string, THREE.BufferGeometry>();
let partsLoading: Promise<void> | null = null;
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true;
/** the thralls' baked parts for this tier (the product's named blobs), once (a failed load leaves the thralls on their bare
 *  hulls) */
function loadThrallParts(product: ShardProduct): Promise<void> {
  partsLoading ??= loadRigFile(product.url(TIER === 'phone' ? 'models/creatures/thrall-extras.phone.glb' : 'models/creatures/thrall-extras.glb'))
    .then((gltf) => { rigRoot(gltf).traverse((o) => { if (isMesh(o)) thrallParts.set(o.name, o.geometry); }); return undefined; })
    .catch((e: unknown) => { console.error('[pine-hollow] the thralls\' baked eyes and ferns did not load:', e); });
  return partsLoading;
}

/** the family on the product's blob URLs (content-addressed: one family while they stay the same) */
let family: { readonly key: string; readonly hulls: RiggedHulls } | null = null;
function pineCreatures(product: ShardProduct): RiggedHulls {
  const files = pineRigFiles(product, PINE_HULLS.rigs), key = JSON.stringify(files);
  if (family?.key !== key) {
    family = { key, hulls: riggedHulls(PINE_HULLS, {
      files, coat: (hull, kind, variant) => pineCoatUrl(hull, kind, variant),
      coatImage: (coat) => COAT_PAGES[coat]?.image, parts: (kind, variant) => thrallParts.get(`${kind}_${variant}`) ?? null,
    }) };
  }
  return family.hulls;
}

/** every Pine Hollow rig, loaded (the animals boot step: every rig, before a herd spawns); the thralls' parts first, so a
 *  loaded rig always finds them. The rigs, their maps and the thralls' parts are named blobs of the first-party product
 *  the world shares (a species look's preload takes no arguments, so it loads that product itself). */
export async function preloadPineCreatures(): Promise<void> {
  const product = await (await import('@wildshard/game/shardfile/runtimeProduct')).loadFirstPartyProduct('pine-hollow');
  await loadThrallParts(product);
  await pineCreatures(product).preload();
}
/** the rigged hull for (kind, variant) bound to the variant's bones; null → keep the procedural mesh (or not preloaded) */
export const skinPineHull: RiggedHulls['skin'] = (kind, variant, bones) => family?.hulls.skin(kind, variant, bones) ?? null;
