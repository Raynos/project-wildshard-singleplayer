import { sceneScalar, sceneVectors } from '@wildshard/game/shardfile/sceneInputs';
import { declaredSceneModels } from '@wildshard/game/shardfile/sceneSources';
import { applySurfaceLooks } from '@wildshard/game/systems/looks/surfaceLooks';
import type { SurfaceLook } from '@wildshard/format/surfaceLooks';
import type { MeshStandardMaterial } from 'three';
import SURFACES from '../assets/surfaces.generated.json' with { type: 'json' };

const SURFACE_INPUTS = { lights: sceneVectors('sunscar-dunes', 'firelights', 4), dusk: sceneScalar('sunscar-dunes', 'dusk') };
/** The world and Explorer use one admitted library and its original materials. */
export const DUNE_LIBRARY = declaredSceneModels('sunscar-dunes', 'models');

/** A camp material warmed by each burning fire within ~4.5 m (`assets/surfaces.generated.json` FIRELIGHT): its own fire lights it. */
export const warmByFire = (m: MeshStandardMaterial): void => { applySurfaceLooks(m, SURFACES.CAMP_SURFACE, SURFACE_INPUTS); };
/** A code-built held part's surface rows (the coil's viewer light and sheen) over the shared inputs. */
export const heldSurface = (m: MeshStandardMaterial, looks: readonly SurfaceLook[]): void => { applySurfaceLooks(m, looks, SURFACE_INPUTS); };
