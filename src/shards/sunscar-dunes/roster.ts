import type { ShardManifest } from '@wildshard/game';
import { live } from '@wildshard/engine';
import { brazierModel, caravanModel, matriarchModel, rayModel, scoutModel, skittererModel, striderModel, towerModel, wellModel, whipModel } from './models/gear';
import { preloadDuneMeshes } from './world/meshes';

export const ROSTER: Awaited<ReturnType<NonNullable<ShardManifest['roster']>>> = [live(whipModel), live(rayModel), live(skittererModel), live(striderModel), live(matriarchModel), live(scoutModel),
  live(towerModel), live(caravanModel), live(wellModel), live(brazierModel)];
/** The roster once the generated models (C6) have loaded, so the Model Explorer shows them, not the code stand-ins. */
export async function roster(): Promise<typeof ROSTER> { await preloadDuneMeshes(); return ROSTER; }
