import { createModelLibrary } from '@wildshard/sdk/looks/modelLibrary';
import REST_POOLS from '../data/restPools.generated.json' with { type: 'json' };
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
 * models and the baked creature rigs, loaded once behind the loading screen (`DUNE_LIBRARY.preload`, the plugin's `world`
 * hook) by the SDK model library from `data/files.ts` DUNE_DUNE_LIBRARY. A model that fails to load is a page fault, never a
 * silent stand-in: the places and the tower stand undrawn without it.
 */

/** The live inputs Signal's surface rows read: the fires' light slots and the dusk. */
const SURFACE_INPUTS = { lights: FIRE_LIGHTS, dusk: DUSK };
export const DUNE_LIBRARY = createModelLibrary({ ...DUNE_MODELS, geometryPools: REST_POOLS, rigs: SIGNAL_RIG_LIBRARY }, '[sunscar-dunes]', SURFACE_INPUTS);

/** A camp material warmed by each burning fire within ~4.5 m (`data/surfaces.ts` FIRELIGHT): its own fire lights it. */
export const warmByFire = (m: MeshStandardMaterial): void => { applySurfaceLooks(m, CAMP_SURFACE, SURFACE_INPUTS); };
/** A code-built held part's surface rows (the coil's viewer light and sheen) over the shared inputs. */
export const heldSurface = (m: MeshStandardMaterial, looks: readonly SurfaceLook[]): void => { applySurfaceLooks(m, looks, SURFACE_INPUTS); };
