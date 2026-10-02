import type { ShardManifest } from '#game';
import { live } from '#engine';
import { bridgeEntry, fanEntry, windmillEntry } from './models/gear';
import { goatEntry, rayEntry, rocEntry, vaneEntry } from './models/creatures';

export const ROSTER: Awaited<ReturnType<NonNullable<ShardManifest['roster']>>> = [live(fanEntry), live(windmillEntry), live(bridgeEntry), live(vaneEntry), live(rocEntry), live(goatEntry), live(rayEntry)];
