import { createModelLibrary, undrawnRig } from '@wildshard/sdk/looks/modelLibrary';
import { creatureBodies } from '@wildshard/game/plugin/geometry';
import { SKITTERER_BODY } from '../data/species/skitterer';
import { STRIDER_BODY } from '../data/striderRig.baked';
import { RAY_BODY } from '../data/species/duneRay';
import { applySurfaceLooks } from '@wildshard/game/systems/looks/surfaceLooks';
import type { SurfaceLook } from '@wildshard/format/surfaceLooks';
import { FIRE_LIGHTS } from './fireFx';
import { DUSK } from '../look/dusk';
import { CAMP_SURFACE } from '../data/surfaces';
import { DUNE_MODELS, DUNE_RIGS, DUNE_RIG_URLS, type DuneRigName } from '../data/files';
import type { BufferGeometry, MeshStandardMaterial } from 'three';

/**
 * Signal Dunes' generated models (C6, E374): codex refs → Hunyuan3D-2 → faceted, vertex-coloured GLBs, the textured hero
 * models and the baked creature rigs, loaded once behind the loading screen (`preloadDuneMeshes`, the plugin's `world`
 * hook) by the SDK model library from `data/files.ts` DUNE_MODELS. A model that fails to load is a page fault, never a
 * silent stand-in: the places and the tower stand undrawn without it.
 */

/** The live inputs Signal's surface rows read: the fires' light slots and the dusk. */
const SURFACE_INPUTS = { lights: FIRE_LIGHTS, dusk: DUSK };
const MODELS = createModelLibrary(DUNE_MODELS, '[sunscar-dunes]', SURFACE_INPUTS);
const BODIES = creatureBodies({ creatures: DUNE_RIGS, urls: DUNE_RIG_URLS, standIns: { skitterer: SKITTERER_BODY, strider: STRIDER_BODY, ray: RAY_BODY, matriarch: RAY_BODY }, fault: '[sunscar-dunes]' });

/** Load every generated model and baked creature body once (a failed one is skipped and faulted). */
export const preloadDuneMeshes = (): Promise<void> => Promise.all([MODELS.preload(), BODIES.preload()]).then(() => undefined);
/** A copy of a loaded model's geometry, or null (not loaded: use the code model). */
export const duneMesh = MODELS.mesh;
/** A copy of a baked creature body (bones, skin, dims), else its undrawn stand-in on its skeleton (its load was faulted). */
export const duneBody = BODIES.bodyOrStandIn;
/** A copy of a baked creature body, or null (not loaded): the physics bake refuses the stand-in. */
export const duneBakedBody = BODIES.body;
/** A baked creature body's skin alone (the Model Explorer's specimen). */
export const duneBodyGeometry = (creature: DuneRigName): BufferGeometry => duneBody(creature).hardParts[0] ?? undrawnRig();
/** A textured hero model fitted (turned, centred, its lowest point at its floor, sized), or null when it did not load. */
export const duneHd = MODELS.hd;
/** A camp material warmed by each burning fire within ~4.5 m (`data/surfaces.ts` FIRELIGHT): its own fire lights it. */
export const warmByFire = (m: MeshStandardMaterial): void => { applySurfaceLooks(m, CAMP_SURFACE, SURFACE_INPUTS); };
/** A code-built held part's surface rows (the coil's viewer light and sheen) over the shared inputs. */
export const heldSurface = (m: MeshStandardMaterial, looks: readonly SurfaceLook[]): void => { applySurfaceLooks(m, looks, SURFACE_INPUTS); };
