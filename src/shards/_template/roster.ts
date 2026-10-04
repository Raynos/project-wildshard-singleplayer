import type { ShardManifest } from '@wildshard/game';
import { live } from '@wildshard/engine';
import { lanternModel } from './models/gear';

export const ROSTER: Awaited<ReturnType<NonNullable<ShardManifest['roster']>>> = [live(lanternModel)];
