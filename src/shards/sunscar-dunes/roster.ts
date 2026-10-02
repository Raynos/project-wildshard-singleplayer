import type { ShardManifest } from '#game';
import { live } from '#engine';
import { brazierModel, caravanModel, matriarchModel, rayModel, skittererModel, striderModel, towerModel, wellModel, whipModel } from './models/gear';

export const ROSTER: Awaited<ReturnType<NonNullable<ShardManifest['roster']>>> = [live(whipModel), live(rayModel), live(skittererModel), live(striderModel), live(matriarchModel),
  live(towerModel), live(caravanModel), live(wellModel), live(brazierModel)];
