import type { ShardManifest } from '#game';
import { live } from '#engine';
import { fanModel, mantaModel } from './models/gear';

export const ROSTER: Awaited<ReturnType<NonNullable<ShardManifest['roster']>>> = [live(fanModel), live(mantaModel)];
