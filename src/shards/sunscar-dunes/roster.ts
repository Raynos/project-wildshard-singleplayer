import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { live } from '@wildshard/engine/models/live';
import { brazierModel, caravanModel, matriarchModel, rayModel, scoutModel, skittererModel, striderModel, towerModel, wellModel, whipModel } from './models/gear';
import { preloadDuneMeshes } from './world/meshes';
import { lastBakedWorld, loadBakedWorld } from './world/baked';

export const ROSTER: Awaited<ReturnType<NonNullable<ShardManifest['roster']>>> = [live(whipModel), live(rayModel), live(skittererModel), live(striderModel), live(matriarchModel), live(scoutModel),
  live(towerModel), live(caravanModel), live(wellModel), live(brazierModel)];
/** The roster once the generated models (C6) and the baked world (SF72: the tower) have loaded, so the Model Explorer shows them. */
export async function roster(): Promise<typeof ROSTER> { await Promise.all([preloadDuneMeshes(), lastBakedWorld() ?? loadBakedWorld()]); return ROSTER; }
