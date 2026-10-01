import type { ShardManifest } from '#game';
import { live } from '#engine';
import { lanternModel } from './models/gear';

export const ROSTER: Awaited<ReturnType<NonNullable<ShardManifest['roster']>>> = [live(lanternModel)];
