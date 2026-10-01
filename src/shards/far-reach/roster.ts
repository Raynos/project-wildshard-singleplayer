import type { ShardManifest } from '#game';
import { live } from '#engine';
import { fanEntry, windmillEntry } from './models/gear';

export const ROSTER: Awaited<ReturnType<NonNullable<ShardManifest['roster']>>> = [live(fanEntry), live(windmillEntry)];
