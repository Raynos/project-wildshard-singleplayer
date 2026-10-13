import { createModelLibrary } from '@wildshard/sdk/looks/modelLibrary';
import { SIGNAL_RIG_LIBRARY } from '../data/rigLibrary';
import { applySurfaceLooks } from '@wildshard/game/systems/looks/surfaceLooks';
import type { SurfaceLook } from '@wildshard/format/surfaceLooks';
import { FIRE_LIGHTS } from './fireFx';
import { DUSK } from '../look/dusk';
import { CAMP_SURFACE } from '../data/surfaces';
import { DUNE_MODELS } from '../data/files';
import type { MeshStandardMaterial } from 'three';

/**
 * Signal Dunes' generated models (C6, E374): codex refs → Hunyuan3D-2 → faceted, vertex-coloured GLBs, the textured hero
 * models and the baked creature rigs, loaded once behind the loading screen (`preloadDuneMeshes`, the plugin's `world`
 * hook) by the SDK model library from `data/files.ts` DUNE_DUNE_LIBRARY. A model that fails to load is a page fault, never a
 * silent stand-in: the places and the tower stand undrawn without it.
 */

/** The live inputs Signal's surface rows read: the fires' light slots and the dusk. */
const SURFACE_INPUTS = { lights: FIRE_LIGHTS, dusk: DUSK };
export const DUNE_LIBRARY = createModelLibrary({ ...DUNE_MODELS, rigs: SIGNAL_RIG_LIBRARY }, '[sunscar-dunes]', SURFACE_INPUTS);

/** Load every generated model and baked creature body once (a failed one is skipped and faulted). */
export const preloadDuneMeshes = DUNE_LIBRARY.preload;
/** A copy of a loaded model's geometry, or null (not loaded: use the code model). */
export const duneMesh = DUNE_LIBRARY.mesh;
/** A copy of a baked creature body (bones, skin, dims), else its undrawn stand-in on its skeleton (its load was faulted). */
export const duneBody = DUNE_LIBRARY.rig;
/** A creature's look: its rows on its baked body (else its stand-in), animated by its clip rows. */
/** A copy of a baked creature body, or null (not loaded): the physics bake refuses the stand-in. */
export const duneBakedBody = DUNE_LIBRARY.bakedRig;
/** A textured hero model fitted (turned, centred, its lowest point at its floor, sized), or null when it did not load. */
export const duneHd = DUNE_LIBRARY.hd;
/** A camp material warmed by each burning fire within ~4.5 m (`data/surfaces.ts` FIRELIGHT): its own fire lights it. */
export const warmByFire = (m: MeshStandardMaterial): void => { applySurfaceLooks(m, CAMP_SURFACE, SURFACE_INPUTS); };
/** A code-built held part's surface rows (the coil's viewer light and sheen) over the shared inputs. */
export const heldSurface = (m: MeshStandardMaterial, looks: readonly SurfaceLook[]): void => { applySurfaceLooks(m, looks, SURFACE_INPUTS); };
