import type { ShardManifest } from '@wildshard/game';
import { live } from '@wildshard/engine';
import { bridgeEntry, fanEntry, keeperEntry, windmillEntry } from './models/gear';
import { goatEntry, rayEntry, rocEntry, vaneEntry } from './models/creatures';

export const ROSTER: Awaited<ReturnType<NonNullable<ShardManifest['roster']>>> = [live(fanEntry), live(windmillEntry), live(bridgeEntry), live(vaneEntry), live(rocEntry), live(goatEntry), live(rayEntry), live(keeperEntry)];
