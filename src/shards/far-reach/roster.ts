import type { ShardManifest } from '#game';
import { live } from '#engine';
import { fanEntry, windmillEntry } from './models/gear';
import { goatEntry, rayEntry, rocEntry, vaneEntry } from './models/creatures';

export const ROSTER: Awaited<ReturnType<NonNullable<ShardManifest['roster']>>> = [live(fanEntry), live(windmillEntry), live(vaneEntry), live(rocEntry), live(goatEntry), live(rayEntry)];
