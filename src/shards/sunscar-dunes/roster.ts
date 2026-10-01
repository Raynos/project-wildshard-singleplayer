import type { ShardManifest } from '#game';
import { live } from '#engine';
import { towerModel, whipModel } from './models/gear';

export const ROSTER: Awaited<ReturnType<NonNullable<ShardManifest['roster']>>> = [live(whipModel), live(towerModel)];
